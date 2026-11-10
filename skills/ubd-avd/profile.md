# Profiling Unbound's startup on the AVD

`packages/client/scripts/bench-android` launches Discord repeatedly with a benchmark build and sends each launch to SigNoz as one OTel trace. Flags and the markdown report are in its `README.md`. iOS benchmarks: `ubd-vphone`'s `bench.md`.

## Run

1. Boot the AVD and check that `scripts/ready.sh` exits 0 (`loop.md`). The harness backs up `settings.json`, points the loader at its own server on `:3390`, and restores the file when it exits, Ctrl-C included.
2. Start it as a user unit. A foreground build can get OOM-killed on this host. adb and `ANDROID_HOME` must be in the unit's environment:

    ```sh
    cd packages/client
    systemd-run --user --unit=ubd-bench -p MemoryMax=12G --working-directory=$PWD \
      -E PATH=/home/dev/android-sdk/platform-tools:$PATH -E ANDROID_HOME=/home/dev/android-sdk \
      bun scripts/bench-android/index.ts --variant branch --rounds 1 --per-block 8 \
        --plugins keep --no-scenario --idle-ms 15000 --out /tmp/ubd-bench/<name>
    ```

    `--plugins keep` profiles the installed plugins. Leave it out to profile core alone. Each launch takes about 20 s with `--no-scenario`.

3. Read traces as launches finish. You do not have to wait for the run to end. The harness prints `tracing each launch to … bench.run=<name>`. Done when SigNoz lists one `launch` trace per `#N branch: ok` line.

## Where the traces go

- The collector is SigNoz's `signoz-otel-collector` at `http://localhost:4318`. Change it with `--otel <url>` or `OTEL_EXPORTER_OTLP_ENDPOINT`; `--otel off` turns export off.
- UI: https://vps.stoat-ordinal.ts.net:4443 → Traces, service `unbound-client-bench`, filter on `bench.run`.
- To rank spans by median across launches, query ClickHouse directly:

    ```sh
    sudo docker exec signoz-clickhouse clickhouse-client -q "
      select name, count() n, round(quantile(0.5)(duration_nano)/1e6,1) p50, round(quantile(0.9)(duration_nano)/1e6,1) p90
      from signoz_traces.distributed_signoz_index_v3
      where serviceName='unbound-client-bench' and attributes_string['bench.run']='<name>'
      group by name order by p50 desc limit 30 format PrettyCompactMonoBlock"
    ```

- To send a finished run again (for example one recorded before export existed), call `exportLaunch` from `otel.ts` on each `runs/*.json` in its `--out` directory.

## What each span is

Spans nest by time: each one sits under the shortest span that contains it.

| Span                                                  | Source                                                                                                            |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `launch`                                              | Discord's process start to the agent's last window. Unpaired marks (`ready:start`, `firstFrame`) are events on it |
| `window bundle`, `startup`, `afterFirstFrame`, `idle` | The agent's windows (`agent.ts`), with module count and JS-thread lag attributes                                  |
| `initialize`                                          | `initialize()` in `src/core/index.ts`                                                                             |
| `built-in <name>`, `manager <kind>`                   | `benchSpan` around each built-in's `start` and each addon manager's `initialize`                                  |
| `addon <id> eval`, `addon <id> start`                 | Plugin bundle or bytecode evaluation (`plugins/manager.ts`), then its `start` (`addons/lifecycle.ts`)             |
| `module <path>`                                       | A client module body, start to end; the bench build plugin wraps every `src` file                                 |
| `discord <path>` or `discord <id> [export keys]`      | A Discord Metro factory run (`metro/search.ts`); library modules have no path, so their exports name them         |
| `metro find <cache key>`, `library <props>`           | A metro search, and a shimmed library such as `react-native-reanimated` resolving on first use                    |

Self time is a span's time minus its children. A client module with a large total but zero self time only triggered Discord modules. Before you count that time as Unbound's cost, check whether Discord loads those modules later anyway with a `lazy:UNBOUND_LAZY_MODULES=proxy` variant.

To time something new, wrap it in `benchSpan('<name>', () => work())` from `~/core/bench-span`. For frequent tiny work, use `benchTotal`: it sums time per launch into `## Summed totals` and the `bench.total.*` attributes on `launch`. Outside a benchmark build, both just call `work`. To print one launch's tree, run `nestSpans(launchSpans(record))` from `spans.ts` on a `runs/*.json` file.

`window afterFirstFrame` also contains Discord's own work. Compare it with `discord: first render` in `report.md` before you blame Unbound for it.
