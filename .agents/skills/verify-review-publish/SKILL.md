---
name: verify-review-publish
description: "Model-check addon review publishing in apps/web (TLA+/TLC plus a replay on the real code). Use when a change touches reviewSubmission, publishArtifact or its refetch from GitHub, the store page and media copy (readPinnedStorePage, readPageMedia, writeStorePage), the extra files (readPinnedFiles, readListedFiles, listAddonFiles, writeArtifact), decide, createSubmission/stageAndReserve/reserve, the staging sweeper or ban purge, the submission/addon_version schema, or anything that writes addons/{id}/{version}/ in the public bucket; or for 'verify review publish', 'can a rejected addon end up on the CDN', 'is approve/reject race-safe'."
---

# Verify review publishing

**Promise.** The public files at `addons/{id}/{version}/` (bundle, `manifest.json`, `ADDON.md`, `page.json`, `media/`, and the extra files `assets/<sha256>.<type>` and `i18n/<code>.json`) exist only for a live `addon_version` row, the bundle's bytes match that row's `sha256`, and the other files are that row's submission's. A submission is decided at most once, and a rejected submission's bytes are never public.

**Harm when broken.** Users install a bundle no reviewer approved, or one whose hash disagrees with what the API reports.

## 1. Does your change touch the verified code?

```sh
git diff f2ee379cff17c849156404b5f9c077dc1f50e881 -- apps/web/src/lib/review.ts apps/web/src/lib/submissions.ts apps/web/src/lib/staging.ts apps/web/src/lib/github.ts apps/web/src/lib/auth/auth.ts apps/web/src/db/schema/addons.ts apps/web/src/lib/artifacts.ts apps/web/src/lib/addon-page-source.ts apps/web/src/lib/addon-files.ts packages/contracts/src/addon-files.ts
```

Empty output: the verification still describes the code. Otherwise map each hunk to the coverage table below and go on.

| Code (at the sync commit)                                                                                                     | Model action in `spec/ReviewPublish.tla`     |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `submissions.ts` `stageAndReserve` 362-381 (staging write 372 before the row; only the bundle is staged)                      | `Stage`                                      |
| `submissions.ts` `reserve` 285-360, `createSubmission` 391-432                                                                | `Create`; supersede is `Purge` then `Create` |
| a staging write outside the app (no app path writes after create)                                                             | `Tamper` (`Evil` bytes, any time)            |
| `staging.ts` `deleteOrphans` 24-64 (grace window `STAGING_ORPHAN_GRACE_SECONDS`)                                              | `Orphan`                                     |
| `staging.ts` `purgeUserSubmissions` 105-144 (ban hook `auth.ts` 135)                                                          | `Purge`                                      |
| `review.ts` `requirePendingReview` 173-204                                                                                    | `Start` (row snapshot incl. `sha256`)        |
| `review.ts` `publishArtifact` 257-282, `readBundle` 215-219, `refetchBundle` 208-213                                          | `ReadStaged`                                 |
| `review.ts` `readPinnedStorePage` 221-238, `addon-page-source.ts` `readPageMedia` 220-233                                     | `ReadStaged` (its failure branch)            |
| `review.ts` `readPinnedFiles` 241-255, `addon-files.ts` `readListedFiles` 47-104, contracts `addon-files.ts` `listAddonFiles` | `ReadStaged` (its failure branch)            |
| `artifacts.ts` `writeArtifact` 102-127: bundle 122, `manifest.json` 123-125                                                   | `WriteBundle`, `WriteManifest`               |
| `artifacts.ts` `writeArtifact` 112-118: each extra file (`assets/*`, `i18n/*`)                                                | `WriteFiles`                                 |
| `artifacts.ts` `writeStorePage` 136-158 (`ADDON.md`, `page.json`, `media/*`)                                                  | `WritePage`                                  |
| `review.ts` `decide` 363-410 (CAS 379, `publishVersion` 318-357, PKs from `db/schema/addons.ts`)                              | `Decide`                                     |
| `review.ts` `reviewSubmission` 421-454 (order, staged delete 442-444)                                                         | `pc` sequence, `Cleanup`                     |

`reserve`, `decide` and the ban's cancel are each one Postgres SERIALIZABLE transaction that `createDatabase` retries whole on a serialization failure or deadlock, so each is still one indivisible step.

Sync commit: `f2ee379cff17c849156404b5f9c077dc1f50e881`. Move it forward only after you confirm, hunk by hunk, that every row above still describes the code at the new commit, and update the line numbers in the table and in the spec comments.

