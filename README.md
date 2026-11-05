# Excuse Queue / Prompt Studio

Week 8's separate Next.js app now manages the original project's shared chain system.

## How the projects connect

- Studio edits prompt_chains, prompt_chain_steps, and prompt_chain_mix in the same Supabase project as the original app/admin.
- Existing admin chains appear here. New chains start with weight 0; positive weights enter the shared weighted selection pool after at least one step is added.
- Test runs take Game, Character, and Situation and use the same enabled Google model and step-runner context as the database-backed admin generator.
- Tests are recorded in generation_request and llm_response and checkpointed in prompt_tool_runs. They do not publish excuses. Shared generator activity shows app and Studio request outputs.
- The original public app needs the supplied integration/public-app.patch (or four replacement files) and a server-only Supabase key before its hardcoded prompt is replaced. See integration/README.md. Until that route is deployed, public generation remains hardcoded.
- The older standalone UUID chain tables are preserved, but no longer edited by Studio. Their old runs stay in All Studio test history.

## Features

Superadmin-only chain/step CRUD; atomic reordering and position compaction; shared selection weights; game-specific character validation; optional image input for tests; per-step saved outputs; copy/download controls; shared request logs; light/dark/system themes. Shared chains retain the original schema's ten-step limit. Each step must return 1–4,000 characters so its final output can become an excuse draft.

## Manual setup and checks

No installs, tests, SQL, pushes, or deployments were executed during this integration edit.

1. Use Node 24 in WSL in this directory (nvm use). Do not alternate Windows and Linux dependency installs.
2. Keep the same Supabase URL/anon key and GEMINI_API_KEY in ignored .env.local. Studio uses the model configuration in the admin Models page; GEMINI_MODEL is no longer consulted.
3. Run the ENTIRE updated database/setup.sql in the existing Supabase project, even if an earlier version was installed. It reuses existing tables, adds Studio history links and admin policies, enables management RPCs, and adjusts deletion constraints to preserve log contents. Review integration/README.md for the deletion details. No data is deleted by setup.
4. Run npm run lint, npx tsc --noEmit, and npm run build. Stop on the first error.
5. Add http://localhost:3001/auth/callback to Supabase's redirect allowlist and run npm run dev -- --port 3001 if testing locally.
6. Follow VERIFY.md, then apply the public-app integration and deploy both repos separately.

## Example gaming chain

Create Explain the misplay with slug explain-the-misplay and weight 0:

1. Analyze mistake: Identify the funny contradiction in the supplied game, character, and situation. Return one sentence.
2. Invent excuse: Turn the previous observation into an absurd first-person gaming excuse. Return only 1–3 short sentences, under 4,000 characters.

Test Valorant / Jett / I flashed my team and missed every shot. Once satisfied, set a positive live weight to make the chain eligible for original-app generation after its adapter is deployed. Do not activate an image-dependent chain if the public app supplies no images.

## Limits and deployment

Generation is budgeted to about four minutes, with per-call timeouts and saved per-step progress. Unfinished old runs are displayed as Interrupted. There is no automatic resume.

GitHub/Vercel repositories remain separate. Import this repo as Next.js with Node 24, configure its Supabase URL/anon key and Gemini key, add its HTTPS auth callback in Supabase, and disable Vercel Deployment Protection as required. Keep application sign-in and superadmin checks enabled. Submit commit-specific deployment URLs for public/admin/Studio after verification.
