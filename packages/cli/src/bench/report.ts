import { mannWhitney, summarize, type RankSum, type Summary } from '~/bench/stats';
import { formatValue, METRICS, type Metric } from '~/bench/metrics';
import { isMeasured, type RunRecord } from '~/bench/record';
import type { LaunchKind, Plan } from '~/bench/plan';
import type { VariantBuild } from '~/bench/build';

/** The significance level the verdict uses. */
export const ALPHA = 0.05;

const KINDS: LaunchKind[] = ['warm', 'cold'];

export type ReportInput = {
	startedAt: string;
	plan: Plan;
	builds: VariantBuild[];
	records: RunRecord[];
	discord: { version: string; build: string };
	deviations: string[];
	unmeasured: string[];
};

export type SummaryRow = {
	metric: Metric;
	kind: LaunchKind;
	variant: string;
	summary: Summary;
	/** Median minus the baseline's median; `undefined` for the baseline itself. */
	delta?: number;
	test?: RankSum;
};

function values(records: RunRecord[], metric: Metric, kind: LaunchKind, variant: string): number[] {
	return records
		.filter((r) => isMeasured(r) && r.identity.kind === kind && r.identity.variant === variant)
		.flatMap((r) => metric.read(r) ?? []);
}

/**
 * @description Summarises every metric per launch kind and variant, testing each variant against the first.
 * @param plan The plan, whose first variant is the baseline.
 * @param records Every launch; discarded and invalid ones are left out.
 * @returns One row per metric, kind and variant that has samples.
 */
export function summaryRows(plan: Plan, records: RunRecord[]): SummaryRow[] {
	const [baseline] = plan.variants;
	const rows: SummaryRow[] = [];

	for (const kind of KINDS) {
		for (const metric of METRICS) {
			const base = values(records, metric, kind, baseline!.name);
			const baseSummary = summarize(base);

			for (const variant of plan.variants) {
				const sample = values(records, metric, kind, variant.name);
				const summary = summarize(sample);

				if (!summary) {
					continue;
				}

				const compared = variant !== baseline && baseSummary;

				rows.push({
					metric,
					kind,
					variant: variant.name,
					summary,
					delta: compared ? summary.median - baseSummary.median : undefined,
					test: compared ? mannWhitney(sample, base) : undefined,
				});
			}
		}
	}

	return rows;
}

/**
 * @description The smallest two-sided p-value the exact rank-sum test can give for these sample sizes.
 * @param n1 The first sample's size.
 * @param n2 The second sample's size.
 * @returns `2 / C(n1 + n2, n1)`, capped at 1.
 */
export function smallestP(n1: number, n2: number): number {
	let ways = 1;

	for (let i = 1; i <= n1; i++) ways = (ways * (n2 + i)) / i;

	return Math.min(1, 2 / ways);
}

