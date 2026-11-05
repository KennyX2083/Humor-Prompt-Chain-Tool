# Shared Excuse Queue integration verification

No checks in this document were run automatically.

## Preparation

1. In Studio's WSL directory: nvm use, then npm run lint, npx tsc --noEmit, and npm run build. Stop on errors. Do not touch the admin app's dependencies.
2. Review and run the FULL updated database/setup.sql in the same Supabase project used by the original app/admin. The previous standalone setup is not sufficient.
3. Sign in as a superadmin. Existing admin prompt chains and their slugs should now appear, with the same mix weights as the admin Chain Mix page.
4. Ordinary accounts and signed-out users must not see or edit the workspace.

## Shared editing and activation

- Create a disposable chain. Confirm its weight is 0 and it also appears in the admin Prompt Chains view after refreshing.
- Add a step, edit its name/instructions, and refresh both apps. Both must show the same saved row.
- Add a second step, move it above the first, and refresh both apps. Both must show the same ordering.
- Delete a temporary middle step. Positions must remain consecutive.
- An empty chain cannot be given a positive weight. An active chain cannot lose its last step until its weight is set to 0.
- Save a unique slug. A duplicate slug must be rejected without clearing entered edits.
- Set a positive weight only after adding a usable step. The admin Chain Mix page must show that weight.

## Gaming input and shared logs

- Select Valorant, Jett, and the situation I flashed my team and missed every shot.
- Test the selected chain. Its outputs should use the supplied context and pass each previous output into the next step.
- A character from another game and a situation under five characters must be rejected.
- Shared generator activity and the admin Generation Requests / LLM Responses pages must show the SAME request and step outputs.
- Studio test history should persist across refreshes. Copy/download should produce the displayed output.
- Studio tests must not create published excuses or drafts.
- Optional image tests still work, but public chains should not depend on an image because the original public form does not upload one.

## Prove the original public app uses Studio edits

This test only works AFTER applying and deploying integration/public-app.patch (or the equivalent four files) and configuring the public app's server-only SUPABASE_SERVICE_ROLE_KEY. See integration/README.md. Merely updating Studio does not replace the original app's hardcoded route.

1. Record all existing positive mix weights so you can restore them.
2. Create an inactive disposable chain named Integration marker with one step: Return exactly: My keyboard joined the enemy team. Do not add anything else.
3. Test it in Studio and confirm the marker output.
4. Give the marker chain weight 1. Temporarily set the other positive weights to 0 so selection is deterministic.
5. In the ORIGINAL PUBLIC APP, generate an excuse using any valid game/character/situation. Its draft must equal the marker text. It must also appear as a request in Studio's shared activity and admin logs.
6. Edit that step in Studio to return a different fixed sentence. Generate again in the original app; its NEW draft must change accordingly. Existing drafts are expected to keep their original text.
7. Restore the recorded production weights, set the marker weight to 0, and delete the disposable chain if desired.
8. Verify published-excuse creation and voting still work on the original app.

## History and deletion

- Generate at least one disposable chain run, then delete its chain after confirming.
- Shared generation_request / llm_response CONTENTS must remain, with deleted chain/step links cleared.
- Studio history retains its chain-name snapshot and outputs in All history.
- Old standalone tests remain visible in All Studio test history with a legacy label; they do not enter the live mix automatically.
- Do not delete a chain or its steps while a generation is running.

## Remaining Week 8 specification checks

- Chain and step CRUD persist after refreshing.
- Reordering changes actual execution order (test two fixed-output steps in opposite orders).
- Light, dark, and system themes work and persist; narrow-window layout is usable.
- The header reads E. EXCUSE QUEUE / PROMPT STUDIO.
- GitHub and Vercel projects remain separate from the original/admin repos.
- Google callbacks work on each deployed domain.
- Incognito reaches the app without a Vercel login wall, while app sign-in/superadmin checks remain required.
- Commit-specific URLs for all three final deployments are ready for submission.
