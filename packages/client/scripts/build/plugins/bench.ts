import { join, relative } from 'node:path';
import type { Plugin } from 'rolldown';

/** What a benchmark build bakes in for `scripts/bench-android`'s agent. */
export type BenchConfig = {
	/** The variant name the agent reports, so the harness can prove which build ran. */
	variant: string;
	/** Where the agent POSTs its reports, as the device reaches the harness. */
	reportUrl: string;
	/** Whether every source module reports when its body starts running. */
	trace: boolean;
	/** How long after the bundle starts the idle sample is taken. */
	idleMs: number;
	/** How long each scenario screen settles before it is sampled. */
	stepMs: number;
	/** Whether the agent walks the settings screens after the idle sample. */
	scenario: boolean;
	/** The settings routes the walk opens, in order; each needs no route params. */
	screens: string[];
};

// The overview's sections. Font group and store page screens need params, and open broken without them.
const SCREENS = ['GENERAL', 'PLUGINS', 'DESIGN', 'MARKETPLACE', 'UPDATES', 'TOASTS', 'CLOUD_SYNC'];

const SOURCE = /\/src\/.*\.[jt]sx?$/;
const AGENT = /\/scripts\/bench-android\/agent\.ts$/;

/** The identifier the agent reads its config from; the build swaps it for the config's JSON. */
export const CONFIG_TOKEN = '__UBD_BENCH_CONFIG__';

/**
 * @description Reads the benchmark config from `UNBOUND_BENCH_*`; a build without `UNBOUND_BENCH=1` has none.
 * @returns The config, or `undefined` for a normal build.
 */
export function benchConfig(): BenchConfig | undefined {
	if (process.env.UNBOUND_BENCH !== '1') return;

	return {
		variant: process.env.UNBOUND_BENCH_VARIANT ?? 'unnamed',
		reportUrl: process.env.UNBOUND_BENCH_REPORT ?? 'http://10.0.2.2:3390/report',
		trace: process.env.UNBOUND_BENCH_TRACE !== '0',
		idleMs: Number(process.env.UNBOUND_BENCH_IDLE_MS ?? 20_000),
		stepMs: Number(process.env.UNBOUND_BENCH_STEP_MS ?? 3_000),
		scenario: process.env.UNBOUND_BENCH_SCENARIO !== '0',
		screens: (process.env.UNBOUND_BENCH_SCREENS?.split(',') ?? SCREENS).map(
			(name) => `UNBOUND_${name}`,
		),
	};
}

/**
 * @description Makes a benchmark build: runs the agent before the entry's other imports, and with `trace` has
 * every source module call the agent when its body starts.
 * @param root The client package root.
 * @param config The baked-in config.
 * @returns A rolldown plugin.
 */
export default function bench(root: string, config: BenchConfig): Plugin {
	const agent = join(root, 'scripts', 'bench-android', 'agent.ts');
	const entry = join(root, 'src', 'core', 'entry.ts');

	return {
		name: 'bench',
		transform: {
			// Virtual modules (`\0`) such as lazy-module handles are not source files.
			filter: { id: { include: [SOURCE, AGENT], exclude: /node_modules|\0/ } },
			handler(code, id) {
				if (id === agent) {
					return {
						code: code.replaceAll(CONFIG_TOKEN, `(${JSON.stringify(config)})`),
						map: null,
					};
				}

				const head = id === entry ? `import ${JSON.stringify(agent)};\n` : '';
				// Statements before imports still run after them: this marks the body, once its imports have run.
				const trace = config.trace
					? `globalThis.__ubdBenchModule?.(${JSON.stringify(relative(join(root, 'src'), id))});\n`
					: '';

				return head || trace ? { code: head + trace + code, map: null } : null;
			},
		},
	};
}