function csvCell(value: string | number | boolean | undefined): string {
	const text = value === undefined ? '' : String(value);

	return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csv(header: string[], rows: (string | number | boolean | undefined)[][]): string {
	return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}

/**
 * @description One CSV row per launch, discarded and invalid ones included, with every metric.
 * @param records The launches in run order.
 * @returns The CSV text.
 */
export function runsCsv(records: RunRecord[]): string {
	return csv(
		[
			'index',
			'variant',
			'ref',
			'sha',
			'kind',
			'discarded',
			'valid',
			'problems',
			'ran_bundle',
			...METRICS.map((m) => m.key),
		],
		records.map((r) => [
			r.identity.index,
			r.identity.variant,
			r.identity.ref,
			r.identity.sha.slice(0, 12),
			r.identity.kind,
			r.identity.discarded,
			r.problems.length === 0,
			r.problems.join('; '),
			r.identity.ranBundleSha256?.slice(0, 16),
			...METRICS.map((m) => m.read(r)),
		]),
	);
}

/**
 * @description One CSV row per metric, kind and variant: the summary and the test against the baseline.
 * @param rows The summary rows.
 * @returns The CSV text.
 */
export function summaryCsv(rows: SummaryRow[]): string {
	return csv(
		[
			'metric',
			'unit',
			'kind',
			'variant',
			'n',
			'median',
			'min',
			'max',
			'q1',
			'q3',
			'iqr',
			'delta_median',
			'delta_pct',
			'mw_u',
			'mw_p',
		],
		rows.map(({ metric, kind, variant, summary: s, delta, test }) => [
			metric.key,
			metric.unit,
			kind,
			variant,
			s.n,
			s.median,
			s.min,
			s.max,
			s.q1,
			s.q3,
			s.q3 - s.q1,
			delta,
			delta === undefined || s.median === delta
				? undefined
				: (delta / (s.median - delta)) * 100,
			test?.u,
			test?.p,
		]),
	);
}

function signed(value: number, unit: Metric['unit']): string {
	return (value > 0 ? '+' : value < 0 ? '−' : '±') + formatValue(Math.abs(value), unit);
}

function verdicts(plan: Plan, rows: SummaryRow[]): string[] {
	const lines: string[] = [];
	const baseline = plan.variants[0]!.name;

	for (const kind of KINDS) {
		for (const variant of plan.variants.slice(1)) {
			const compared = rows.filter(
				(r) => r.kind === kind && r.variant === variant.name && r.test,
			);

			if (compared.length === 0) {
				continue;
			}

			const n = compared[0]!.summary.n;
			const base = rows.find(
				(r) =>
					r.kind === kind && r.variant === baseline && r.metric === compared[0]!.metric,
			);
			const floor = smallestP(n, base?.summary.n ?? 0);
			const differ = compared.filter((r) => r.test!.p < ALPHA);
			const subject = `**${variant.name} vs ${baseline}, ${kind}**`;

			if (floor >= ALPHA) {
				lines.push(
					`- ${subject}: too few launches to show a difference; the smallest possible p is ${floor.toFixed(2)}.`,
				);
			} else if (differ.length === 0) {
				lines.push(`- ${subject}: no metric differs at p < ${ALPHA}.`);
			} else {
				const named = differ.map(
					(r) =>
						`${r.metric.label} ${signed(r.delta!, r.metric.unit)} (p ${r.test!.p.toFixed(3)})`,
				);

				lines.push(`- ${subject}: ${named.join('; ')}.`);
			}
		}
	}

	return lines.length > 0 ? lines : ['- One variant only: nothing to compare.'];
}

function metricTable(kind: LaunchKind, rows: SummaryRow[]): string {
	const lines = [
		'| Metric | Variant | n | Median | Range | IQR | Δ median | p |',
		'| --- | --- | --- | --- | --- | --- | --- | --- |',
	];

	for (const { metric, variant, summary: s, delta, test } of rows.filter(
		(r) => r.kind === kind,
	)) {
		const f = (value: number) => formatValue(value, metric.unit);
		const p = test ? (test.p < ALPHA ? `**${test.p.toFixed(3)}**` : test.p.toFixed(3)) : '';

		lines.push(
			`| ${metric.label} | ${variant} | ${s.n} | ${f(s.median)} | ${f(s.min)} – ${f(s.max)} | ${f(s.q3 - s.q1)} | ${delta === undefined ? '' : signed(delta, metric.unit)} | ${p} |`,
		);
	}

	return lines.join('\n');
}

function selfCheck(input: ReportInput): string[] {
	const { records, builds } = input;
	const measured = records.filter(isMeasured);
	const invalid = records.filter((r) => r.problems.length > 0);
	const discarded = records.filter((r) => r.identity.discarded);
	const modules = measured.flatMap((r) => r.work.modulesInitialized ?? []);
	const ranOwn = measured.every(
		(r) =>
			r.identity.ranBundleSha256 ===
			builds.find((b) => b.variant === r.identity.variant)?.bundleSha256,
	);
	const lines = [
		`- ${records.length} launches: ${measured.length} measured, ${discarded.length} discarded warm-ups after a switch, ${invalid.length} invalid.`,
		`- Every measured launch ran its variant's bundle (sha256 read on the device after the launch): ${ranOwn ? 'yes' : '**no**'}.`,
	];

	if (modules.length > 0) {
		lines.push(
			`- Metro modules initialized at idle: ${Math.min(...modules).toLocaleString('en-US')} to ${Math.max(...modules).toLocaleString('en-US')}.`,
		);
	}

	for (const r of invalid) {
		lines.push(
			`- Launch ${r.identity.index} (${r.identity.variant}, ${r.identity.kind}) is invalid: ${r.problems.join('; ')}.`,
		);
	}

	const failures = new Set(measured.flatMap((r) => r.failures));

	if (failures.size > 0) {
		lines.push(`- Error lines logged by measured launches (they do not invalidate a launch):`);

		for (const failure of failures) lines.push(`    - \`${failure.replaceAll('`', "'")}\``);
	}

	return lines;
}

/**
 * @description Renders the bench report as markdown: verdicts first, then the variants, the protocol, one table
 * per launch kind, the self-check, and what was not measured.
 * @param input Everything the run produced.
 * @returns The markdown.
 */
export function renderReport(input: ReportInput): string {
	const { plan, builds, discord } = input;
	const rows = summaryRows(plan, input.records);
	const sections = [
		`# Unbound bench, ${input.startedAt}`,
		`Discord ${discord.version} (${discord.build}) on the vphone. Startup times are milliseconds after Discord's JavaScript runtime was created, on the device clock. Memory is sampled after Unbound initialized and ${plan.idleMs / 1000} s after the launch. p is an exact two-sided Mann-Whitney U test against ${plan.variants[0]!.name}.`,
		`## Verdict\n\n${verdicts(plan, rows).join('\n')}`,
		[
			'## Variants\n',
			'| Variant | Ref | Commit | Build env | Bundle sha256 | Plugins | Loader sha256 |',
			'| --- | --- | --- | --- | --- | --- | --- |',
			...builds.map(
				(b) =>
					`| ${b.variant} | \`${b.ref}\` | \`${b.sha.slice(0, 9)}\` | ${
						Object.entries(b.env)
							.map(([k, v]) => `\`${k}=${v}\``)
							.join(' ') || 'none'
					} | \`${b.bundleSha256.slice(0, 16)}\` | ${b.pluginCount} (\`${b.pluginSetHash.slice(0, 12)}\`) | \`${b.loaderSha256.slice(0, 16)}\` |`,
			),
		].join('\n'),
		`## Protocol\n\n${plan.rounds} rounds. Each round visits every variant once, odd rounds in reverse order. A visit switches the bundle, plugins and loader, discards warm launches until one has run the variant's bundle, then measures ${plan.warm} warm and ${plan.cold} cold launches (cold empties Unbound's module cache first). Loader flags: \`${builds[0]?.loaderFlags ?? ''}\`.`,
		...KINDS.filter((kind) => rows.some((r) => r.kind === kind)).map(
			(kind) =>
				`## ${kind === 'warm' ? 'Warm' : 'Cold'} launches\n\n${metricTable(kind, rows)}`,
		),
		`## Self-check\n\n${selfCheck(input).join('\n')}`,
		`## Not measured\n\n${input.unmeasured.map((line) => `- ${line}`).join('\n') || 'Nothing.'}`,
		`## Deviations from a shipped release\n\n${input.deviations.map((line, i) => `${i + 1}. ${line}`).join('\n')}`,
		'Files: `runs.jsonl` (every launch, raw), `runs.csv`, `summary.csv`, `meta.json`.',
	];

	return sections.join('\n\n') + '\n';
}

export default { ALPHA, summaryRows, smallestP, runsCsv, summaryCsv, renderReport };
