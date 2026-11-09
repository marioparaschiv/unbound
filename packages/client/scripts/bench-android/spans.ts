import type { LaunchRecord } from './report';

import { summarize } from '../../../cli/src/bench/stats';

/** A timed piece of work in one launch, in epoch ms. */
export type TimedSpan = { name: string; start: number; end: number };

/** A span placed in its launch's tree: its parent's index and its time outside its children. */
export type NestedSpan = TimedSpan & { parent: number | undefined; self: number };

/** One name's totals in one launch. */
type NameTotals = { total: number; self: number; count: number; at: number };

/** One row of the span table, summarised over launches. */
type SpanRow = { name: string; total?: number; self?: number; count?: number; at?: number };

const START = ':start';
const END = ':end';
const ROWS = 60;

/**
 * @description Collects a launch's spans: paired `<name>:start`/`<name>:end` marks and the agent's spans.
 * @param record The launch.
 * @returns The spans, in epoch ms.
 */
export function launchSpans(record: LaunchRecord): TimedSpan[] {
	const marks = record.agent?.marks ?? {};
	const paired = Object.entries(marks).flatMap(([mark, start]) => {
		const name = mark.slice(0, -START.length);
		const end = marks[name + END];

		return mark.endsWith(START) && end !== undefined ? [{ name, start, end }] : [];
	});
	const reported = (record.agent?.spans ?? []).map(([name, start, end]) => ({
		name,
		start,
		end,
	}));

	return [...paired, ...reported];
}

/**
 * @description Nests spans by time: each sits under the latest-starting span that still contains it. The JS thread
 * runs one thing at a time, so synchronous spans nest cleanly.
 * @param spans The spans, in any order.
 * @returns The spans ordered by start, each with its parent index and self time.
 */
export function nestSpans(spans: TimedSpan[]): NestedSpan[] {
	const sorted: NestedSpan[] = spans
		.toSorted((x, y) => x.start - y.start || y.end - x.end)
		.map((span) => ({ ...span, parent: undefined, self: span.end - span.start }));
	const stack: number[] = [];

	for (const [index, span] of sorted.entries()) {
		while (stack.length && sorted[stack.at(-1)!].end < span.end) stack.pop();

		const parent = stack.at(-1);

		if (parent !== undefined) {
			span.parent = parent;
			sorted[parent].self -= span.end - span.start;
		}

		stack.push(index);
	}

	return sorted;
}

function totalsOf(record: LaunchRecord): Map<string, NameTotals> {
	const totals = new Map<string, NameTotals>();
	const origin = record.processStart ?? 0;

	for (const span of nestSpans(launchSpans(record))) {
		const entry = totals.get(span.name) ?? {
			total: 0,
			self: 0,
			count: 0,
			at: span.start - origin,
		};

		entry.total += span.end - span.start;
		entry.self += span.self;
		entry.count++;
		totals.set(span.name, entry);
	}

	return totals;
}

function format(value: number | undefined): string {
	return value === undefined ? '–' : value.toFixed(1);
}

function rowsOf(runs: Map<string, NameTotals>[]): SpanRow[] {
	const names = [...new Set(runs.flatMap((totals) => [...totals.keys()]))];

	return names.map((name) => {
		const found = runs.flatMap((totals) => totals.get(name) ?? []);
		const median = (pick: (t: NameTotals) => number) => summarize(found.map(pick))?.median;

		return {
			name,
			total: median((t) => t.total),
			self: median((t) => t.self),
			count: median((t) => t.count),
			at: median((t) => t.at),
		};
	});
}

function table(rows: SpanRow[]): string[] {
	return [
		'| span | total ms | self ms | calls | first at |',
		'|---|---|---|---|---|',
		...rows.map(
			(row) =>
				`| ${row.name} | ${format(row.total)} | ${format(row.self)} | ${format(row.count)} | ${format(row.at)} |`,
		),
	];
}

/**
 * @description Renders each variant's summed totals, such as each patch's callbacks, medians over launches.
 * @param variants The variant names, in report order.
 * @param valid The valid launches.
 * @returns Markdown lines.
 */
export function totalsSection(variants: string[], valid: LaunchRecord[]): string[] {
	return variants.flatMap((variant) => {
		const runs = valid.filter((r) => r.variant === variant).map((r) => r.agent?.totals ?? {});
		const names = [...new Set(runs.flatMap((totals) => Object.keys(totals)))];
		const rows = names
			.map((name) => {
				const found = runs
					.map((totals) => totals[name])
					.filter((total) => total !== undefined);

				return {
					name,
					ms: summarize(found.map(([ms]) => ms))?.median,
					calls: summarize(found.map(([, calls]) => calls))?.median,
				};
			})
			.toSorted((x, y) => (y.ms ?? 0) - (x.ms ?? 0));

		return [
			`### ${variant}`,
			'',
			'| total | ms per launch | calls |',
			'|---|---|---|',
			...rows.map((row) => `| ${row.name} | ${format(row.ms)} | ${format(row.calls)} |`),
			'',
		];
	});
}

/**
 * @description Renders each variant's spans twice, by total and by self time, medians over launches. Self time
 * excludes nested spans, so it names the work itself rather than what it triggered.
 * @param variants The variant names, in report order.
 * @param valid The valid launches.
 * @returns Markdown lines.
 */
export function spanSection(variants: string[], valid: LaunchRecord[]): string[] {
	return variants.flatMap((variant) => {
		const rows = rowsOf(valid.filter((r) => r.variant === variant).map(totalsOf));
		const by = (pick: (row: SpanRow) => number | undefined) =>
			rows.toSorted((x, y) => (pick(y) ?? 0) - (pick(x) ?? 0)).slice(0, ROWS);

		return [
			`### ${variant}: by total`,
			'',
			...table(by((row) => row.total)),
			'',
			`### ${variant}: by self`,
			'',
			...table(by((row) => row.self)),
			'',
		];
	});
}
