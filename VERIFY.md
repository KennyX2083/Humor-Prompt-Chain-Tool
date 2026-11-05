# Week 8 verification checklist

These are manual checks for you to run. They have not been executed by the code editor.

## Preparation

- Work in `Humor-Prompt-Chain-Tool`, not the admin directory.
- Use Node 24 in WSL (`nvm use`).
- Confirm the existing `.env.local` has the correct Supabase URL, public key, and server-only Gemini key. Do not commit it.
- Apply the reviewed `database/setup.sql` in your existing project's SQL Editor. Apply this current version even if you applied the earlier draft.
- Add `http://localhost:3001/auth/callback` to the Supabase Auth redirect allowlist.
- Run `npm run lint`, `npx tsc --noEmit`, and `npm run build`. Stop and report any errors.
- Start with `npm run dev -- --port 3001`.

## Access requirement

- Signed out: see the landing/sign-in page; no chains or outputs are shown.
- Signed in with `profiles.is_superadmin = false`: see administrator access denied and a Sign out button.
- Signed in with `profiles.is_superadmin = true`: see the chain workspace.
- Sign out: workspace data disappears after navigation/refresh.
- Confirm the three `prompt_tool_*` tables have RLS enabled and their policies require `private.is_superadmin()`. Direct database access by a normal authenticated user must not expose chains, steps, or history.

## Chain CRUD

- Create a chain with a name and description. It becomes the selected chain.
- Refresh: the chain persists.
- Edit its name and description, save, and refresh: changes persist.
- Submit a blank name: browser or server validation blocks it.
- Create a second chain: its steps and history are separate from the first.
- Try deleting without selecting confirmation: Delete is disabled.

## Step CRUD and ordering

- Add the three example steps from README.md.
- Refresh: steps remain in the same order.
- Edit a step's name and instructions; save and refresh.
- Move step 2 up: it becomes step 1, and the previous step 1 becomes step 2.
- Move it back down. Top/bottom move buttons are disabled at boundaries.
- Delete the middle step after confirming: the remaining steps are numbered 1 and 2.
- Add a replacement step: it becomes step 3 with no duplicate position.
- Verify a failed save keeps entered text. For example, submitting whitespace-only instructions should fail server validation without clearing the controlled text field.

## Generate and view media

- Use the README's image-description, funny-observation, and five-caption example.
- Select a PNG/JPEG/WebP below 2 MB; run the chain.
- Confirm a saved run contains the description, observation, and five captions in step order.
- Expand Instructions used: it shows the instructions saved with each output.
- Copy text and Download .txt: each produces the selected step's output.
- Refresh: saved outputs remain.
- Select another chain: its history excludes the first chain's runs.
- Open All history: runs from both chains are visible.
- Empty text with no image: validation prevents generation.
- Oversized or unsupported files: validation rejects them before upload; the server also checks type and file signature.
- If the model rejects a request or times out, confirm the run shows Stopped and any previously completed outputs remain.
- If a process is interrupted, an unfinished run older than five minutes is labeled Interrupted; saved outputs stay readable. Refresh history using its button.
- Delete a disposable chain containing a run: its steps disappear, but its saved outputs remain under All history with a deleted-chain label.
- If more than ten runs exist, test history pagination and chain filtering across pages.

## Appearance

- Select Light and Dark: the workspace changes immediately.
- Reload: the selected preference persists.
- Select System: changing the operating system appearance changes the page.
- Change appearance in another tab: the open tab synchronizes.
- Use keyboard Tab/Enter to navigate controls, expand panels, and save forms.
- Check narrow/mobile widths: the sidebar stacks above the workspace and form content remains usable.

## Release requirements (after local checks pass)

- Create the separate GitHub repository and push the reviewed source.
- Confirm `.env.example` is included, while `.env.local`, `node_modules`, and `.next` are excluded.
- Import it as a separate Vercel Next.js project with Node 24 and the required environment variables.
- Add the deployed `/auth/callback` URL in Supabase without removing existing app URLs.
- Disable Vercel Deployment Protection as the assignment requests.
- In incognito, the app loads without a Vercel login wall; its own Google sign-in and superadmin check still apply.
- Repeat the CRUD, ordering, generation, and theme checks on the deployed app.
- Obtain the latest commit-specific deployment URLs for all three applications for submission.
