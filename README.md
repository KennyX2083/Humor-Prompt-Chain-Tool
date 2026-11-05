# Humor Prompt Chain Tool

Standalone Week 8 application in its own Git repository, beside the Week 7 admin application. No changes to the admin app are needed.

## Implemented in source

- Superadmin-only workspace, verified through Supabase Auth and profiles.is_superadmin. Non-admin accounts see an access-denied state. Server actions and database row-level security enforce the same restriction.
- Create, read, edit, and delete chains and steps. Creating a chain selects it automatically; deleting it returns to the chain list.
- Move steps up/down. Database functions lock the parent chain to serialize appends, moves, and deletions. Deletions compact the remaining positions.
- Run a chain from starting text or a PNG/JPEG/WebP image under 2 MB. The first step gets the image; each following step receives the original text and previous output.
- Generate descriptions, jokes, and captions as text media, matching the assignment's image-to-description-to-captions example. Image/video output generation is not included.
- Save each completed step's output and instructions immediately. Review history for a particular chain, or All history for runs from all chains including deleted ones.
- Copy or download each generated text output. History is paginated, ten runs per page.
- Light, dark, and system appearance; saved in browser storage and synchronized across tabs.
- Controlled editor fields preserve text after validation or server errors. Deletion requires explicit confirmation.

## Verification status

The source has been reviewed, but this revision has NOT been linted, type-checked, built, browser-tested, or exercised against the database. No database setup or deployment is performed by editing these files. Use the checklist in VERIFY.md before treating the app as complete.

## Local setup (WSL)

Use Node 24 in WSL for this project. The .nvmrc selects that version with nvm use. Do not alternate Windows and Linux installs in this same node_modules folder.

1. Open this directory in your WSL terminal and run nvm use.
2. If dependencies are absent or were installed on Windows, run npm ci --include=optional here. This installs the existing locked versions; do not run it in the admin app.
3. The existing .env.local is ignored by Git. Confirm it contains NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and GEMINI_API_KEY for your existing Humor Lab project. GEMINI_MODEL is optional; the default is gemini-flash-latest. Never paste secret values into chat or commit them. .env.example contains names only and is tracked.
4. Review and run database/setup.sql in that project's Supabase SQL Editor. It depends on the existing private.is_superadmin() helper. The whole script runs in one transaction and can be reapplied; it only configures the independent prompt_tool_* objects. If an earlier draft was applied, reapply this version for the new delete/reorder functions.
5. Add http://localhost:3001/auth/callback to Supabase Auth's redirect allowlist. Keep the existing public/admin callback URLs.
6. Run npm run lint, npx tsc --noEmit, and npm run build. Stop on errors.
7. Run npm run dev -- --port 3001 and visit http://localhost:3001. This keeps the admin app's port separate.

## Example chain

Create a chain named Image to funny captions, then add:

1. Describe image: Describe the supplied image accurately in two or three sentences. Return only the description.
2. Find the joke: Use the previous description to write one playful, funny observation. Return only the observation.
3. Write captions: Use the previous observation and original context to write five distinct, short, funny captions. Return a numbered list.

Select an image and run the chain. Open its generation history to inspect the three saved outputs and download the captions.

## Limits and recovery

Chains support 20 steps. Each model call has a timeout of at most 45 seconds and automatic retries are disabled. The application stops generation after approximately four minutes to leave time to record the final status before the route's 300-second deployment limit. Reduce the number or complexity of steps if a run stops for time.

Each completed output is saved before the next step starts. If the process is interrupted, history labels an unfinished run Interrupted after five minutes. Refresh history to see saved progress, then rerun the chain. There is no automatic resume. Do not start another run while the current one is working unless you intend to make another model request.

Input images are sent to Gemini but are not persisted in Supabase; the filename is recorded. History stores original text, step instructions, and generated text. Deleting a chain removes its steps but retains runs in All history.

## GitHub and Vercel (after local verification)

- Create an empty GitHub repository named Humor-Prompt-Chain-Tool; commit the reviewed source and push main. The local Git repository is already initialized.
- Import that repository as a separate Next.js Vercel project named humor-prompt-chain-tool, with the repository root as its root directory and Node 24 selected.
- Set the same environment variables in Vercel. Keep GEMINI_API_KEY server-only. Redeploy after changing environment variables.
- Add the resulting HTTPS /auth/callback URL to Supabase Auth's redirect allowlist. Add any specific preview URL you need to test.
- Disable Vercel Deployment Protection as requested by the assignment. The app still requires Google sign-in and a superadmin profile.
- Test the deployment in incognito and with both administrator and ordinary accounts.
- Submit the latest commit-specific deployment URLs for the public app, admin app, and this app. The project alias alone is not a commit-specific URL.
