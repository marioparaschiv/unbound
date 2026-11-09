# bench-android

A/B benchmark of client builds on the rooted Android emulator (the `ubd-avd` AVD).

```sh
cd packages/client
bun scripts/bench-android/index.ts \
  --variant base:UNBOUND_LAZY_MODULES=0 \
  --variant lazy:UNBOUND_LAZY_MODULES=proxy \
  --rounds 3 --per-block 3
```

The first variant is the baseline. Each variant is `name[:KEY=VALUE,...]`, built from this checkout with those env vars.

## What it does

1. Builds each variant with `UNBOUND_BENCH=1`, which adds the agent (`agent.ts`) as the first module, startup marks in `src/core`, and a trace call at the top of every source module (`--no-trace` drops it).
2. Backs up `settings.json`, then points the loader at the harness's server (`http://10.0.2.2:3390/<variant>/`), turns the debugger and hot reload off, and disables plugins (`--plugins keep` leaves them).
3. Runs the variants in blocks, alternating the order each round (A B, B A, ...). A block starts with a warm-up launch that downloads the variant's bundle; the measured launches then run it from the cache.
4. Each launch: the agent records marks, Hermes heap counters, module loads and timer lag, waits `--idle-ms`, walks the settings screens for `--step-ms` each, then POSTs its report. The harness reads Discord's process start time and `dumpsys meminfo`.
5. Restores `settings.json`, deletes the bench bundle, and relaunches Discord on its dev server.

A launch is invalid when Discord restarts, another bundle ran, Unbound failed to initialize, or a screen did not open.

## Output

`--out` (default `/tmp/ubd-bench/<time>`): `report.md`, `records.json`, `runs/*.json`, `builds/`. `--report-only <dir>` re-renders a report.

## Reading the report

- Times are milliseconds after Discord's process started (10 ms resolution).
- `ms Unbound holds startup` is the synchronous block between Discord's main module and its first render.
- Module counts come from the trace; self times are the gap to the next module body in the same burst.
- Run an A/A first (two variants with the same env) to see the noise floor; on the shared host a single launch varies by ±15%.
