# Coverage: code to model actions

Rows are read by `scripts/touched.ts`; keep the `file` `function` start-end shape.

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
