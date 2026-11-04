---
name: verify-review-publish
description: "Model-check addon review publishing in apps/web (TLA+/TLC plus a replay on the real code). Use when a change touches reviewSubmission, readArtifact, publishArtifact or its refetch from GitHub, the store page and media copy (readPinnedStorePage, readPageMedia, writeStorePage), the extra files (readPinnedFiles, readListedFiles, listAddonFiles, writeArtifact), decide, createSubmission/stageAndReserve/reserve, the staging sweeper or ban purge, the submission/addon_version schema, or anything that writes addons/{id}/{version}/ in the public bucket; or for 'verify review publish', 'can a rejected addon end up on the CDN', 'is approve/reject race-safe'."
---

# Verify review publishing

**Promise.** The public files at `addons/{id}/{version}/` (bundle, `manifest.json`, `ADDON.md`, `page.json`, `media/`, and the extra files `assets/<sha256>.<type>` and `i18n/<code>.json`) exist only for a live `addon_version` row, the bundle's bytes match that row's `sha256`, and the other files are that row's submission's. A submission is decided at most once, and a rejected submission's bytes are never public.

**Harm when broken.** Users install a bundle no reviewer approved, or one whose hash disagrees with what the API reports.

## 1. Does your change touch the verified code?

```sh
git diff 77160c8d5ecf8894ae607b385fb6c081fa31be53 -- apps/web/src/lib/review.ts apps/web/src/lib/submissions.ts apps/web/src/lib/staging.ts apps/web/src/lib/github.ts apps/web/src/lib/auth/auth.ts apps/web/src/db/schema/addons.ts apps/web/src/lib/artifacts.ts apps/web/src/lib/addon-page-source.ts apps/web/src/lib/addon-files.ts packages/contracts/src/addon-files.ts
```

Empty output: the verification still describes the code. Otherwise map each hunk to the coverage table below and go on.

