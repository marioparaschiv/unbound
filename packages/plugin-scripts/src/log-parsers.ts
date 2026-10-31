import { SELF_TEST_MARKER } from './loader-self-test';

const OFF_MAIN_WARNING = /^(\S+) W \[plugins\] (.+?) called (.+?) off the main thread\./;
const HOOK_FAILURE = /^(\S+) E \[plugins\] Native plugin (?:hook|callback) failed in (.+?): (.*)$/;
const CONSOLE_ERROR = /^(\S+) E \[console\] '?\[([^\]:]+)(?::[^\]]*)?\]:? ?'?,? ?(.*)$/;
const ERROR_LENGTH = 160;
const REPEAT_SUFFIX = / \[repeated \d+ times\]$/;
const SKIPPED_HOOK =
	/^(\S+) \w \[plugins\] Native plugin hook skipped in (.+?): the JavaScript thread did not answer the (\S+) hook/;
const TOAST_LINE =
	/^(\S+) \w \[console\] .*\[Toasts\]'?,? ?'?(Showing a toast:|Ignored a (?:Discord )?toast[^']*)'?,? ?'?([^']*)/;
const STACK_FRAME = /\bat ([\w$.]+) \(/g;
const TOAST_FRAMES = new Set(['Error', 'showToast', 'addToast', 'open', 'instead']);

export function withoutSelfTest(errors: Map<string, string[]>): Map<string, string[]> {
	return new Map(
		[...errors]
			.map(
				([plugin, found]) =>
					[plugin, found.filter((error) => !error.includes(SELF_TEST_MARKER))] as const,
			)
			.filter(([, found]) => found.length > 0),
	);
}

function errorText(text: string): string {
	return text.replace(REPEAT_SUFFIX, '').replace(/\s+/g, ' ').trim().slice(0, ERROR_LENGTH);
}

export function parsePluginErrors(lines: string[], since: string): Map<string, string[]> {
	const errors = new Map<string, Set<string>>();

	for (const line of lines) {
		const match = HOOK_FAILURE.exec(line) ?? CONSOLE_ERROR.exec(line);

		if (!match || match[1]! < since) continue;

		const message = errorText(match[3]!);

		if (!message) continue;

		const plugin = errors.get(match[2]!) ?? new Set<string>();

		plugin.add(message);
		errors.set(match[2]!, plugin);
	}

	return new Map([...errors].map(([plugin, found]) => [plugin, [...found].sort()]));
}

export function parseOffMainWarnings(lines: string[], since: string): Map<string, string[]> {
	const calls = new Map<string, Set<string>>();

	for (const line of lines) {
		const match = OFF_MAIN_WARNING.exec(line);

		if (!match || match[1]! < since) continue;

		const plugin = calls.get(match[2]!) ?? new Set<string>();

		plugin.add(match[3]!);
		calls.set(match[2]!, plugin);
	}

	return new Map([...calls].map(([plugin, found]) => [plugin, [...found].sort()]));
}

export function parseSkippedHooks(lines: string[], since: string): Map<string, string[]> {
	const skipped = new Map<string, Set<string>>();

	for (const line of lines) {
		const match = SKIPPED_HOOK.exec(line);

		if (!match || match[1]! < since) continue;

		const plugin = skipped.get(match[2]!) ?? new Set<string>();

		plugin.add(match[3]!);
		skipped.set(match[2]!, plugin);
	}

	return new Map([...skipped].map(([plugin, found]) => [plugin, [...found].sort()]));
}

export function parseToastLines(lines: string[], since: string): string[] {
	return lines.flatMap((line) => {
		const match = TOAST_LINE.exec(line);

		if (!match || match[1]! < since) return [];

		if (match[2]!.startsWith('Showing')) return [match[3]!.trim() || 'untitled'];

		const caller = toastCaller(match[3]!);

		return [caller ? `empty toast from ${caller}` : 'empty toast'];
	});
}

export function toastCaller(stack: string): string | undefined {
	return [...stack.matchAll(STACK_FRAME)]
		.map((frame) => frame[1]!)
		.find((name) => !TOAST_FRAMES.has(name) && name !== 'anonymous' && name !== 'eval');
}

export function isEmptyToast(toast: string): boolean {
	return toast.startsWith('empty toast');
}
