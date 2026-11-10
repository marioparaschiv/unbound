import { BENCH_MARKS } from '~/core/bench-hooks';

import type { AgentReport as AgentFinal } from './schema';
import type { MemInfo } from './device';

import { mannWhitney, summarize } from '../../../cli/src/bench/stats';
import { spanSection, totalsSection } from './spans';

/** One measured launch. */
export type LaunchRecord = {
	variant: string;
	index: number;
	processStart: number | null;
	agent: AgentFinal | null;
	memory: { idle: MemInfo | null; final: MemInfo | null };
	problems: string[];
};

type BuildInfo = {
	name: string;
	env: Record<string, string>;
	bundleSha256: string;
	sizes: Record<string, number>;
};

// `bundle` is the agent's own mark, taken as the bundle starts.
const MARKS = ['bundle', ...BENCH_MARKS];

const DISCORD_MARKS: Record<string, string> = {
	'Finish Load index.tsx': 'discord: index loaded',
	'First React Render': 'discord: first render',
	'First Contentful Paint': 'discord: first contentful paint',
	'Display Latest Messages': 'discord: latest messages',
};

const HEAP_KEYS = [
	'js_allocatedBytes',
	'js_heapSize',
	'js_totalAllocatedBytes',
	'js_numGCs',
	'js_gcTime',
];

// Windows the agent closes during startup; later windows are scenario steps until `final`.
const STARTUP_WINDOWS = new Set(['bundle', 'startup', 'afterFirstFrame', 'idle', 'idle:gc']);
const LAST_WINDOW = 'final:gc';

function windowOf(agent: AgentFinal, name: string) {
	return agent.windows.find((w) => w.name === name);
}

function cumulativeModules(agent: AgentFinal, name: string): number | undefined {
	const end = agent.windows.findIndex((w) => w.name === name);

	if (end < 0) return;

	return agent.windows.slice(0, end + 1).reduce((sum, w) => sum + w.modules.length, 0);
}

/**
 * @description Flattens one launch into named numbers; times are milliseconds after Discord's process started.
 * @param record The launch.
 * @returns Each metric that launch measured.
 */
export function metricsOf(record: LaunchRecord): Record<string, number> {
	const out: Record<string, number> = {};
	const { agent, processStart } = record;

	if (!agent || processStart === null) {
		return out;
	}

	const mark = (name: string) => agent.marks[name];

	for (const name of MARKS) {
		if (mark(name) !== undefined) {
			out[`at ${name}`] = mark(name) - processStart;
		}
	}

	for (const [log, label] of Object.entries(DISCORD_MARKS)) {
		const at = agent.discord?.[log];

		if (at && at > 0) {
			out[`at ${label}`] = at - processStart;
		}
	}

	const span = (from: string, to: string) =>
		mark(from) !== undefined && mark(to) !== undefined ? mark(to) - mark(from) : undefined;
	const spans: Record<string, number | undefined> = {
		'ms Unbound holds startup (ready:start → core:end)': span('ready:start', 'core:end'),
		'ms evaluating client modules (preinitialize:end → initialize:start)': span(
			'preinitialize:end',
			'initialize:start',
		),
		'ms initialize()': span('initialize:start', 'initialize:end'),
		'ms after-first-frame work': span('firstFrame', 'afterFirstFrame:end'),
	};

	for (const [key, value] of Object.entries(spans)) {
		if (value !== undefined) {
			out[key] = value;
		}
	}

	for (const name of ['startup', 'idle', 'idle:gc']) {
		const w = windowOf(agent, name);

		if (!w) {
			continue;
		}

		if (name !== 'idle:gc') {
			out[`client modules run by ${name}`] = cumulativeModules(agent, name) ?? NaN;

			if (w.discordModules !== null) {
				out[`Discord modules initialized at ${name}`] = w.discordModules;
			}
		}

		for (const key of HEAP_KEYS) {
			if (w.heap?.[key] !== undefined) {
				out[`${key} at ${name}`] = w.heap[key];
			}
		}
	}

	const settle = ['afterFirstFrame', 'idle'].map((name) => windowOf(agent, name)?.lag);

	if (settle.every(Boolean)) {
		out['ms JS stalled > 50 ms, resumed → idle'] = settle.reduce(
			(sum, lag) => sum + lag!.blocked,
			0,
		);
		out['ms worst stall, resumed → idle'] = Math.max(...settle.map((lag) => lag!.max));
	}

	const scenario = agent.windows.filter(
		(w) => !STARTUP_WINDOWS.has(w.name) && w.name !== LAST_WINDOW,
	);

	if (scenario.length) {
		out['ms JS stalled > 50 ms, settings walk'] = scenario.reduce(
			(sum, w) => sum + w.lag.blocked,
			0,
		);
		out['ms worst stall, settings walk'] = Math.max(...scenario.map((w) => w.lag.max));
		out['client modules run by the end'] = cumulativeModules(agent, LAST_WINDOW) ?? NaN;
	}

	const final = windowOf(agent, LAST_WINDOW);

	if (final?.discordModules) {
		out['Discord modules initialized at the end'] = final.discordModules;
	}

	for (const key of HEAP_KEYS) {
		if (final?.heap?.[key] !== undefined) {
			out[`${key} at the end`] = final.heap[key];
		}
	}

	for (const [when, mem] of Object.entries(record.memory)) {
		if (!mem) {
			continue;
		}

		out[`KB PSS at ${when}`] = mem.pss;
		out[`KB native heap at ${when}`] = mem.nativeHeap;
	}

	if (agent.errors) {
		out['console errors'] = agent.errors.length;
	}

	return out;
}

