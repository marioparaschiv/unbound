# Submit an addon

A signed-in user with a linked GitHub account picks a repository on `/submit`, then an addon and a ref. The page previews what reviewers will see (the pin, the bundle size and SHA-256, the typed changelog, ADDON.md and the GitHub details) and submits it. The server reads every file from GitHub at the commit and stages the bundle itself. The user lands on `/dashboard` with a toast, and the submission appears in `/review`.

## Sub-features

- `submit-repository` lists the repositories the linked account can push to, or takes a pasted URL or `owner/name`.
- `submit-addons` lists the repository's addons at the default branch, each with its issues; an addon with issues cannot be previewed. The ref field re-reads another branch, tag or SHA, and offers the latest release tag.
- `submit-preview` shows kind, manifest name and version, the pin as `owner/repo@sha` linked to the tree, the bundle, the changelog lists and ADDON.md as text. Homepage and tags are editable.
- `submit-listing` submits a first version of a new id. It appears under `New Listings in Review` on the dashboard.
- `submit-update` lets a maintainer submit a higher version of an addon they own (`verify.hello` 1.1.0 for Verify Developer).
- `submit-unlinked` shows only the `Link GitHub` call to action without a linked account.

## How to get to it (user POV)

- Choose `Submit Addon` on `/dashboard`, or the `Submit` link on `/plugins`.
- Choose `Republish` on a dashboard row with changes requested: the dialog reads the same repository and directory again.
- Open `/submit`. A signed-out user is redirected to `/login`.

## Driving it with preview tools

Preconditions: a fresh seed, launched without `--no-s3`.

- **Sign in.** Run the `scripts/session.sh user` expression, then `location.href='/submit'`. `Repositories you can push to` lists `verify/addons`.
- **Read the repository.** `preview_click` `role=button[name='verify/addons']`. The list shows `Verify Broken` with `plugins/verify.broken/dist/index.js is not committed at …`, `Verify Hello` and `Verify New`.
- **Preview.** `preview_click` `li:has-text("verify.new 0.1.0") >> role=button[name='Preview']`. The preview reads `NEW LISTING`, `verify/addons@<sha> · plugins/verify.new · main`, `33 bytes`, `Added` and `Fixed` lists and the ADDON.md text.
- **Submit.** `preview_click` `role=button[name='Submit for Review']`. The toast reads `Submitted verify.new 0.1.0 for review`, and the URL becomes `/dashboard`.
- **Side effects.** The `submission` row for `verify.new` is `pending_review` with `repository` `verify/addons`, and its `submission_source` row has the commit. The staging object `submissions/<id>/bundle` holds `console.log('verify.new 0.1.0');`. A moderator sees it in `/review`.

## Gotchas

- Verify User already has one pending listing (`verify.pending`), and the cap is 2. A third listing fails with `pending_listing_cap`.
- Read page text with `preview_evaluate` (`document.body.innerText`). `preview_snapshot` output is dominated by vite's module requests.
