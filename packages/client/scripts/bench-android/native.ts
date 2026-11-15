import type { TimedSpan } from './spans';

/** One line the loader logged under the `Unbound` tag: device epoch ms and the message. */
export type NativeLine = [at: number, message: string];

/** A loader phase: from the first line matching `start` to the next line matching `end`. */
type Phase = { name: string; start: RegExp; end: RegExp };

// Messages from packages/loader/core; a phase whose lines are missing is left out of that launch.
const PHASES: Phase[] = [
	{
		name: 'loader runtime → bundle executed',
		start: /Discord's runtime was created/,
		end: /^\[default\] Bundle executed|No saved bundle to run/,
	},
	{
		name: 'loader update check',
		start: /Ensuring bundle is up to date/,
		end: /No update found|Bundle candidate is ready|Bundle download failed|Refused the update|keeping the cached bundle/,
	},
	{
		name: 'loader manifest fetch',
		start: /Ensuring bundle is up to date/,
		end: /Manifest bytecode versions|No usable manifest/,
	},
	{
		name: 'loader bundle download',
		start: /Bundle manifest verified|Bundle signature check skipped/,
		end: /Bundle signature verified|Bundle candidate is ready|No update found|Bundle download failed/,
	},
	{
		name: 'loader first download wait',
		start: /Ensuring bundle is up to date/,
		end: /Downloaded Unbound's first bundle in time/,
	},
	{
		name: 'loader evaluate bundle',
		start: /Evaluating Unbound's bundle/,
		end: /bundle was successfully executed|Bundle validation marker|failed to evaluate/i,
	},
	{
		name: 'loader client update check',
		start: /The client asked whether a newer bundle exists/,
		end: /\[updater\] (No update found|Bundle manifest verified|Manifest bytecode versions)|Refused the update/,
	},
	{
		name: 'loader runtime → first screen',
		start: /Discord's runtime was created/,
		end: /Discord's first screen rendered/,
	},
];

// `adb logcat -v epoch`: "<seconds.millis> <pid> <tid> <level> <tag>: <message>".
const LINE = /^\s*(\d+\.\d+)\s+\d+\s+\d+\s+[VDIWEF]\s+Unbound\s*:\s?(.*)$/;

/**
 * @description Reads the loader's lines out of a logcat dump.
 * @param logcat The output of `adb logcat -d -v epoch` for Discord's process.
 * @returns Each `Unbound` line, in order.
 */
export function parseNativeLines(logcat: string): NativeLine[] {
	return logcat.split('\n').flatMap((line) => {
		const match = LINE.exec(line.trimEnd());

		return match ? [[Math.round(Number(match[1]) * 1000), match[2] ?? ''] as NativeLine] : [];
	});
}

/**
 * @description Turns the loader's log lines into its startup phases, such as the update check and the bundle's
 * evaluation, so a trace shows the native side next to the client's spans.
 * @param lines The loader's lines from one launch.
 * @returns One span per phase found, named `loader …`.
 */
export function nativeSpans(lines: NativeLine[]): TimedSpan[] {
	return PHASES.flatMap(({ name, start, end }) => {
		const from = lines.findIndex(([, message]) => start.test(message));

		if (from < 0) {
			return [];
		}

		const to = lines.slice(from + 1).find(([, message]) => end.test(message));

		return to ? [{ name, start: lines[from][0], end: to[0] }] : [];
	});
}
