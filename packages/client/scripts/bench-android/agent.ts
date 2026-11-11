// Device code, run first. It imports nothing from the client, so it never changes which client modules load.
import type { BenchHooks } from '~/core/bench-hooks';

import type { BenchConfig } from '../build/plugins/bench';

/** Swapped for the config's JSON by the bench build plugin. */
declare const __UBD_BENCH_CONFIG__: BenchConfig;

const config = __UBD_BENCH_CONFIG__;

type HeapStats = Record<string, number>;

/** Hermes mixes experiment flags and strings into its counters; only the numbers are kept. */
type HermesStat = number | string | boolean | null;

type MetroRecord = { isInitialized?: boolean };

type NavigationParams = { screen: string };

type Route = { name: string };

type NavigationRef = {
	navigate: (name: string, params?: NavigationParams) => void;
	goBack: () => void;
	getCurrentRoute: () => Route | undefined;
};

type PerformanceLog = { log: string; timestamp?: number };

type PerformanceGroup = { logs?: PerformanceLog[] };

type SettingRenderer = { type?: string };

/** The few Discord modules the agent finds, each by one of these props. */
type DiscordModule = {
	getRootNavigationRef?: () => NavigationRef;
	SETTING_RENDERER_CONFIG?: Record<string, SettingRenderer>;
	logGroups?: PerformanceGroup[];
};

/** The part of the client's global the agent reads, by name, once the client is up. */
type UnboundGlobal = { metro: { findByProps: (...props: string[]) => DiscordModule | undefined } };

/** What a report carries besides its identity. */
type ReportBody = {
	marks: Record<string, number>;
	windows: Window[];
	errors?: string[];
	discord?: Record<string, number>;
	hasGc?: boolean;
	spans?: Span[];
	totals?: Record<string, Total>;
};

/** Summed time and call count of work reported through `add`. */
type Total = [ms: number, calls: number];

/** A timed piece of work: its name, start and end epoch. */
type Span = [name: string, start: number, end: number];

/** One measured window: what ran, what loaded and how the JS thread stalled while it lasted. */
type Window = {
	name: string;
	startEpoch: number;
	endEpoch: number;
	/** Client modules whose bodies first ran in this window, in order, with their epoch. */
	modules: [string, number][];
	/** Discord's Metro modules initialized when the window ended. */
	discordModules: number | null;
	heap: HeapStats | null;
	/** Timer lateness: the worst stall, the time lost to stalls over 50 ms, and how many stalls passed 50 and 100 ms. */
	lag: { max: number; blocked: number; over50: number; over100: number; ticks: number };
	error?: string;
	/** The focused navigation route when a scenario step closed, proving the step reached its screen. */
	route?: string;
};

type Global = typeof globalThis & {
	__ubdBench?: BenchHooks;
	__ubdBenchModule?: (id: string) => void;
	nativePerformanceNow?: () => number;
	HermesInternal?: { getInstrumentedStats?: () => Record<string, HermesStat> };
	modules?: Map<number, MetroRecord>;
	gc?: () => void;
	unbound?: UnboundGlobal;
};

const LAG_INTERVAL_MS = 16;
// Shorter spans are dropped: a launch runs thousands of Discord module factories, most in microseconds.
const SPAN_MIN_MS = 0.05;
const STALL_MS = 50;

const g = globalThis as Global;
const clock = typeof g.nativePerformanceNow === 'function' ? g.nativePerformanceNow : Date.now;
const epoch0 = Date.now();
const clock0 = clock();
const epoch = () => epoch0 + (clock() - clock0);

const marks: Record<string, number> = { bundle: epoch0 };
// Every `console.error` from Unbound's start on, so the harness can tell a broken variant from a slower one.
const errors: string[] = [];

// Discord's bundle sets up `console`, so this runs once it has.
function captureErrors() {
	const original = console.error;

	console.error = (...args: unknown[]) => {
		const text = args
			.map((arg) => (arg instanceof Error ? arg.message : String(arg)))
			.join(' ');

		errors.push(text.slice(0, 300));

		return original.apply(console, args);
	};
}
const loaded: [string, number][] = [];
const spans: Span[] = [];
const totals: Record<string, Total> = {};
const windows: Window[] = [];
let loadedCursor = 0;
let windowStart = epoch0;
let lag = freshLag();

function freshLag(): Window['lag'] {
	return { max: 0, blocked: 0, over50: 0, over100: 0, ticks: 0 };
}

function heap(): HeapStats | null {
	const stats = g.HermesInternal?.getInstrumentedStats?.();

	if (!stats) return null;

	const numbers: HeapStats = {};

	for (const key of Object.keys(stats)) {
		const value = stats[key];

		if (typeof value === 'number') {
			numbers[key] = value;
		}
	}

	return numbers;
}

function discordModules(): number | null {
	const modules = g.modules;

	if (!modules) return null;

	let count = 0;

	for (const record of modules.values()) {
		if (record?.isInitialized) {
			count++;
		}
	}

	return count;
}