## 2. Run the check

```sh
bun .agents/skills/verify-review-publish/scripts/check.ts
```

About 20 s. It runs `scripts/replay.ts` first (under 1 s), then one TLC job per expected violation plus one job per config for all invariants expected to hold. It downloads TLC 1.7.4 once to `~/.cache/tlaplus/1.7.4/tla2tools.jar` and checks sha256 `936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88`. Needs `java` on the PATH.

The replay creates throwaway Postgres databases through the web test helpers, so it needs `DATABASE_URL` (or `DATABASE_DIRECT_URL` in `apps/web/.env`) for a role with `CREATEDB` that can connect to the `postgres` database. Without one it fails with `permission denied for database "postgres"` or `No Postgres URL`; start a `postgres:18` container and a role as `.github/workflows/ci.yml` does.

Memory is shared with other services. The script runs one TLC at a time with `-Xmx3g -XX:+UseParallelGC -workers 2` and refuses to start a job under 8 GB `MemAvailable`. Never run two copies at once.

Print one counterexample as numbered steps: `bun .agents/skills/verify-review-publish/scripts/check.ts --trace current:RejectedNeverPublic`.

Exit 0 means every outcome matches the `EXPECTED` table in `scripts/check.ts` and the `violated` lists in `scripts/replay.ts`. Both describe the code at the sync commit, known findings included.

## 3. Read a FAIL

- **Replay FAIL.** `replay.ts` drives the real `reviewSubmission` over real Postgres and an in-memory bucket. A changed outcome is a change in real behaviour. `violated (expected holds)` is a new bug in your diff. `holds (expected violated)` means a finding below changed; confirm it in the model before you edit the `violated` list.
- **Model FAIL on `current*`.** Only after you changed a `.cfg` flag or the spec to describe your diff. Read the trace. If each step is something the code can do, it is a real bug. If a step is impossible in the code, the model is wrong: fix the action, citing the line that forbids the step.
- **Model FAIL on `reordered*` or `broken-*`.** You changed the spec itself. Those configs must keep failing exactly as listed, or a property has lost its ability to fail.

## 4. Update the verification for an intended change

1. Change the action that models the changed code, keeping one action per indivisible step in the code (one `await`, one transaction, one S3 call).
2. If the change matches a flag (`PublishAfterCommit`, `CasOnStatus`, `HashCheck`), flip it in `spec/current.cfg` and `spec/current-pending-updates.cfg` instead.
3. Rerun. Update `EXPECTED` and `replay.ts` only for outcomes the code now really has, and update **Known findings**.
4. Move the sync commit forward.

## Known findings at the sync commit

1. **Approve racing reject leaves rejected bytes public.** Reviewer A approves: `requirePendingReview` passes and `publishArtifact` starts. Reviewer B rejects; `decide` commits `rejected` and deletes the staged bundle. A's `ctx.storage.public.write` of the bundle, `manifest.json`, every extra file (`assets/*`, `i18n/*`), `ADDON.md`, `page.json` and every `media/` file lands. A's `decide` fails the CAS (`submission_not_pending`). The files stay at `addons/{id}/{version}/` with no `addon_version` row. A ban (`purgeUserSubmissions`) in place of B does the same. Since approval refetches a missing bundle from its pin, A no longer stops when B's cleanup deleted the staged object before A read it: the window spans A's whole read. The store page copy widens it twice: more files stay public (up to `ADDON_MEDIA_TOTAL_MAX_BYTES` of media an author chose), and A's read now includes the GitHub tree and every media blob, so B has longer to commit between A's `requirePendingReview` and A's writes. The extra files widen it the same way: `readPinnedFiles` adds a tree and a blob per file to A's read, and up to `ADDON_MEDIA_TOTAL_MAX_BYTES` more stays public. Invariants `PublicOnlyIfLiveAtRest`, `RejectedNeverPublic`; replay `approve races reject` (its submission has a store page and one image and one locale, so the media and both extra files land too). A later approval does not clean this up: `writeStorePage` and `writeArtifact` only add or overwrite keys and never delete the ones an earlier approval wrote, so a rejected submission's `i18n/<code>.json` for a locale the next one does not list, or its content-named images, stay under the next live row. Scenario: s1's approval races its rejection, so s1's `ADDON.md`, `page.json` and `media/a.png`, `media/b.png` land. The id is free again, and s2 for the same id and version, whose page lists only `media/a.png` (or has no `page.json`), is approved cleanly. s2 overwrites the keys it writes, but s1's `media/b.png` (or `page.json`) stays under s2's live row for good. The model records only whose page and extra files landed last, so it reports that end state as clean; TLC's outcomes do not change because the trace already broke the invariants at s1's writes. The same stray files follow findings 2 and 3 when the two pages list different files.
2. **A stale approval overwrites a live version's files.** A has read listing s1's bundle and is about to write it. s1's author is banned (TLC's shortest trace; a rejection also frees the id). A new listing s2 for the same id and version is approved by B and goes live with s2's sha256. A's writes then land, so the CDN serves s1's bundle, extra files, store page and media under s2's row. Invariant `PublicMatchesLive` in `current.cfg`.
3. **Two pending updates for one version (`SUBMISSION_MAX_PENDING_UPDATES` >= 2).** Approving the first makes it live. Approving the second rewrites the public bundle, manifest, extra files and store page, then `decide` throws on the `addon_version` primary key. The CDN serves the second's files under the first's sha256. Invariant `PublicMatchesLive` in `current-pending-updates.cfg`; replay `second pending update overwrites`.

