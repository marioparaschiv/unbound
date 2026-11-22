import type {
	CrashOrigin,
	CrashReport,
	CrashUnfiledReason,
} from '@unbound-app/contracts/crash-reports';

const NATIVE_IMAGE = /^#\d+\s+(?:0x[0-9a-f]+\s+)?(\S+)\s+\+\s+0x/i;
const JAVA_FRAME = /^#\d+\s+at\s+([\w$.]+)/;
const UNBOUND_IMAGE = /^(Unbound|libunbound)/i;
const UNBOUND_JAVA = /^app\.unbound\./;
const DISCORD_IMAGE =
	/^(Discord|DiscordKit|libdiscore|libdiscord|hermes|libhermes|React|libreactnative|libjsi|libfbjni|yoga)/i;
const DISCORD_JAVA = /^(com\.discord\.|com\.facebook\.react\.|com\.facebook\.hermes\.)/;
const THREAD_SECTIONS = /^(Registers|Thread) /;
const ADDON_LINE = /^Addon (\{.*\})$/;

function crashingThread(stack: string | undefined): string[] {
	const lines = (stack ?? '').split('\n');
	const end = lines.findIndex((line) => THREAD_SECTIONS.test(line));

	return end === -1 ? lines : lines.slice(0, end);
}

function frameOwner(line: string): 'unbound' | 'discord' | undefined {
	const image = NATIVE_IMAGE.exec(line)?.[1];
	const java = JAVA_FRAME.exec(line)?.[1];

	if ((image && UNBOUND_IMAGE.test(image)) || (java && UNBOUND_JAVA.test(java))) {
		return 'unbound';
	}

	if ((image && DISCORD_IMAGE.test(image)) || (java && DISCORD_JAVA.test(java))) {
		return 'discord';
	}

	return undefined;
}

/**
 * @description Reads the addon a native crash names on its `Addon {...}` line: the addon that was running native code.
 * @param stack The crash's stack.
 * @returns The addon's id, or `undefined` when no addon was running.
 */
export function nativeCrashAddon(stack: string | undefined): string | undefined {
	for (const line of crashingThread(stack)) {
		const record = ADDON_LINE.exec(line)?.[1];

		if (record) {
			try {
				const parsed: unknown = JSON.parse(record);

				if (
					typeof parsed === 'object' &&
					parsed !== null &&
					'id' in parsed &&
					typeof parsed.id === 'string'
				) {
					return parsed.id;
				}
			} catch {
				return undefined;
			}
		}
	}

	return undefined;
}

function injectedName(entry: string): string {
	return entry.replace(/ \(.*\)$| \S+$/, '').toLowerCase();
}

/**
 * @description Names the injected library a native crash happened in: the crashing thread's topmost frame that belongs to
 * Unbound, Discord or a library the report lists as injected, when it is the injected one.
 * @param report The crash report.
 * @returns The injected library as the report lists it, such as `Choicy (com.opa334.choicy)`, or `undefined`.
 */
export function crashingTweak(report: CrashReport): string | undefined {
	const injected = report.context?.injected ?? [];

	if (report.kind !== 'native-crash' || !injected.length) {
		return undefined;
	}

	for (const line of crashingThread(report.stack)) {
		const image = NATIVE_IMAGE.exec(line)?.[1];

		if (!image) {
			continue;
		}

		const name = image.replace(/\.dylib$/i, '').toLowerCase();
		const tweak = injected.find((entry) => injectedName(entry) === name);

		if (tweak) {
			return tweak;
		}

		if (frameOwner(line)) {
			return undefined;
		}
	}

	return undefined;
}

/**
 * @description Decides where a crash came from: an addon it names, Unbound's own code or frames, Discord's binaries, or
 * only the system's, from the crashing thread's frames.
 * @param report The crash report.
 * @returns The origin.
 */
export function crashOrigin(report: CrashReport): CrashOrigin {
	if (report.addon || nativeCrashAddon(report.stack)) {
		return 'addon';
	}

	if (report.kind !== 'native-crash') {
		return 'unbound';
	}

	const owners = crashingThread(report.stack).map(frameOwner);

	if (owners.includes('unbound')) {
		return 'unbound';
	}

	return owners.includes('discord') ? 'discord' : 'system';
}

/**
 * @description Whether a crash goes on GitHub: every crash, from Unbound, Discord or the system, except one a
 * third-party or unsigned addon caused, which belongs to that addon's author.
 * @param report The crash report.
 * @param origin Where the crash came from.
 * @returns Whether to open or join an issue for it.
 */
export function filesIssue(report: CrashReport, origin: CrashOrigin): boolean {
	if (crashingTweak(report)) {
		return false;
	}

	if (origin !== 'addon') {
		return true;
	}

	if (report.addon?.trust === 'unsigned') {
		return false;
	}

	const addon = report.addon?.id ?? nativeCrashAddon(report.stack);

	return Boolean(addon?.startsWith('unbound.'));
}

/**
 * @description Says why a crash got no GitHub issue: a third-party addon caused it, the server has no GitHub token, or
 * GitHub did not open the issue.
 * @param report The crash report.
 * @param origin Where the crash came from.
 * @param canFile Whether the server has a token to file issues with.
 * @returns The reason.
 */
export function unfiledReason(
	report: CrashReport,
	origin: CrashOrigin,
	canFile: boolean,
): CrashUnfiledReason {
	if (!filesIssue(report, origin)) {
		return 'third-party';
	}

	return canFile ? 'failed' : 'unavailable';
}
