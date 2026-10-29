import type { DeviceCheck } from './device-matrix';

export type CheckMetrics = {
	stopMs: number;
	startMs: number;
	leakedHooks: number;
};

export type MeasuredCheck = DeviceCheck & {
	metrics?: CheckMetrics;
	offMainCalls?: string[];
	errors?: string[];
	skippedHooks?: string[];
};

const SLOWER_FACTOR = 2;
const SLOWER_MARGIN_MS = 200;

function passed(check: DeviceCheck): boolean {
	return check.behavior === 'pass' && check.lifecycle === 'pass';
}

function isSlower(previous: number, current: number): boolean {
	return current > previous * SLOWER_FACTOR && current - previous > SLOWER_MARGIN_MS;
}

function metricChanges(id: string, previous?: CheckMetrics, current?: CheckMetrics): string[] {
	if (!previous || !current) return [];

	const changes: string[] = [];

	if (isSlower(previous.stopMs, current.stopMs)) {
		changes.push(`${id} stops slower: ${previous.stopMs} ms → ${current.stopMs} ms`);
	}

	if (isSlower(previous.startMs, current.startMs)) {
		changes.push(`${id} starts slower: ${previous.startMs} ms → ${current.startMs} ms`);
	}

	if (current.leakedHooks > previous.leakedHooks) {
		changes.push(
			`${id} leaves more native hooks behind: ${previous.leakedHooks} → ${current.leakedHooks}`,
		);
	}

	return changes;
}

/**
 * @description Compares a device matrix run with the previous one, so a run reports what changed instead of only what holds.
 * @param previous The previous run's checks.
 * @param current This run's checks.
 * @returns One line per change: plugins that newly fail or were fixed, stop or start times that more than doubled, more leaked hooks, and plugins added or removed.
 */
export function compareRuns(previous: MeasuredCheck[], current: MeasuredCheck[]): string[] {
	const before = new Map(previous.map((check) => [check.id, check]));
	const after = new Map(current.map((check) => [check.id, check]));
	const changes: string[] = [];

	for (const check of current) {
		const earlier = before.get(check.id);

		if (!earlier) {
			changes.push(`${check.id} is new and ${passed(check) ? 'passes' : 'fails'}`);
			continue;
		}

		if (passed(earlier) && !passed(check)) {
			changes.push(`${check.id} now fails: ${check.note ?? 'no note'}`);
		} else if (!passed(earlier) && passed(check)) {
			changes.push(`${check.id} passes again`);
		}

		changes.push(...metricChanges(check.id, earlier.metrics, check.metrics));

		const known = new Set(earlier.offMainCalls ?? []);
		const added = (check.offMainCalls ?? []).filter((call) => !known.has(call));

		if (added.length)
			changes.push(`${check.id} makes new off-main view calls: ${added.join(', ')}`);

		const knownErrors = new Set(earlier.errors ?? []);
		const newErrors = (check.errors ?? []).filter((error) => !knownErrors.has(error));

		if (newErrors.length) changes.push(`${check.id} logs new errors: ${newErrors.join('; ')}`);
	}

	for (const check of previous) {
		if (!after.has(check.id)) changes.push(`${check.id} was not checked this run`);
	}

	return changes;
}

/**
 * @description Renders the changes between two runs as Markdown.
 * @param changes The lines from {@link compareRuns}.
 * @returns The Markdown, saying so when nothing changed.
 */
export function renderChanges(changes: string[]): string {
	return [
		'# Changes since the previous run',
		'',
		...(changes.length ? changes.map((change) => `- ${change}`) : ['Nothing changed.']),
	].join('\n');
}

export default { compareRuns, renderChanges };
