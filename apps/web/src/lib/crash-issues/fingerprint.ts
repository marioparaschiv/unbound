import type { CrashReport } from '@unbound-app/contracts/crash-reports';

const TOP_FRAMES = 6;
const NATIVE_FRAME = /^#\d+\s+(?:0x[0-9a-f]+\s+)?(\S+)\s+\+\s+0x[0-9a-f]+(?:\s+(\S+))?/i;
const JAVA_FRAME = /^#\d+\s+at\s+([^(]+)/;
const JS_FRAME = /^\s*at\s+([^\s(]+)/;

function nativeFrame(line: string): string | undefined {
	const match = NATIVE_FRAME.exec(line);

	return match ? [match[1], match[2]].filter(Boolean).join(' ') : undefined;
}

function frameName(line: string): string | undefined {
	const native = nativeFrame(line);

	if (native) {
		return native;
	}

	const java = JAVA_FRAME.exec(line)?.[1];

	if (java) {
		return java.trim();
	}

	const script = JS_FRAME.exec(line)?.[1];

	return script && !script.startsWith('anonymous') ? script : undefined;
}

/**
 * @description Reads the crash's headline from its stack: the signal and exception of a native crash, or the first
 * line of a JavaScript error with its numbers blanked, since ids and counts differ between reports of one crash.
 * @param report The crash report.
 * @returns The headline.
 */
export function crashHeadline(report: CrashReport): string {
	const lines = (report.stack ?? '').split('\n');
	const exception = lines.find((line) => line.startsWith('Exception '));
	const signal = lines.find((line) => line.startsWith('Signal '));

	if (exception) {
		return exception.slice('Exception '.length).split(':')[0]!.trim();
	}

	if (signal) {
		return signal.trim();
	}

	return (report.message ?? lines[0] ?? report.kind)
		.split('\n')[0]!
		.replace(/\d+/g, '#')
		.slice(0, 160);
}

/**
 * @description Names the frames that identify a crash: the top frames of its stack by image and symbol, without the
 * addresses and offsets that change between builds.
 * @param stack The stack.
 * @returns Up to six frame names.
 */
export function crashFrames(stack: string | undefined): string[] {
	return (stack ?? '')
		.split('\n')
		.map(frameName)
		.filter((frame): frame is string => Boolean(frame))
		.slice(0, TOP_FRAMES);
}

/**
 * @description Fingerprints a crash so reports of the same crash share one issue: its kind, platform, addon,
 * headline and top frames.
 * @param report The crash report.
 * @returns A 16-character hex fingerprint.
 */
export function crashFingerprint(report: CrashReport): string {
	const parts = [
		report.kind,
		report.platform,
		report.addon?.id ?? '',
		crashHeadline(report),
		...crashFrames(report.stack),
	];

	return new Bun.CryptoHasher('sha256').update(parts.join('\n')).digest('hex').slice(0, 16);
}

export default { crashFingerprint, crashFrames, crashHeadline };
