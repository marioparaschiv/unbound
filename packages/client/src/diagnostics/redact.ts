import type { DebugInfo } from './format-debug-info';

const REPLACEMENTS: [RegExp, string][] = [
	[/\bmfa\.[\w-]{80,}/g, '<token>'],
	[/\b[\w-]{24,28}\.[\w-]{6}\.[\w-]{27,40}\b/g, '<token>'],
	[/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, '<email>'],
	[
		/([?&#](?:token|access_token|key|signature|sig|auth|code|password)=)[^&#\s]+/gi,
		'$1<redacted>',
	],
	[/\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g, '<ip>'],
	[/\b(?:[\da-f]{1,4}:){3,7}[\da-f]{1,4}\b/gi, '<ip>'],
	[/\b(?:[\da-f]{1,4}:)+:(?:[\da-f]{1,4}(?::[\da-f]{1,4})*)?\b/gi, '<ip>'],
	[/\b\d{17,20}\b/g, '<id>'],
	[/\/Users\/[^/\s]+/g, '/Users/<user>'],
	[/\/home\/[^/\s]+/g, '/home/<user>'],
];

const VERBATIM_KEYS = new Set<PropertyKey>([
	'client',
	'commit',
	'loader',
	'discord',
	'discordBuild',
	'react',
	'reactNative',
	'hermes',
	'bytecode',
	'os',
	'osBeta',
	'entitlements',
	'enabledPlugins',
	'experiments',
	'utcOffset',
]);

/**
 * @description Replaces user and message IDs, tokens, email and IP addresses, secrets in URLs and home folder names in a text.
 * @param text The text, such as an error message.
 * @returns The text with each match replaced by a placeholder like `<id>`.
 */
export function redactText(text: string): string {
	return REPLACEMENTS.reduce(
		(result, [pattern, replacement]) => result.replace(pattern, replacement),
		text,
	);
}

function redactValue<T>(value: T, key?: PropertyKey): T {
	if (typeof value === 'string') {
		return (key !== undefined && VERBATIM_KEYS.has(key) ? value : redactText(value)) as T;
	}

	if (Array.isArray(value)) {
		return value.map((item) => redactValue(item, key)) as T;
	}

	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(([name, item]) => [name, redactValue(item, name)]),
		) as T;
	}

	return value;
}

/**
 * @description Scrubs every free-text field of a debug report, leaving version fields and the entitlements as they are.
 * @param info The report.
 * @returns A copy safe to post in a public channel.
 */
export function redactReport(info: DebugInfo): DebugInfo {
	return redactValue(info);
}

export default redactReport;