`PublicOnlyIfLive` also fails in the window between `publishArtifact`'s writes and `decide`'s commit on every approval. The `reordered` configs (writes after the commit) satisfy all six invariants.

## Configs and bounds

One addon id, versions `v1`/`v2`, bytes are the honest bundle or `Evil`.

| Config                                   | Subs                    | Reviewers | Flags                 | Role                      |
| ---------------------------------------- | ----------------------- | --------- | --------------------- | ------------------------- |
| `current`                                | 2 on v1                 | 2         | as the code           | findings 1, 2             |
| `current-pending-updates`                | 1 on v1, 2 on v2, cap 2 | 1         | as the code           | finding 3                 |
| `reordered`, `reordered-pending-updates` | same as above           | same      | `PublishAfterCommit`  | candidate fix holds       |
| `broken-no-cas`                          | 2 on v1                 | 2         | reordered, no CAS     | `DecidedOnce` can fail    |
| `broken-no-hash-check`                   | 2 on v1                 | 2         | reordered, no re-hash | `LiveIsReviewed` can fail |

Reviewers are symmetric (`SYMMETRY ReviewerSymmetry`). `reordered-pending-updates` with 2 reviewers took 126 s and 9.8 M states, so it runs with 1. Keep every job under 2 minutes: shrink bounds before raising heap.

Every modelled submission has a store page and extra files, the case with the most writes. `WritePage` is one action for all of `writeStorePage`'s PUTs and `WriteFiles` one for all of `writeArtifact`'s extra-file PUTs; `publicPage` and `publicFiles` record only whose files landed last, not which files they left (see known finding 1). Media and extra files are never staged; approval re-reads them from the pinned commit's blobs, so `Tamper` cannot reach them, and a failed or altered read only ends the request (the `Done` branch of `ReadStaged`). Extra files are the images in `manifest.assets` and the locales in `manifest.locales`, as `listAddonFiles` lists them; `readListedFiles` checks each against the SHA-256 the row's manifest lists, and a locale against a JSON object of strings, before any write. Replay `approval checks extra files` runs an altered locale, a non-string locale and an honest pair on the real code; only the honest version's files go public, and they match the manifest's digests. The `WriteFiles` break used to prove the properties still see these files: in `reordered`, keeping only the extra-file PUTs before `decide` makes `RejectedNeverPublic` and `PublicMatchesLive` fail.

The refetch is modelled as content-addressed: it yields the pinned bytes or fails, because `readBlob` checks the git blob SHA-1 (replay `approval refetches a lost bundle` runs both outcomes on the real code). `Orphan` may delete an object whose row is not inserted yet, over-approximating a create slower than the grace window.

Not modelled: first-party publishing (`first-party.ts` `publishFirstParty` 212-272), which writes `addons/{id}/{version}/` through `writeArtifact` (with compiled `.hbc` bundles and the extra files `readAddonSource` read and checked with `readListedFiles` beside the bundle) and `writeStorePage` (the page and media `readAddonSource` read and checked at the build commit, via `readAddonPage`) before `commitApproved` 145-202 re-checks the claim, and since 2574b6b5 rewrites a live version's files and row in place (`review.ts` `replaceVersion` 292-305; a changed extra file also counts as a rebuild, `sameFiles` 46-53); S3 write failures and partial writes, GitHub outages beyond a failed refetch, user deletion cascades, delist/relist, `listReviewQueue`, author's listing caps, the per-request permission checks, and liveness (a live version having its files).
