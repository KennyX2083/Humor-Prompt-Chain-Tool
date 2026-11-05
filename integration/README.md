# Connect the original public app

The original public repository's default-branch route still used a hardcoded prompt when inspected. Studio now edits the existing prompt_chains / prompt_chain_steps / prompt_chain_mix tables, but the public route must also be updated before it uses those edits.

## Files prepared here

The public-app folder mirrors the files to place inside the original Humor-Project/my-app checkout:

- app/api/excuses/route.ts: keeps sign-in, roster validation, draft creation, and the existing response format; delegates generation to the shared chain adapter.
- lib/generate-from-shared-chain.ts: selects a weighted active chain and the oldest enabled Google model, then writes generation_request and llm_response logs.
- lib/run-prompt-chain.ts: same step runner used in Studio and the admin generator.
- lib/prompt-chain-mix.ts: same weighted-selection algorithm used by the admin generator.

public-app.patch is an alternative to copying those four files. It is based on the public repository's route as read from GitHub main. From the ORIGINAL Humor-Project repository root, run git apply --check with the patch's absolute path first. Only if that succeeds, run git apply with that same path. If it fails because your local route differs, do not force it; compare the prepared files with your local versions.

These handoff files are excluded from Studio TypeScript/ESLint checks because they belong to another repository, and are not executed by Studio.

## Required public-app environment

Add SUPABASE_SERVICE_ROLE_KEY to the ORIGINAL PUBLIC APP's server environment (and its local ignored .env.local if testing locally). Obtain the existing project's legacy service_role key from Supabase. Mark it Sensitive in Vercel, and never give it a NEXT_PUBLIC_ prefix or commit it. The browser continues using the anon key.

This server key is required only for the public app adapter: ordinary players must not receive direct access to private prompt/model configuration. The route authenticates the player and validates inputs BEFORE using the server-only adapter. Studio continues to authorize administrators using their normal session and RLS; it does not need the service-role key.

Also retain the public app's NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and GEMINI_API_KEY. Use the SAME Supabase project as Studio/admin. The model is selected from llm_models, not a hardcoded model name.

## Order

1. Apply Studio's updated database/setup.sql in the existing Supabase project.
2. Run Studio checks and confirm its existing live chain appears.
3. Apply the four public-app files, add the public server environment variable, run that app's checks, commit, push, and deploy it.
4. Deploy the updated Studio separately.
5. Test a NEW INACTIVE chain in Studio before making it eligible for production. Positive weights select proportionally; they are not percentages.
6. To prove the public connection, temporarily give one disposable marker chain a positive weight and set the other live chains to zero (record their original weights first), generate from the original public app, then restore the original weights and deactivate/delete the test chain.

Publishing a generated draft and voting stay on the original public app. Studio tests never automatically publish excuses. An optional Studio image is a test-only input; live gaming chains should work with the original app's game/character/situation input.

## Deletion behavior

The updated SQL changes foreign-key deletion behavior: deleting a chain removes its steps and mix row, and clears chain/step links in historical requests/responses. Prompt and output text is retained. Studio test history keeps the chain-name snapshot. Do not run deletions while generation is in progress.

Prior standalone prompt_tool_chains / prompt_tool_steps are left intact and are no longer the live editing source. Their historical runs remain in All Studio test history; they are not silently activated or imported into production.
