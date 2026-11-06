# Review queue

A moderator or admin sees pending listings and updates at `/review`, inspects the manifest and staged bundle, and approves, rejects or requests changes. Approval publishes the bundle and manifest to the CDN and lists the addon.

## Sub-features

- `review-list` shows each pending submission as a card with `Review details`, `Preview page` and the three decisions. `Review details` opens an accordion, one section at a time: `Changelog`, `Manifest details` (a listing) or `Manifest changes` (an update, changed fields only), `ADDON.md`, and `Source and bundle` with `Download staged bundle` and `Bundle at <sha>`.
- `review-preview` opens `/addons/<id>?submission=<id>` in the same tab: the public page as published, behind a `Previewing the submitted v…` bar whose `Exit preview` goes back. Only reviewers get it; anyone else sees the live page or a 404.
- `review-filter` uses the `All`, `New listings` and `Updates` links (`/review?kind=listing|update`).
- `review-approve` approves the submission. The queue empties, the row becomes `approved`, the CDN serves `addons/<id>/<version>/manifest.json`, and the author becomes `developer`.
- `review-reject` and `review-changes` open a dialog that needs a reason and moves the row out of the queue.

## How to get to it (user POV)

- Sign in as a moderator or admin, open the account menu or the staff tabs, and choose `Review Queue`.
- Go to `/review` directly. A signed-out user is redirected to `/login`, and a plain user to `/`.

## Driving it with preview tools

Preconditions: a fresh seed, so `verify.pending` 0.1.0 is pending and its bundle is staged.

- **Sign in.** `preview_open` `<URL>/login`, then `preview_evaluate` the output of `scripts/session.sh moderator` followed by `location.href='/review'`. The header shows `Verify Moderator`, and a heading `Verify Pending` is in `main`.
- **Approve.** `preview_click` `role=button[name='Approve']`. A dialog titled `Approve Verify Pending 0.1.0?` opens with an optional note textarea. Then `preview_click` `role=dialog >> role=button[name='Approve']`. `main` reads `Nothing to review` and `The queue is empty.`
- **Reject or request changes.** Click `Reject` or `Request Changes`. Fill the textarea (placeholder `Explain why this submission is rejected...` or `Describe what the author must change...`), then confirm with the dialog's button of the same name.
- **Side effects.** Query the DB with `select addon_id,status,reviewer_id from submission`. The row should be `approved` with a reviewer. `curl http://$MINIO_ADDR/unbound-addons/addons/verify.pending/0.1.0/manifest.json` should return 200. After approval, `/api/v1/addons` lists `verify.pending`.

## Gotchas

- Snapshot after `scrollTo(0,0)`. The page keeps its scroll position after the action, so a saved screenshot can show only the footer.
- Each decision consumes the only pending submission. Relaunch before driving the next decision.
- Under `--no-s3`, Approve fails: with no staged object, approval reads the pinned blob from the fake GitHub, and the seeded `verify.pending` pin names no real blob there. A submission made through `/submit` refetches fine, but publishing still writes to MinIO.
