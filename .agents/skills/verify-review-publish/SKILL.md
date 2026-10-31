---
name: verify-review-publish
description: "Model-check addon review publishing in apps/web (TLA+/TLC plus a replay on the real code). Use when a change touches reviewSubmission, publishArtifact or its refetch from GitHub, the store page and media copy (readPinnedStorePage, readPageMedia, writeStorePage), decide, createSubmission/stageAndReserve/reserve, the staging sweeper or ban purge, the submission/addon_version schema, or anything that writes addons/{id}/{version}/ in the public bucket; or for 'verify review publish', 'can a rejected addon end up on the CDN', 'is approve/reject race-safe'."
---

# Verify review publishing

**Promise.** The public files at `addons/{id}/{version}/` (bundle, `manifest.json`, `ADDON.md`, `page.json`, `media/`) exist only for a live `addon_version` row, the bundle's bytes match that row's `sha256`, and the other files are that row's submission's. A submission is decided at most once, and a rejected submission's bytes are never public.

**Harm when broken.** Users install a bundle no reviewer approved, or one whose hash disagrees with what the API reports.

## 1. Does your change touch the verified code?

```sh
git diff fdaa4cf5ab901faf80791e76795681099c3955a9 -- apps/web/src/lib/review.ts apps/web/src/lib/submissions.ts apps/web/src/lib/staging.ts apps/web/src/lib/github.ts apps/web/src/lib/auth/auth.ts apps/web/src/db/schema/addons.ts apps/web/src/lib/artifacts.ts apps/web/src/lib/addon-page-source.ts
```

Empty output: the verification still describes the code. Otherwise map each hunk to the coverage table below and go on.

| Code (at the sync commit)                                                                        | Model action in `spec/ReviewPublish.tla`     |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `submissions.ts` `stageAndReserve` 339-358 (staging write 349 before the row)                    | `Stage`                                      |
| `submissions.ts` `reserve` 272-337, `createSubmission` 368-387                                   | `Create`; supersede is `Purge` then `Create` |
| a staging write outside the app (no app path writes after create)                                | `Tamper` (`Evil` bytes, any time)            |
| `staging.ts` `deleteOrphans` 24-64 (grace window `STAGING_ORPHAN_GRACE_SECONDS`)                 | `Orphan`                                     |
| `staging.ts` `purgeUserSubmissions` 105-144 (ban hook `auth.ts` 129)                             | `Purge`                                      |
| `review.ts` `requirePendingReview` 160-191                                                       | `Start` (row snapshot incl. `sha256`)        |
| `review.ts` `publishArtifact` 227-248, `readBundle` 202-206, `refetchBundle` 195-200             | `ReadStaged`                                 |
| `review.ts` `readPinnedStorePage` 208-225, `addon-page-source.ts` `readPageMedia` 217-230        | `ReadStaged` (its failure branch)            |
| `artifacts.ts` `writeArtifact` 94-111                                                            | `WriteBundle`, `WriteManifest`               |
| `artifacts.ts` `writeStorePage` 120-142 (`ADDON.md`, `page.json`, `media/*`)                     | `WritePage`                                  |
| `review.ts` `decide` 319-366 (CAS 335, `publishVersion` 286-313, PKs from `db/schema/addons.ts`) | `Decide`                                     |
| `review.ts` `reviewSubmission` 377-410 (order, staged delete 398-400)                            | `pc` sequence, `Cleanup`                     |

`reserve`, `decide` and the ban's cancel are each one Postgres SERIALIZABLE transaction that `createDatabase` retries whole on a serialization failure or deadlock, so each is still one indivisible step.

Sync commit: `fdaa4cf5ab901faf80791e76795681099c3955a9`. Move it forward only after you confirm, hunk by hunk, that every row above still describes the code at the new commit, and update the line numbers in the table and in the spec comments.

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

1. **Approve racing reject leaves rejected bytes public.** Reviewer A approves: `requirePendingReview` passes and `publishArtifact` starts. Reviewer B rejects; `decide` commits `rejected` and deletes the staged bundle. A's `ctx.storage.public.write` of the bundle, `manifest.json`, `ADDON.md`, `page.json` and every `media/` file lands. A's `decide` fails the CAS (`submission_not_pending`). The files stay at `addons/{id}/{version}/` with no `addon_version` row. A ban (`purgeUserSubmissions`) in place of B does the same. Since approval refetches a missing bundle from its pin, A no longer stops when B's cleanup deleted the staged object before A read it: the window spans A's whole read. The store page copy widens it twice: more files stay public (up to `ADDON_MEDIA_TOTAL_MAX_BYTES` of media an author chose), and A's read now includes the GitHub tree and every media blob, so B has longer to commit between A's `requirePendingReview` and A's writes. Invariants `PublicOnlyIfLiveAtRest`, `RejectedNeverPublic`; replay `approve races reject` (its submission has a store page, so the media land too). A later approval does not clean this up: `writeStorePage` only adds or overwrites keys and never deletes the ones an earlier page wrote. Scenario: s1's approval races its rejection, so s1's `ADDON.md`, `page.json` and `media/a.png`, `media/b.png` land. The id is free again, and s2 for the same id and version, whose page lists only `media/a.png` (or has no `page.json`), is approved cleanly. s2 overwrites the keys it writes, but s1's `media/b.png` (or `page.json`) stays under s2's live row for good. The model records only whose page landed last, so it reports that end state as clean; TLC's outcomes do not change because the trace already broke the invariants at s1's writes. The same stray files follow findings 2 and 3 when the two pages list different files.
2. **A stale approval overwrites a live version's files.** A has read listing s1's bundle and is about to write it. s1's author is banned (TLC's shortest trace; a rejection also frees the id). A new listing s2 for the same id and version is approved by B and goes live with s2's sha256. A's writes then land, so the CDN serves s1's bundle, store page and media under s2's row. Invariant `PublicMatchesLive` in `current.cfg`.
3. **Two pending updates for one version (`SUBMISSION_MAX_PENDING_UPDATES` >= 2).** Approving the first makes it live. Approving the second rewrites the public bundle, manifest and store page, then `decide` throws on the `addon_version` primary key. The CDN serves the second's files under the first's sha256. Invariant `PublicMatchesLive` in `current-pending-updates.cfg`; replay `second pending update overwrites`.

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

Every modelled submission has a store page, the case with the most writes. `WritePage` is one action for all of `writeStorePage`'s PUTs, and `publicPage` records only whose page landed last, not which files it left (see known finding 1). Media are never staged; approval re-reads them from the pinned commit's blobs, so `Tamper` cannot reach them, and a failed or altered read only ends the request (the `Done` branch of `ReadStaged`).

The refetch is modelled as content-addressed: it yields the pinned bytes or fails, because `readBlob` checks the git blob SHA-1 (replay `approval refetches a lost bundle` runs both outcomes on the real code). `Orphan` may delete an object whose row is not inserted yet, over-approximating a create slower than the grace window.

Not modelled: first-party publishing (`first-party.ts` `publishFirstParty` 194-245), which does not copy a store page and writes `addons/{id}/{version}/` through `writeArtifact` (with compiled `.hbc` bundles beside the bundle) before `commitApproved` 127-184 re-checks the claim, and since 2574b6b5 rewrites a live version's files and row in place (`review.ts` `replaceVersion` 268-281); S3 write failures and partial writes, GitHub outages beyond a failed refetch, user deletion cascades, delist/relist, `listReviewQueue`, author's listing caps, the per-request permission checks, and liveness (a live version having its files).
