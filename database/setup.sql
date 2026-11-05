-- Studio now edits the existing Excuse Queue chain system.
-- Run this entire transaction in the existing Supabase project.
-- Keeps legacy prompt_tool_* rows; does not activate new chains automatically.
begin;
do $$ begin
 if to_regclass('public.prompt_chains') is null or to_regclass('public.prompt_chain_steps') is null or to_regclass('public.prompt_chain_mix') is null then
  raise exception 'The existing Excuse Queue prompt chain tables must be installed first.';
 end if;
 if to_regprocedure('private.is_superadmin()') is null then raise exception 'Missing existing superadmin helper'; end if;
end $$;

-- Swap positions atomically without transient uniqueness failures.
alter table public.prompt_chain_steps drop constraint if exists prompt_chain_steps_chain_id_position_key;
alter table public.prompt_chain_steps add constraint prompt_chain_steps_chain_id_position_key unique(chain_id,position) deferrable initially deferred;
-- Deletion retains request/response contents, clearing only links to deleted rows.
alter table public.llm_response drop constraint if exists llm_response_step_chain_fk;
alter table public.llm_response add constraint llm_response_step_chain_fk foreign key(step_id,chain_id) references public.prompt_chain_steps(id,chain_id) on delete set null;
alter table public.generation_request drop constraint if exists generation_request_chain_id_fkey;
alter table public.generation_request add constraint generation_request_chain_id_fkey foreign key(chain_id) references public.prompt_chains(id) on delete set null;
alter table public.prompt_chain_steps drop constraint if exists prompt_chain_steps_chain_id_fkey;
alter table public.prompt_chain_steps add constraint prompt_chain_steps_chain_id_fkey foreign key(chain_id) references public.prompt_chains(id) on delete cascade;
alter table public.prompt_chain_mix drop constraint if exists prompt_chain_mix_chain_id_fkey;
alter table public.prompt_chain_mix add constraint prompt_chain_mix_chain_id_fkey foreign key(chain_id) references public.prompt_chains(id) on delete cascade;

alter table public.prompt_chains enable row level security;
alter table public.prompt_chain_steps enable row level security;
alter table public.prompt_chain_mix enable row level security;
grant select,insert,update,delete on public.prompt_chains,public.prompt_chain_steps to authenticated;
grant select,insert,update on public.prompt_chain_mix to authenticated;
grant usage,select on sequence public.prompt_chains_id_seq,public.prompt_chain_steps_id_seq to authenticated;
drop policy if exists "Studio admins manage chains" on public.prompt_chains;
create policy "Studio admins manage chains" on public.prompt_chains for all to authenticated using ((select private.is_superadmin())) with check ((select private.is_superadmin()));
drop policy if exists "Studio admins manage steps" on public.prompt_chain_steps;
create policy "Studio admins manage steps" on public.prompt_chain_steps for all to authenticated using ((select private.is_superadmin())) with check ((select private.is_superadmin()));
drop policy if exists "Studio admins insert chain mix" on public.prompt_chain_mix;
create policy "Studio admins insert chain mix" on public.prompt_chain_mix for insert to authenticated with check ((select private.is_superadmin()));
insert into public.prompt_chain_mix(chain_id,weight) select id,0 from public.prompt_chains on conflict(chain_id) do nothing;

-- Reuse the existing Studio history table. Old UUID-based history is preserved.
create table if not exists public.prompt_tool_runs (
 id uuid primary key default gen_random_uuid(), chain_id uuid,
 chain_name text not null, user_id uuid not null references auth.users(id),
 input text not null, outputs jsonb not null default '[]'::jsonb,
 error text, created_at timestamptz not null default now(), finished_at timestamptz
);
alter table public.prompt_tool_runs add column if not exists shared_chain_id bigint references public.prompt_chains(id) on delete set null;
alter table public.prompt_tool_runs add column if not exists request_id bigint references public.generation_request(id) on delete set null;
create index if not exists prompt_tool_runs_shared_idx on public.prompt_tool_runs(shared_chain_id,created_at desc);
create index if not exists prompt_tool_runs_request_idx on public.prompt_tool_runs(request_id);
alter table public.prompt_tool_runs enable row level security;
revoke all on public.prompt_tool_runs from anon;
grant select,insert,update on public.prompt_tool_runs to authenticated;
drop policy if exists "Admins read tool runs" on public.prompt_tool_runs;
create policy "Admins read tool runs" on public.prompt_tool_runs for select to authenticated using ((select private.is_superadmin()));
drop policy if exists "Admins create tool runs" on public.prompt_tool_runs;
create policy "Admins create tool runs" on public.prompt_tool_runs for insert to authenticated with check ((select private.is_superadmin()) and user_id=(select auth.uid()));
drop policy if exists "Admins finish own tool runs" on public.prompt_tool_runs;
create policy "Admins finish own tool runs" on public.prompt_tool_runs for update to authenticated using ((select private.is_superadmin()) and user_id=(select auth.uid())) with check ((select private.is_superadmin()) and user_id=(select auth.uid()));

