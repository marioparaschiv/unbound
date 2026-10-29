import { CRASH_REPORT_LOG_LIMIT, crashReportSchema } from '@unbound-app/contracts/crash-reports';
import type { CrashReport } from '@unbound-app/contracts/crash-reports';

/** The addon a report is about. */
export type CrashReportAddon = NonNullable<CrashReport['addon']>;

/** What an addon manager knows about a failure; the reporter adds the app, loader and device details. */
export type CrashEvent = Pick<
	CrashReport,
	'kind' | 'addon' | 'phase' | 'seconds' | 'message' | 'stack'
>;

/** The app, loader and device details every report carries. */
export type CrashEnvironment = Pick<
	CrashReport,
	| 'platform'
	| 'clientVersion'
	| 'loaderVersion'
	| 'discordVersion'
	| 'osVersion'
	| 'deviceModel'
	| 'verifiedBuild'
>;

const LOG_LINE_LIMIT = 500;

const REDACTED = '[redacted]';

const SECRET_PATTERNS = [
	/[\w-]{24,28}\.[\w-]{6}\.[\w-]{27,38}/g,
	/mfa\.[\w-]{84}/g,
	/\bBearer\s+[\w.~+/=-]+/gi,
	/\b(authorization|token|password|secret|cookie)(["']?\s*[:=]\s*["']?)[^\s"',}]+/gi,
	/[\w.+-]+@[\w-]+\.[\w.-]+/g,
];

/**
 * @description Removes tokens, credentials and email addresses from a log line.
 * @param line One line of the loader's log.
 * @returns The line with every secret replaced by a marker.
 */
export function scrubLogLine(line: string): string {
	return SECRET_PATTERNS.reduce(
		(scrubbed, pattern) =>
			scrubbed.replace(pattern, (match: string, key?: string, separator?: string) =>
				typeof key === 'string' && typeof separator === 'string'
					? `${key}${separator}${REDACTED}`
					: REDACTED,
			),
		line,
	);
}

/**
 * @description Takes the newest lines of the loader's log that fit in a report, scrubbed and trimmed.
 * @param log The log file's contents.
 * @returns The excerpt, oldest line first, or `undefined` when there is nothing to send.
 */
export function crashLogExcerpt(log: string): string | undefined {
	const kept: string[] = [];
	let size = 0;
	const lines = log.split('\n').filter((line) => line.trim() !== '');

	for (let index = lines.length - 1; index >= 0; index--) {
		const line = scrubLogLine(lines[index] ?? '').slice(0, LOG_LINE_LIMIT);

		if (size + line.length + 1 > CRASH_REPORT_LOG_LIMIT) {
			break;
		}

		kept.unshift(line);
		size += line.length + 1;
	}

	return kept.length ? kept.join('\n') : undefined;
}

/**
 * @description Builds the report for an event, trimming text to the limits the API accepts.
 * @param event The failure the manager saw.
 * @param environment The app, loader and device details.
 * @param log The loader's log file, whose newest lines go into the report scrubbed of secrets.
 * @returns The validated report, or `undefined` when the details don't validate.
 */
export function buildCrashReport(
	event: CrashEvent,
	environment: CrashEnvironment,
	log?: string,
): CrashReport | undefined {
	const excerpt = log === undefined ? undefined : crashLogExcerpt(log);
	const parsed = crashReportSchema.safeParse({
		...event,
		...environment,
		...(excerpt === undefined ? {} : { log: excerpt }),
		...(event.message === undefined ? {} : { message: event.message.slice(0, 2_000) }),
		...(event.stack === undefined ? {} : { stack: event.stack.slice(0, 16_000) }),
		loaderVersion: environment.loaderVersion.slice(0, 64),
		discordVersion: environment.discordVersion.slice(0, 64),
		osVersion: environment.osVersion.slice(0, 64),
		deviceModel: environment.deviceModel.slice(0, 64),
	});

	return parsed.success ? parsed.data : undefined;
}
