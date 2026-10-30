import type { MeasuredCheck } from './compare-device-matrix';
import type { CycleResult } from './device-scripts';

type LogFinding = { field: 'offMainCalls' | 'errors'; label: string; separator: string };

const LOG_FINDINGS: LogFinding[] = [
	{ field: 'offMainCalls', label: 'off-main view calls', separator: ', ' },
	{ field: 'errors', label: 'errors', separator: '; ' },
];

export function applyLogPolicy(
	checks: MeasuredCheck[],
	baseline: MeasuredCheck[] | undefined,
	strict: boolean,
): MeasuredCheck[] {
	const earlier = new Map(baseline?.map((check) => [check.id, check]));

	return checks.map((check) => {
		const failures = LOG_FINDINGS.flatMap(({ field, label, separator }) => {
			const found = check[field] ?? [];
			const previous = earlier.get(check.id);
			const known = new Set(previous?.[field] ?? []);
			const flagged = strict
				? found
				: found.filter((entry) => previous !== undefined && !known.has(entry));

			return flagged.length
				? [`${strict ? '' : 'new '}${label}: ${flagged.join(separator)}`]
				: [];
		});

		if (!failures.length) return check;

		return {
			...check,
			behavior: 'fail',
			note: [check.note, ...failures].filter(Boolean).join('; '),
		};
	});
}

function lifecycleFailure(result: CycleResult): string | undefined {
	if (result.error) return result.error;
	if (!result.restarted) return 'did not start again after stopping';
	if (result.updateError) return `reload failed: ${result.updateError}`;
	if (!result.updated) return 'stopped after a reload';
	if (result.hooksStopped > result.hooksBefore) return 'stopping added native hooks';
	if (result.hooksAfter > result.hooksBefore)
		return `restarting leaked ${result.hooksAfter - result.hooksBefore} native hooks`;
	if (result.hooksUpdated > result.hooksAfter)
		return `reloading leaked ${result.hooksUpdated - result.hooksAfter} native hooks`;

	return undefined;
}

export function checkFromCycle(result: CycleResult, screenshot?: string): MeasuredCheck {
	if (!result.installed) {
		return {
			id: result.id,
			behavior: 'fail',
			lifecycle: 'fail',
			evidence: ['cycle: not installed'],
			note: 'Not installed on the device.',
		};
	}

	const evidence = [
		`cycle: hooks ${result.hooksBefore}→${result.hooksStopped}→${result.hooksAfter}→${result.hooksUpdated}`,
		...(result.selfTest ? [`self-test: ${result.selfTest.detail}`] : []),
		...(screenshot ? [`screenshot: ${screenshot}`] : []),
	];
	const failure = lifecycleFailure(result);
	const selfTestFailure =
		result.selfTest && !result.selfTest.ok
			? `self-test failed: ${result.selfTest.detail}`
			: undefined;
	const behavior = result.error || !result.updated || selfTestFailure ? 'fail' : 'pass';
	const note = [failure, selfTestFailure].filter(Boolean).join('; ');

	return {
		id: result.id,
		behavior,
		lifecycle: failure ? 'fail' : 'pass',
		evidence,
		...(note ? { note } : {}),
		metrics: {
			stopMs: result.stopMs ?? 0,
			startMs: result.startMs ?? 0,
			leakedHooks:
				Math.max(0, result.hooksAfter - result.hooksBefore) +
				Math.max(0, result.hooksUpdated - result.hooksAfter),
		},
	};
}

export function mergeChecks(previous: MeasuredCheck[], current: MeasuredCheck[]): MeasuredCheck[] {
	const updated = new Map(current.map((check) => [check.id, check]));
	const merged = previous.map((check) => updated.get(check.id) ?? check);
	const known = new Set(previous.map((check) => check.id));

	return [...merged, ...current.filter((check) => !known.has(check.id))];
}