create or replace function public.studio_save_chain(p_id bigint,p_name text,p_slug text,p_description text,p_weight integer)
returns bigint language plpgsql security invoker set search_path='' as $$
declare result bigint;
begin
 if auth.uid() is null or not private.is_superadmin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_weight is null or p_weight not between 0 and 10000 then raise exception 'Invalid weight'; end if;
 if p_id is not null then
  perform 1 from public.prompt_chains where id=p_id for update;
  if not found then raise exception 'Chain unavailable'; end if;
 end if;
 if p_weight>0 and (p_id is null or not exists(select 1 from public.prompt_chain_steps where chain_id=p_id)) then raise exception 'Add a step before activating a chain' using errcode='23514'; end if;
 if p_id is null then
  insert into public.prompt_chains(name,slug,description) values(p_name,p_slug,p_description) returning id into result;
 else
  update public.prompt_chains set name=p_name,slug=p_slug,description=p_description where id=p_id returning id into result;
  if not found then raise exception 'Chain unavailable'; end if;
 end if;
 insert into public.prompt_chain_mix(chain_id,weight) values(result,p_weight) on conflict(chain_id) do update set weight=excluded.weight,updated_at=now();
 return result;
end $$;
create or replace function public.studio_append_step(p_chain_id bigint,p_name text,p_instructions text)
returns bigint language plpgsql security invoker set search_path='' as $$
declare next_position integer; result bigint;
begin
 if auth.uid() is null or not private.is_superadmin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 perform 1 from public.prompt_chains where id=p_chain_id for update;
 if not found then raise exception 'Chain unavailable'; end if;
 with ordered as(select id,row_number() over(order by position)::integer pos from public.prompt_chain_steps where chain_id=p_chain_id)
 update public.prompt_chain_steps s set position=o.pos from ordered o where s.id=o.id;
 select count(*)+1 into next_position from public.prompt_chain_steps where chain_id=p_chain_id;
 if next_position>10 then raise exception 'A shared chain supports ten steps'; end if;
 insert into public.prompt_chain_steps(chain_id,position,name,instructions) values(p_chain_id,next_position,p_name,p_instructions) returning id into result;
 return result;
end $$;
create or replace function public.studio_move_step(p_step_id bigint,p_chain_id bigint,p_direction integer)
returns void language plpgsql security invoker set search_path='' as $$
declare selected public.prompt_chain_steps; neighbor public.prompt_chain_steps;
begin
 if auth.uid() is null or not private.is_superadmin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_direction is null or p_direction not in(-1,1) then raise exception 'Invalid direction'; end if;
 perform 1 from public.prompt_chains where id=p_chain_id for update;
 if not found then raise exception 'Chain unavailable'; end if;
 select * into selected from public.prompt_chain_steps where id=p_step_id and chain_id=p_chain_id;
 if not found then raise exception 'Step unavailable'; end if;
 select * into neighbor from public.prompt_chain_steps where chain_id=p_chain_id and (case when p_direction=-1 then position<selected.position else position>selected.position end) order by(case when p_direction=-1 then -position else position end) limit 1;
 if not found then return; end if;
 update public.prompt_chain_steps set position=case when id=selected.id then neighbor.position else selected.position end where id in(selected.id,neighbor.id);
end $$;
create or replace function public.studio_delete_step(p_step_id bigint,p_chain_id bigint)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not private.is_superadmin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 perform 1 from public.prompt_chains where id=p_chain_id for update;
 if not found then raise exception 'Chain unavailable'; end if;
 if (select count(*) from public.prompt_chain_steps where chain_id=p_chain_id)=1 and exists(select 1 from public.prompt_chain_mix where chain_id=p_chain_id and weight>0) then raise exception 'Set weight to zero before removing the last active step' using errcode='23514'; end if;
 delete from public.prompt_chain_steps where id=p_step_id and chain_id=p_chain_id;
 if not found then raise exception 'Step unavailable'; end if;
 with ordered as(select id,row_number() over(order by position)::integer pos from public.prompt_chain_steps where chain_id=p_chain_id)
 update public.prompt_chain_steps s set position=o.pos from ordered o where s.id=o.id;
end $$;
create or replace function public.studio_delete_chain(p_chain_id bigint)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not private.is_superadmin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 delete from public.prompt_chains where id=p_chain_id;
 if not found then raise exception 'Chain unavailable'; end if;
end $$;
revoke all on function public.studio_save_chain(bigint,text,text,text,integer),public.studio_append_step(bigint,text,text),public.studio_move_step(bigint,bigint,integer),public.studio_delete_step(bigint,bigint),public.studio_delete_chain(bigint) from public,anon;
grant execute on function public.studio_save_chain(bigint,text,text,text,integer),public.studio_append_step(bigint,text,text),public.studio_move_step(bigint,bigint,integer),public.studio_delete_step(bigint,bigint),public.studio_delete_chain(bigint) to authenticated;
notify pgrst,'reload schema';
commit;
