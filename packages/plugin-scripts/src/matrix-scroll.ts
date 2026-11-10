import type { MeasuredCheck } from './compare-device-matrix';
import { evaluateJson } from './device';
import { scrollStress, type ScrollOutcome } from './device-io';
import {
	logLinesSchema,
	redrawTimesSchema,
	redrawTimesScript,
	selfTestReportsSchema,
	selfTestsScript,
	toastLogScript,
} from './device-scripts';
import { scrollFillerScript } from './fixture-scripts';
import { isEmptyToast, parseToastLines } from './log-parsers';
import type { MatrixSession } from './matrix-session';

export type ScrollReport = ScrollOutcome & { toasts: string[]; emptyToasts: string[] };

const SCROLL_REDRAW_LIMIT_MS = 2_000;
// Toasts close on their own timers and the SDK reports no open toasts, so the scroll waits out
// the longest a toast from the plugin cycles stays up before it counts toasts as its own.
const TOAST_SETTLE_MS = 5_500;

function recordScrollProblem(check: MeasuredCheck, detail: string) {
	const problem = `after scrolling: ${detail}`;

	check.behavior = 'fail';
	check.note = [check.note, problem].filter(Boolean).join('; ');
	check.visualProblems = [...(check.visualProblems ?? []), problem];
}

/**
 * @description Stages filler, scrolls the chat away and back, times each plugin's redraw and fails plugins whose self-test then finds stale drawing.
 * @param session The run.
 * @param checks The checks to add redraw times and problems to.
 * @param since When the run began, for the empty toasts it showed at any point.
 * @returns How the scroll went and the toasts it showed.
 */
export async function scrollPhase(
	session: MatrixSession,
	checks: MeasuredCheck[],
	since: string,
): Promise<ScrollReport> {
	const { device, fixtures, out } = session;

	if (fixtures) await device.evaluate(scrollFillerScript(fixtures.channel));

	await device.sleep(TOAST_SETTLE_MS);

	const scrollSince = new Date().toISOString();
	const { swipes, moved } = await scrollStress(device, out);
	// The redraw script returns once every plugin reports drawn, so the self-tests below read settled screens.
	const redraws = await evaluateJson(
		device,
		redrawTimesScript(SCROLL_REDRAW_LIMIT_MS),
		redrawTimesSchema,
	);

	for (const check of checks) {
		if (redraws[check.id] !== undefined) check.redrawMs = redraws[check.id];
	}

	const afterScroll = await evaluateJson(device, selfTestsScript(), selfTestReportsSchema);

	for (const check of checks) {
		const report = afterScroll[check.id];

		if (report && !report.ok && !report.nothingDrawn) recordScrollProblem(check, report.detail);
	}

	const toastLines = await evaluateJson(device, toastLogScript(), logLinesSchema);

	return {
		swipes,
		moved,
		toasts: parseToastLines(toastLines, scrollSince),
		emptyToasts: parseToastLines(toastLines, since).filter(isEmptyToast),
	};
}

export default { scrollPhase };