// Digits vary between launches (ids, addresses), so they are masked to group the same error.
function errorSection(builds: BuildInfo[], valid: LaunchRecord[]): string[] {
	return builds.flatMap((b) => {
		const runs = valid.filter((r) => r.variant === b.name);
		const counts = new Map<string, number>();

		for (const r of runs) {
			for (const text of new Set(
				r.agent?.errors?.map((e) => e.replace(/\d+/g, '#').slice(0, 160)),
			)) {
				counts.set(text, (counts.get(text) ?? 0) + 1);
			}
		}

		return [
			`### ${b.name}`,
			'',
			...[...counts]
				.toSorted((x, y) => y[1] - x[1])
				.map(([text, n]) => `- (${n}/${runs.length}) ${text.replaceAll('\n', ' ')}`),
			'',
		];
	});
}

function format(value: number | undefined): string {
	if (value === undefined || Number.isNaN(value)) {
		return '–';
	}

	const abs = Math.abs(value);

	return abs >= 1e6
		? `${(value / 1e6).toFixed(2)}M`
		: abs >= 100
			? value.toFixed(0)
			: value.toFixed(1);
}

function metricTable(builds: BuildInfo[], valid: LaunchRecord[]): string[] {
	const [base, ...others] = builds;
	const byVariant = new Map(
		builds.map((b) => [b.name, valid.filter((r) => r.variant === b.name).map(metricsOf)]),
	);
	const keys = [...new Set([...byVariant.values()].flat().flatMap((m) => Object.keys(m)))];
	const header = [
		'metric',
		...builds.map((b) => `${b.name} median [q1–q3]`),
		...others.flatMap((b) => [`Δ ${b.name}`, `p`]),
	];
	const lines = [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`];

	for (const key of keys) {
		const samples = builds.map((b) =>
			byVariant
				.get(b.name)!
				.map((m) => m[key])
				.filter((v): v is number => v !== undefined && !Number.isNaN(v)),
		);
		const summaries = samples.map((s) => summarize(s));
		const cells = summaries.map((s) =>
			s ? `${format(s.median)} [${format(s.q1)}–${format(s.q3)}] n=${s.n}` : '–',
		);
		const deltas = others.flatMap((_, i) => {
			const a = summaries[0];
			const b = summaries[i + 1];

			if (!a || !b) {
				return ['–', '–'];
			}

			const delta = b.median - a.median;
			const pct = a.median
				? ` (${delta >= 0 ? '+' : ''}${((delta / a.median) * 100).toFixed(0)}%)`
				: '';
			const test = mannWhitney(samples[0], samples[i + 1]);

			return [
				`${delta >= 0 ? '+' : ''}${format(delta)}${pct}`,
				test ? test.p.toFixed(3) : '–',
			];
		});

		lines.push(`| ${key} | ${[...cells, ...deltas].join(' | ')} |`);
	}

	void base;

	return lines;
}

function scenarioTable(builds: BuildInfo[], valid: LaunchRecord[]): string[] {
	const steps = [
		...new Set(
			valid
				.flatMap((r) => r.agent?.windows.map((w) => w.name) ?? [])
				.filter((name) => !STARTUP_WINDOWS.has(name)),
		),
	];

	if (!steps.length) {
		return [];
	}

	const header = [
		'step',
		...builds.flatMap((b) => [
			`${b.name} new client modules`,
			`${b.name} stalled ms`,
			`${b.name} worst stall`,
			`${b.name} Δ allocated KB`,
		]),
	];
	const lines = [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`];

	for (const step of steps) {
		const cells = builds.flatMap((b) => {
			const windows = valid
				.filter((r) => r.variant === b.name)
				.map((r) => {
					const list = r.agent!.windows;
					const i = list.findIndex((w) => w.name === step);

					return i < 0 ? undefined : { w: list[i], prev: list[i - 1] };
				})
				.filter((x) => x !== undefined);
			const median = (values: number[]) => summarize(values)?.median;
			const alloc = windows
				.map(({ w, prev }) =>
					w.heap && prev?.heap
						? (w.heap.js_allocatedBytes - prev.heap.js_allocatedBytes) / 1024
						: NaN,
				)
				.filter((v) => !Number.isNaN(v));
			const errors = windows.filter(({ w }) => w.error).length;
			const routes = [...new Set(windows.map(({ w }) => w.route ?? '?'))].join('/');

			return [
				format(median(windows.map(({ w }) => w.modules.length))) +
					` → ${routes}` +
					(errors ? ` (${errors} errored)` : ''),
				format(median(windows.map(({ w }) => w.lag.blocked))),
				format(median(windows.map(({ w }) => w.lag.max))),
				format(median(alloc)),
			];
		});

		lines.push(`| ${step} | ${cells.join(' | ')} |`);
	}

	return lines;
}

