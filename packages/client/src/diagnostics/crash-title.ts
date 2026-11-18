const NATIVE_FRAME = /^#\d+\s+(?:0x[0-9a-f]+\s+)?(\S+)\s+\+\s+0x[0-9a-f]+(?:\s+(\S+))?/i;
const SYSTEM_ABORT_IMAGE =
	/^(libsystem_kernel|libsystem_c|libsystem_pthread|libsystem_platform|libc\+\+abi|libdyld|libc\.so|libart\.so)/i;
const NATIVE_CALL_FREEZE = /native call (?:invoke\((.+)\)|(.+?)) for (\d+) ms/;
const ADDON_LINE = /^Addon (\{.*\})$/m;
const HANG_LINE = /^Hang (.+)$/;

/** What froze Discord, read from a freeze's detail. */
export type FreezeCause = { call: string; seconds: number };

function frameName(line: string): string | undefined {
	const match = NATIVE_FRAME.exec(line);

	if (!match || SYSTEM_ABORT_IMAGE.test(match[1])) {
		return undefined;
	}

	return match[2] ? `${match[2]} (${match[1]})` : match[1];
}

/**
 * @description Names where a native crash happened: the first frame of its stack outside the system's abort machinery.
 * @param stack The native crash's stack.
 * @returns The symbol and image, such as `objc_msgSend (libobjc.A.dylib)`, or `undefined` when no frame names one.
 */
export function nativeCrashFrame(stack: string): string | undefined {
	for (const line of stack.split('\n')) {
		if (line.startsWith('Thread ') || line.startsWith('Registers ')) {
			return undefined;
		}

		const name = frameName(line);

		if (name) {
			return name;
		}
	}

	return undefined;
}

/**
 * @description Reads the addon a native crash names on its `Addon {...}` line: the addon that was running native code.
 * @param stack The native crash's stack.
 * @returns The addon's id, or `undefined` when none was running.
 */
export function nativeCrashAddon(stack: string): string | undefined {
	const record = ADDON_LINE.exec(stack)?.[1];

	if (!record) {
		return undefined;
	}

	try {
		const parsed: unknown = JSON.parse(record);

		return typeof parsed === 'object' &&
			parsed !== null &&
			'id' in parsed &&
			typeof parsed.id === 'string'
			? parsed.id
			: undefined;
	} catch {
		return undefined;
	}
}

/**
 * @description Reads which native call a freeze was stuck in, from the loader's freeze detail.
 * @param detail The freeze's detail, such as `It has been inside the native call invoke(sleep) for 6686 ms.`
 * @returns The call and how long it ran, in whole seconds, or `undefined` for any other detail.
 */
export function freezeCause(detail: string): FreezeCause | undefined {
	const match = NATIVE_CALL_FREEZE.exec(detail);

	return match
		? { call: match[1] ?? match[2], seconds: Math.round(Number(match[3]) / 1000) }
		: undefined;
}

/**
 * @description Reads how long a MetricKit hang lasted from its first stack line, such as `Hang 4 sec`.
 * @param message The hang's message.
 * @returns The duration as MetricKit wrote it, or `undefined` for any other message.
 */
export function hangDuration(message: string): string | undefined {
	return HANG_LINE.exec(message)?.[1];
}
