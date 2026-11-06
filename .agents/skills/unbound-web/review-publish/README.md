# Verify review publishing

**Promise.** The public files at `addons/{id}/{version}/` (bundle, `manifest.json`, `ADDON.md`, `page.json`, `media/`, and the extra files `assets/<sha256>.<type>` and `i18n/<code>.json`) exist only for a live `addon_version` row, the bundle's bytes match that row's `sha256`, and the other files are that row's submission's. A submission is decided at most once, and a rejected submission's bytes are never public.

**Harm when broken.** Users install a bundle no reviewer approved, or one whose hash disagrees with what the API reports.

## 1. Does your change touch the verified code?

```sh
bun .agents/skills/unbound-web/review-publish/scripts/touched.ts
```

`unchanged` (exit 0): the verification still describes the code. Otherwise it lists each changed hunk with the model actions it overlaps in [COVERAGE.md](COVERAGE.md) (exit 1); update the spec for those actions, then go on.

## 2. Run the check

```sh
bun .agents/skills/unbound-web/review-publish/scripts/check.ts
```

About 2 min (`current-liveness` is about 65 s). It runs `scripts/replay.ts` first (under 1 s), then one TLC job per expected violation plus one job per config for all invariants expected to hold. It downloads TLC 1.7.4 once to `~/.cache/tlaplus/1.7.4/tla2tools.jar` and checks sha256 `936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88`. Needs `java` on the PATH.

The replay creates throwaway Postgres databases through the web test helpers, so it needs `DATABASE_URL` (or `DATABASE_DIRECT_URL` in `apps/web/.env`) for a role with `CREATEDB` that can connect to the `postgres` database. Without one it fails with `permission denied for database "postgres"` or `No Postgres URL`; start a `postgres:18` container and a role as `.github/workflows/ci.yml` does.

Memory is shared with other services. The script runs one TLC at a time with `-Xmx3g -XX:+UseParallelGC -workers 2` and refuses to start a job under 8 GB `MemAvailable`. Never run two copies at once.

Print one counterexample as numbered steps: `bun .agents/skills/unbound-web/review-publish/scripts/check.ts --trace current:RejectedNeverPublic` (or `broken-no-recovery:LiveEventuallyPublic`).

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

## Reference

- [CONFIGS.md](CONFIGS.md): each TLC config, its bounds and what it checks.
- [FINDINGS.md](FINDINGS.md): the bugs the model found, all fixed at the sync commit.
