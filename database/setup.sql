-- Independent Week 8 tables; existing Week 7 generation is unchanged.
-- Run the whole script in Supabase SQL Editor. It can be reapplied safely.
begin;
do $$ begin
 if to_regprocedure('private.is_superadmin()') is null then
  raise exception 'This script requires the existing Humor Lab private.is_superadmin() helper.';
 end if;
end $$;
create table if not exists public.prompt_tool_chains (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(name) between 1 and 100),
 description text not null default '' check (char_length(description) <= 2000),
 created_at timestamptz not null default now()
);
create table if not exists public.prompt_tool_steps (
 id uuid primary key default gen_random_uuid(),
 chain_id uuid not null references public.prompt_tool_chains(id) on delete cascade,
 position integer not null check(position between 1 and 20),
 name text not null check(char_length(name) between 1 and 100),
 instructions text not null check(char_length(instructions) between 1 and 8000),
 constraint prompt_tool_step_position unique(chain_id,position) deferrable initially deferred
);
create table if not exists public.prompt_tool_runs (
 id uuid primary key default gen_random_uuid(),
 chain_id uuid references public.prompt_tool_chains(id) on delete set null,
 chain_name text not null,
 user_id uuid not null references auth.users(id),
 input text not null,
 outputs jsonb not null default '[]'::jsonb,
 error text,
 created_at timestamptz not null default now(),
 finished_at timestamptz
);
create index if not exists prompt_tool_runs_chain_idx on public.prompt_tool_runs(chain_id,created_at desc);
create index if not exists prompt_tool_runs_user_idx on public.prompt_tool_runs(user_id);
alter table public.prompt_tool_chains enable row level security;
alter table public.prompt_tool_steps enable row level security;
alter table public.prompt_tool_runs enable row level security;
revoke all on public.prompt_tool_chains,public.prompt_tool_steps,public.prompt_tool_runs from anon,authenticated;
grant select,insert,update,delete on public.prompt_tool_chains,public.prompt_tool_steps to authenticated;
grant select,insert,update on public.prompt_tool_runs to authenticated;
drop policy if exists "Admins manage tool chains" on public.prompt_tool_chains;
create policy "Admins manage tool chains" on public.prompt_tool_chains for all to authenticated
 using ((select private.is_superadmin())) with check ((select private.is_superadmin()));
drop policy if exists "Admins manage tool steps" on public.prompt_tool_steps;
create policy "Admins manage tool steps" on public.prompt_tool_steps for all to authenticated
 using ((select private.is_superadmin())) with check ((select private.is_superadmin()));
drop policy if exists "Admins read tool runs" on public.prompt_tool_runs;
create policy "Admins read tool runs" on public.prompt_tool_runs for select to authenticated using ((select private.is_superadmin()));
drop policy if exists "Admins create tool runs" on public.prompt_tool_runs;
create policy "Admins create tool runs" on public.prompt_tool_runs for insert to authenticated
 with check ((select private.is_superadmin()) and user_id=(select auth.uid()));
drop policy if exists "Admins finish own tool runs" on public.prompt_tool_runs;
create policy "Admins finish own tool runs" on public.prompt_tool_runs for update to authenticated
 using ((select private.is_superadmin()) and user_id=(select auth.uid()))
 with check ((select private.is_superadmin()) and user_id=(select auth.uid()));

create or replace function public.append_prompt_tool_step(p_chain_id uuid,p_name text,p_instructions text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare next_position integer; result uuid;
begin
 if auth.uid() is null or not private.is_superadmin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 perform 1 from public.prompt_tool_chains where id=p_chain_id for update;
 if not found then raise exception 'Chain unavailable'; end if;
 -- Compact gaps left by deletions before appending.
 with ordered as (select id,row_number() over(order by position)::integer as pos from public.prompt_tool_steps where chain_id=p_chain_id)
 update public.prompt_tool_steps s set position=o.pos from ordered o where s.id=o.id;
 select count(*)+1 into next_position from public.prompt_tool_steps where chain_id=p_chain_id;
 insert into public.prompt_tool_steps(chain_id,position,name,instructions) values(p_chain_id,next_position,p_name,p_instructions) returning id into result;
 return result;
end $$;
-- Remove the earlier two-argument prototype to avoid ambiguous API overloads.
drop function if exists public.move_prompt_tool_step(uuid,integer);
create or replace function public.move_prompt_tool_step(p_step_id uuid,p_direction integer,p_chain_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare selected public.prompt_tool_steps; neighbor public.prompt_tool_steps;
begin
 if auth.uid() is null or not private.is_superadmin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_direction not in (-1,1) or p_direction is null then raise exception 'Invalid direction'; end if;
 perform 1 from public.prompt_tool_chains where id=p_chain_id for update;
 if not found then raise exception 'Chain unavailable'; end if;
 select * into selected from public.prompt_tool_steps where id=p_step_id and chain_id=p_chain_id;
 if not found then raise exception 'Step unavailable'; end if;
 select * into neighbor from public.prompt_tool_steps where chain_id=selected.chain_id
  and (case when p_direction=-1 then position<selected.position else position>selected.position end)
  order by (case when p_direction=-1 then -position else position end) limit 1;
 if not found then return; end if;
 update public.prompt_tool_steps set position=case when id=selected.id then neighbor.position else selected.position end
  where id in (selected.id,neighbor.id);
end $$;

create or replace function public.delete_prompt_tool_step(p_step_id uuid,p_chain_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not private.is_superadmin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 perform 1 from public.prompt_tool_chains where id=p_chain_id for update;
 if not found then raise exception 'Chain unavailable'; end if;
 delete from public.prompt_tool_steps where id=p_step_id and chain_id=p_chain_id;
 if not found then raise exception 'Step unavailable'; end if;
 with ordered as (select id,row_number() over(order by position)::integer as pos from public.prompt_tool_steps where chain_id=p_chain_id)
 update public.prompt_tool_steps s set position=o.pos from ordered o where s.id=o.id;
end $$;

create index if not exists prompt_tool_runs_created_idx on public.prompt_tool_runs(created_at desc,id);
revoke all on function public.append_prompt_tool_step(uuid,text,text),public.move_prompt_tool_step(uuid,integer,uuid),public.delete_prompt_tool_step(uuid,uuid) from public,anon;
grant execute on function public.append_prompt_tool_step(uuid,text,text),public.move_prompt_tool_step(uuid,integer,uuid),public.delete_prompt_tool_step(uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