/**
 * @description Lists which client modules each window ran, per variant, with how many launches ran each one there.
 * @param builds The variants.
 * @param valid The valid launches.
 * @returns Markdown lines.
 */
export function moduleSections(builds: BuildInfo[], valid: LaunchRecord[]): string[] {
	const lines: string[] = [];

	for (const b of builds) {
		const runs = valid.filter((r) => r.variant === b.name && r.agent);

		lines.push(`### ${b.name}`, '');

		const names = [...new Set(runs.flatMap((r) => r.agent!.windows.map((w) => w.name)))];

		for (const name of names) {
			const counts = new Map<string, number>();
			const self = new Map<string, number[]>();

			for (const r of runs) {
				const w = r.agent!.windows.find((x) => x.name === name);

				for (const [i, [id, at]] of (w?.modules ?? []).entries()) {
					counts.set(id, (counts.get(id) ?? 0) + 1);

					// Self time: until the next module body starts, within one synchronous burst.
					const next = w?.modules[i + 1]?.[1];

					if (next !== undefined && next - at < 250) {
						self.set(id, [...(self.get(id) ?? []), next - at]);
					}
				}
			}

			if (!counts.size) {
				continue;
			}

			const heaviest = [...self.entries()]
				.map(([id, times]) => [id, summarize(times)!.median] as const)
				.toSorted((x, y) => y[1] - x[1])
				.slice(0, 25);

			lines.push(
				`<details><summary>${name}: ${counts.size} modules (median ${format(summarize(runs.map((r) => r.agent!.windows.find((x) => x.name === name)?.modules.length ?? 0))?.median)} per launch)</summary>`,
				'',
				'Heaviest by approximate self time (ms to the next module body):',
				'',
				...heaviest.map(([id, ms]) => `- ${id}: ${format(ms)}`),
				'',
				'All, with the launches that ran each here:',
				'',
				...[...counts.entries()]
					.toSorted((x, y) => x[0].localeCompare(y[0]))
					.map(([id, n]) => `- ${id} (${n}/${runs.length})`),
				'',
				'</details>',
				'',
			);
		}
	}

	return lines;
}

/**
 * @description Renders the benchmark report: validity, bundle sizes, every metric with medians and Mann-Whitney p
 * against the first variant, the settings walk step by step, and the client modules each window ran.
 * @param builds The variants; the first is the baseline.
 * @param records Every measured launch.
 * @returns Markdown.
 */
export function renderReport(builds: BuildInfo[], records: LaunchRecord[]): string {
	const valid = records.filter((r) => r.problems.length === 0 && r.agent);
	const invalid = records.filter((r) => !valid.includes(r));

	return [
		'# Android client benchmark',
		'',
		`Launches: ${builds.map((b) => `${b.name} ${valid.filter((r) => r.variant === b.name).length} valid`).join(', ')}. Times are ms after Discord's process started. p is an exact Mann-Whitney U against ${builds[0]?.name}.`,
		'',
		...(invalid.length
			? [
					'Invalid launches:',
					'',
					...invalid.map(
						(r) =>
							`- #${r.index} ${r.variant}: ${r.problems.join('; ') || 'no agent report'}`,
					),
					'',
				]
			: []),
		'## Builds',
		'',
		'| variant | env | unbound.98.bundle | unbound.js |',
		'|---|---|---|---|',
		...builds.map(
			(b) =>
				`| ${b.name} | ${JSON.stringify(b.env)} | ${b.sizes['unbound.98.bundle']} | ${b.sizes['unbound.js']} |`,
		),
		'',
		'## Metrics',
		'',
		...metricTable(builds, valid),
		'',
		'## Startup spans (slowest first)',
		'',
		...spanSection(
			builds.map((b) => b.name),
			valid,
		),
		'## Summed totals (whole launch)',
		'',
		...totalsSection(
			builds.map((b) => b.name),
			valid,
		),
		'## Settings walk (medians per step)',
		'',
		...scenarioTable(builds, valid),
		'',
		'## Console errors (launches that logged each)',
		'',
		...errorSection(builds, valid),
		'## Client modules by window',
		'',
		...moduleSections(builds, valid),
	].join('\n');
}