| Code (at the sync commit)                                                                                                                                                                                    | Model action in `spec/ReviewPublish.tla`     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `submissions.ts` `stageAndReserve` 362-381 (staging write 372 before the row; only the bundle is staged)                                                                                                     | `Stage`                                      |
| `submissions.ts` `reserve` 285-360, `createSubmission` 391-432                                                                                                                                               | `Create`; supersede is `Purge` then `Create` |
| a staging write outside the app (no app path writes after create)                                                                                                                                            | `Tamper` (`Evil` bytes, any time)            |
| `staging.ts` `deleteOrphans` 24-75 (grace window `STAGING_ORPHAN_GRACE_SECONDS`; keeps an approved submission's bundle while its version is unpublished, which the model leaves out: `Orphan` may delete it) | `Orphan`                                     |
| `staging.ts` `purgeUserSubmissions` 116-155 (ban hook `auth.ts` 135)                                                                                                                                         | `Purge`                                      |
| `review.ts` `requireReviewable` 187-221                                                                                                                                                                      | `Start` (row snapshot incl. `sha256`)        |
| `review.ts` `isRepublish` 226-241 (an approved submission whose unpublished `addon_version` row names it, any reviewer)                                                                                      | `RetryStart`                                 |
| `review.ts` `readArtifact` 303-323, `readBundle` 252-256, `refetchBundle` 245-250                                                                                                                            | `ReadOk`, `ReadFail`                         |
| `review.ts` `readPinnedStorePage` 258-275, `addon-page-source.ts` `readPageMedia` 220-233                                                                                                                    | `ReadFail`                                   |
| `review.ts` `readPinnedFiles` 278-292, `addon-files.ts` `readListedFiles` 47-104, contracts `addon-files.ts` `listAddonFiles`                                                                                | `ReadFail`                                   |
| `artifacts.ts` `writeArtifact` 102-127: bundle 122, `manifest.json` 123-125                                                                                                                                  | `WriteBundle`, `WriteManifest`               |
| `artifacts.ts` `writeArtifact` 112-118: each extra file (`assets/*`, `i18n/*`)                                                                                                                               | `WriteFiles`                                 |
| `artifacts.ts` `writeStorePage` 136-158 (`ADDON.md`, `page.json`, `media/*`)                                                                                                                                 | `WritePage`                                  |
| `review.ts` `decide` 423-470 (CAS 439, `publishVersion` 455, PKs from `db/schema/addons.ts`)                                                                                                                 | `Decide`                                     |
| `review.ts` `reviewSubmission` 482-516 (read, `decide` unless republishing, then `publishArtifact` 327-340, staged delete 504-506)                                                                           | `pc` sequence, `Cleanup`, `WriteFail`        |

`reserve`, `decide` and the ban's cancel are each one Postgres SERIALIZABLE transaction that `createDatabase` retries whole on a serialization failure or deadlock, so each is still one indivisible step.

Sync commit: `77160c8d5ecf8894ae607b385fb6c081fa31be53`. Move it forward only after you confirm, hunk by hunk, that every row above still describes the code at the new commit, and update the line numbers in the table and in the spec comments.

## 2. Run the check

```sh
bun .agents/skills/verify-review-publish/scripts/check.ts
```

About 2 min (`current-liveness` is about 65 s). It runs `scripts/replay.ts` first (under 1 s), then one TLC job per expected violation plus one job per config for all invariants expected to hold. It downloads TLC 1.7.4 once to `~/.cache/tlaplus/1.7.4/tla2tools.jar` and checks sha256 `936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88`. Needs `java` on the PATH.

The replay creates throwaway Postgres databases through the web test helpers, so it needs `DATABASE_URL` (or `DATABASE_DIRECT_URL` in `apps/web/.env`) for a role with `CREATEDB` that can connect to the `postgres` database. Without one it fails with `permission denied for database "postgres"` or `No Postgres URL`; start a `postgres:18` container and a role as `.github/workflows/ci.yml` does.

Memory is shared with other services. The script runs one TLC at a time with `-Xmx3g -XX:+UseParallelGC -workers 2` and refuses to start a job under 8 GB `MemAvailable`. Never run two copies at once.

Print one counterexample as numbered steps: `bun .agents/skills/verify-review-publish/scripts/check.ts --trace current:RejectedNeverPublic` (or `broken-no-recovery:LiveEventuallyPublic`).

Exit 0 means every outcome matches the `EXPECTED` and `EXPECTED_LIVENESS` tables in `scripts/check.ts` and the `violated` lists in `scripts/replay.ts`. Both describe the code at the sync commit: `current*` and every replay hold; `before-fix*` and `broken-*` fail as listed.

## 3. Read a FAIL

- **Replay FAIL.** `replay.ts` drives the real `reviewSubmission` over real Postgres and an in-memory bucket. A changed outcome is a change in real behaviour. `violated (expected holds)` is a new bug in your diff. `holds (expected violated)` means a behaviour you listed as violated changed; confirm it in the model before you edit the `violated` list.
- **Model FAIL on `current*`.** Any failure is a real bug unless you changed a `.cfg` flag or the spec to describe your diff. Read the trace. If each step is something the code can do, it is a real bug. If a step is impossible in the code, the model is wrong: fix the action, citing the line that forbids the step.
- **Model FAIL on `before-fix*` or `broken-*`.** You changed the spec itself. Those configs must keep failing exactly as listed, or a property has lost its ability to fail.

## 4. Update the verification for an intended change

1. Change the action that models the changed code, keeping one action per indivisible step in the code (one `await`, one transaction, one S3 call).
2. If the change matches a flag (`PublishAfterCommit`, `CasOnStatus`, `HashCheck`), flip it in `spec/current.cfg` and `spec/current-pending-updates.cfg` instead; `before-fix*` keep `PublishAfterCommit = FALSE`.
3. Rerun. Update `EXPECTED` and `replay.ts` only for outcomes the code now really has, and update **Findings**.
4. Move the sync commit forward.

## Findings, all fixed at the sync commit

The code once wrote `addons/{id}/{version}/` inside `publishArtifact` before `decide` committed. `reviewSubmission` now reads and verifies (`readArtifact`), commits (`decide`), and only then writes (`publishArtifact`). The CAS on `status = 'pending_review'` and the `addon_version` primary key decide who wins before any byte is public, so a request that loses writes nothing. `before-fix*` keep the old order; TLC still fails it, and the replays below failed on it.

1. **Approve racing reject or ban left rejected files public** (bundle, manifest, extra files, store page, media). A read the loser had started could still land its writes after the winner committed. Fixed: the loser fails the CAS before writing. Invariants `PublicOnlyIfLiveAtRest`, `RejectedNeverPublic`; replay `approve races reject` holds the approval in its staged read.
2. **A stale approval overwrote a live version's files.** s1's approval was read, s1's author banned, s2 for the same version approved, then s1's writes landed under s2's row. Fixed the same way. Invariant `PublicMatchesLive`; replay `stale approval overwrites a live version`.
3. **Two pending updates for one version** (`SUBMISSION_MAX_PENDING_UPDATES` >= 2): the second approval rewrote the first's live files and then failed on the `addon_version` key. Fixed: `decide` throws first. Replay `second pending update overwrites`.

4. **A public write that fails after `decide` committed left a live version without its files for good** (the cost of the order above). Fixed: any reviewer repeating the approval on the approved submission, while its `addon_version` row still names it and `files_pending_since` is set (`isRepublish`; `publishVersion` sets it in `decide`'s transaction, `publishArtifact` clears it after the writes), skips `decide` and runs the same read, verify and `publishArtifact`, which overwrites every key with the verified bytes. One nullable column, no new write path: the only writer is still `publishArtifact` after a verified read, for a row `decide` already committed, and a version another submission replaced is refused. Model: `WriteFail` (at most `MaxWriteFailures` per run, partial writes allowed) and `RetryStart`; `current*` keep all six invariants with failures. Liveness `LiveEventuallyPublic` (a live version eventually has all four public file groups) holds in `current-liveness` under fair retries and read, write, decide and cleanup steps (`LiveSpec`); `broken-no-recovery` (`Recovery = FALSE`) violates it. The staff review queue lists an approved submission while the column is set, so a reload still offers the retry. Replay `failed publish recovers`: the first public write fails, the queue (a fresh request) still lists the approval, a rejection is refused, another reviewer's retry publishes every file with the live row's sha256 and takes it off the queue, and a second repeat is refused.

Limits of the recovery proof: `current-liveness` sets `AllowTamper = FALSE`, because a staged object changed outside the app and never replaced fails every re-hash and blocks any approval or retry (`readBundle` prefers the staged object over the pinned blob); and it needs someone to repeat the request, the fairness assumption, since nothing retries on its own (the queue keeps offering the retry, but a reviewer still has to click). The model drops the `files_pending_since` guard and the sweeper's keep rule, which only narrow `RetryStart` and `Orphan`. `deleteOrphans` keeps the staged bundle of an approved submission only while its version is unpublished; recovery does not need it, as `readBundle` refetches the pinned blob and `readArtifact` re-hashes it (`Orphan`, replay `approval refetches a lost bundle`). A repeat with a GitHub outage and a swept bundle fails and can be repeated. The model has no first-party `replaceVersion`: a repeat that races it is outside the model.

`PublicOnlyIfLive` holds too: the files appear only after the row exists. The one window left is a live row whose files are not yet written.

## Configs and bounds

One addon id, versions `v1`/`v2`, bytes are the honest bundle or `Evil`.

| Config                                     | Subs                    | Reviewers | Flags                                                 | Role                                                                                    |
| ------------------------------------------ | ----------------------- | --------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `current`                                  | 2 on v1                 | 2         | as the code                                           | all hold                                                                                |
| `current-pending-updates`                  | 1 on v1, 2 on v2, cap 2 | 1         | as the code                                           | all hold                                                                                |
| `before-fix`, `before-fix-pending-updates` | same as above           | same      | writes before `decide`                                | findings 1-3 reproduce                                                                  |
| `broken-no-cas`                            | 2 on v1                 | 2         | fixed order, no CAS                                   | `DecidedOnce` can fail                                                                  |
| `broken-no-hash-check`                     | 2 on v1                 | 2         | fixed, no re-hash                                     | `LiveIsReviewed`, and a repeat publishing tampered bytes (`PublicMatchesLive`) can fail |
| `current-liveness`                         | 2 on v1                 | 2         | as the code, `LiveSpec`, no `Tamper`, 1 write failure | `LiveEventuallyPublic` holds                                                            |
| `broken-no-recovery`                       | same                    | same      | `Recovery = FALSE`                                    | `LiveEventuallyPublic` fails                                                            |

Reviewers are symmetric (`SYMMETRY ReviewerSymmetry`). `current-pending-updates` with 2 reviewers took 126 s and 9.8 M states, so it runs with 1. Keep every job under 2 minutes: shrink bounds before raising heap.

Every modelled submission has a store page and extra files, the case with the most writes. `WritePage` is one action for all of `writeStorePage`'s PUTs and `WriteFiles` one for all of `writeArtifact`'s extra-file PUTs; `publicPage` and `publicFiles` record only whose files landed last, not which files they left (see known finding 1). Media and extra files are never staged; approval re-reads them from the pinned commit's blobs, so `Tamper` cannot reach them, and a failed or altered read only ends the request (the `Done` branch of `ReadStaged`). Extra files are the images in `manifest.assets` and the locales in `manifest.locales`, as `listAddonFiles` lists them; `readListedFiles` checks each against the SHA-256 the row's manifest lists, and a locale against a JSON object of strings, before any write. Replay `approval checks extra files` runs an altered locale, a non-string locale and an honest pair on the real code; only the honest version's files go public, and they match the manifest's digests. The `WriteFiles` break used to prove the properties still see these files: in `current`, keeping only the extra-file PUTs before `decide` makes `RejectedNeverPublic` and `PublicMatchesLive` fail.

The refetch is modelled as content-addressed: it yields the pinned bytes or fails, because `readBlob` checks the git blob SHA-1 (replay `approval refetches a lost bundle` runs both outcomes on the real code). `Orphan` may delete an object whose row is not inserted yet, over-approximating a create slower than the grace window.

Not modelled: first-party publishing (`first-party.ts` `publishFirstParty` 212-272), which writes `addons/{id}/{version}/` through `writeArtifact` (with compiled `.hbc` bundles and the extra files `readAddonSource` read and checked with `readListedFiles` beside the bundle) and `writeStorePage` (the page and media `readAddonSource` read and checked at the build commit, via `readAddonPage`) before `commitApproved` 145-202 re-checks the claim, and since 2574b6b5 rewrites a live version's files and row in place (`review.ts` `replaceVersion` 345-358; a changed extra file also counts as a rebuild, `sameFiles` 46-53); GitHub outages beyond a failed refetch, user deletion cascades, delist/relist, `listReviewQueue`, author's listing caps, the per-request permission checks, the Postgres side of a failed `decide` (it is one transaction).
