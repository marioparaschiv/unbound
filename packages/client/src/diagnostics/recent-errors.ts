import toError from '@unbound-app/utils/to-error';

/** One uncaught error or unhandled rejection, with the plugin its stack points at. */
export type RecentError = { at: number; message: string; addon?: string };

const MAX_RECENT_ERRORS = 3;
const MAX_MESSAGE_LENGTH = 160;
const PLUGIN_FRAME = /unbound-plugin\/([^\s/:)]+)\.js/;

const recent: RecentError[] = [];

/**
 * @description Remembers an uncaught error or unhandled rejection for `/debug`, keeping the newest three.
 * @param error The thrown or rejected value.
 */
// UNKNOWN: anything can be thrown or rejected.
export function recordError(error: unknown): void {
	const { message, stack = '' } = toError(error);
	const addon = PLUGIN_FRAME.exec(stack)?.[1];

	recent.push({
		at: Date.now(),
		message: message.slice(0, MAX_MESSAGE_LENGTH),
		...(addon && { addon }),
	});

	if (recent.length > MAX_RECENT_ERRORS) {
		recent.shift();
	}
}

/**
 * @description Lists the newest uncaught errors and unhandled rejections, oldest first.
 * @returns A copy of the recorded errors.
 */
export function recentErrors(): RecentError[] {
	return [...recent];
}

export default { recordError, recentErrors };