/** Closes the current window and opens the next; the heap and module counts are read before anything else runs. */
function closeWindow(name: string, extra: Pick<Window, 'error' | 'route'> = {}): Window {
	const window: Window = {
		name,
		startEpoch: windowStart,
		endEpoch: epoch(),
		modules: loaded.slice(loadedCursor),
		discordModules: discordModules(),
		heap: heap(),
		lag,
		...extra,
	};

	loadedCursor = loaded.length;
	windowStart = window.endEpoch;
	lag = freshLag();
	windows.push(window);

	return window;
}

function watchLag() {
	let expected = clock() + LAG_INTERVAL_MS;

	function tick() {
		const late = clock() - expected;

		lag.ticks++;

		if (late > lag.max) {
			lag.max = late;
		}

		if (late > STALL_MS) {
			lag.blocked += late;
			lag.over50++;
		}

		if (late > 100) {
			lag.over100++;
		}

		expected = clock() + LAG_INTERVAL_MS;
		setTimeout(tick, LAG_INTERVAL_MS);
	}

	setTimeout(tick, LAG_INTERVAL_MS);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function post(phase: string, body: ReportBody) {
	const payload = JSON.stringify({ phase, variant: config.variant, epoch0, ...body });

	try {
		await fetch(`${config.reportUrl}?phase=${phase}`, { method: 'POST', body: payload });
	} catch (error) {
		console.log(`[ubd-bench] Failed to post the ${phase} report:`, String(error));
	}
}

function navigation(unbound: UnboundGlobal) {
	const ref = unbound.metro.findByProps('getRootNavigationRef')?.getRootNavigationRef?.();
	const renderers =
		unbound.metro.findByProps('SETTING_RENDERER_CONFIG')?.SETTING_RENDERER_CONFIG ?? {};

	if (!ref) {
		throw new Error('Failed to find the root navigation ref');
	}

	return { ref, screens: config.screens.filter((key) => key in renderers) };
}

async function step(name: string, act: () => void, route?: () => string | undefined) {
	let error: string | undefined;

	try {
		act();
	} catch (caught) {
		error = String(caught);
	}

	await sleep(config.stepMs);

	let focused: string | undefined;

	try {
		focused = route?.();
	} catch (caught) {
		error ??= `Failed to read the route: ${String(caught)}`;
	}

	closeWindow(name, { error, route: focused });
}

function discordMarks(): Record<string, number> {
	const out: Record<string, number> = {};

	try {
		const perf = g.unbound?.metro.findByProps('markAndLog', 'markWithDelta');

		for (const group of perf?.logGroups ?? []) {
			for (const log of group.logs ?? []) {
				if (log.timestamp && !(log.log in out)) {
					out[log.log] = log.timestamp;
				}
			}
		}
	} catch (error) {
		out.error = -1;
		console.log('[ubd-bench] Failed to read Discord marks:', String(error));
	}

	return out;
}

async function run() {
	await sleep(Math.max(0, epoch0 + config.idleMs - Date.now()));
	closeWindow('idle');
	// The harness samples the process's memory while this request is open, before the scenario starts.
	await post('idle', { marks, windows });
	// The live heap after startup: a full collection, then the counters, with nothing else in between.
	g.gc?.();
	closeWindow('idle:gc');

	const unbound = g.unbound;

	if (config.scenario && unbound) {
		let nav: ReturnType<typeof navigation> | undefined;

		await step('scenario:setup', () => {
			nav = navigation(unbound);
		});

		if (nav) {
			const { ref, screens } = nav;
			const route = () => ref.getCurrentRoute()?.name;

			await step('settings', () => ref.navigate('settings'), route);

			for (const screen of screens) {
				await step(screen, () => ref.navigate('settings', { screen }), route);
				await step(`${screen}:back`, () => ref.goBack(), route);
			}
		}
	}

	g.gc?.();
	closeWindow('final:gc');
	await post('final', {
		marks,
		windows,
		errors,
		discord: discordMarks(),
		hasGc: typeof g.gc === 'function',
		spans,
		totals,
	});
}

g.__ubdBench = {
	now: epoch,
	add(name, ms) {
		const total = (totals[name] ??= [0, 0]);

		total[0] += ms;
		total[1]++;
	},
	span(name, start, end) {
		if (end - start >= SPAN_MIN_MS) {
			spans.push([name, start, end]);
		}
	},
	mark(name) {
		// Closing the bundle window counts every Discord module (~2.5 ms), so the mark is taken after it, keeping that
		// out of the startup it opens.
		if (name === 'ready:start') {
			captureErrors();
			closeWindow('bundle');
		}

		marks[name] ??= epoch();

		if (name === 'core:end') {
			closeWindow('startup');
		}

		if (name === 'ready:resumed') {
			watchLag();
			void run();
		}

		if (name === 'afterFirstFrame:end') {
			closeWindow('afterFirstFrame');
		}
	},
};

if (config.trace) {
	g.__ubdBenchModule = (id) => {
		loaded.push([id, epoch()]);
	};
}
