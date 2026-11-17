import type { CrashEvent } from '~/diagnostics/crash-report';
import { getSetting, setSetting } from '~/settings/unbound';

const REPEAT_WINDOW_MS = 3_600_000;
const SIGNATURE_MESSAGE_LENGTH = 200;

/**
 * @description Names a crash by its kind, addon and message, so a crash loop's reports match.
 * @param event The crash.
 * @returns The signature.
 */
export function crashSignature(event: CrashEvent): string {
	return [
		event.kind,
		event.addon?.id ?? '',
		(event.message ?? '').slice(0, SIGNATURE_MESSAGE_LENGTH),
	].join('|');
}

/**
 * @description Tells whether the same crash was already reported within the last hour.
 * @param signature The crash's signature.
 * @param now The current time.
 * @returns Whether it was.
 */
export function wasJustReported(signature: string, now = Date.now()): boolean {
	return (
		getSetting('crash-reports.lastSignature') === signature &&
		now - getSetting('crash-reports.lastSentAt') < REPEAT_WINDOW_MS
	);
}

/**
 * @description Remembers that a crash was reported, so its repeats within the hour are not sent again.
 * @param signature The crash's signature.
 * @param now The current time.
 */
export function rememberReported(signature: string, now = Date.now()): void {
	setSetting('crash-reports.lastSignature', signature);
	setSetting('crash-reports.lastSentAt', now);
}

/**
 * @description Counts how often the loader saw the same native crash within the last hour.
 * @param crash The crash's description.
 * @param history The loader's crash history.
 * @param now The current time.
 * @returns The count, or `undefined` when it happened once.
 */
export function repeatsOf(
	crash: string | undefined,
	history: { at: number; crash: string }[] = [],
	now = Date.now(),
): number | undefined {
	const count = history.filter(
		(entry) => entry.crash === crash && now - entry.at < REPEAT_WINDOW_MS,
	).length;

	return count > 1 ? Math.min(count, 1_000) : undefined;
}
