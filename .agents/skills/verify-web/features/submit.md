# Submit an addon

A signed-in user picks a `manifest.json` and a bundle on `/submit`, optionally adds a repository and changelog, and sends it for review. The browser uploads the bundle straight to staging storage. The user lands on `/dashboard` with a toast, and the submission appears in `/review`.

## Sub-features

- `submit-listing` makes a first submission of a new id. It appears under `New Listings in Review` on the dashboard.
- `submit-update` lets a maintainer submit a higher version of an addon they own (`verify.hello` for Verify Developer).
- `submit-invalid` shows a manifest error under `Manifest *` for invalid JSON, a bad id or the wrong addon id.
- `submit-repo` names a source repository, which needs a linked GitHub account and push access.

## How to get to it (user POV)

- Choose `Submit Addon` on `/dashboard`, or the `Submit` link on `/plugins`.
- Open `/submit`. A signed-out user is redirected to `/login`.

## Driving it with preview tools

Preconditions: a fresh seed, launched without `--no-s3`. Write the files to `/tmp/verify-web-evidence/submit/`: a `manifest.json` with `{"id":"verify.new","name":"Verify New","description":"x","authors":[{"name":"V","id":"1"}],"version":"0.1.0","main":"index.js"}`, and any small `index.js`.

- **Sign in.** Run the `scripts/session.sh user` expression, then `location.href='/submit'`.
- **Pick files.** `preview_upload` with `locator: "label:has-text('Manifest') >> xpath=following::input[@type='file'][1]"` (or the `Manifest *` input from a snapshot) and the manifest path. Do the same for `Bundle *` with `index.js`.
- **Submit.** `preview_click` `role=button[name='Submit for Review']`. The toast reads `Submitted verify.new 0.1.0 for review`, and the URL becomes `/dashboard`.
- **Side effects.** The `submission` row for `verify.new` has status `pending_review`, and the staging object `submissions/<id>/bundle` exists in MinIO. A moderator sees it in `/review`.

## Gotchas

- Verify User already has one pending listing (`verify.pending`), and the cap is 2. A third listing fails with `pending_listing_cap`.
- Leave `Source repository` empty. GitHub cannot be linked locally (fake OAuth), so any repository fails with `github_not_linked`.
- This journey is not yet driven, and the locators are from source, not from a snapshot. Confirm them on the first run and fix this file.
