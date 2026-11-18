import { describe, expect, test } from 'bun:test';

import { freezeCause, nativeCrashAddon, nativeCrashFrame } from '~/diagnostics/crash-title';

describe('crash titles', () => {
	test('names the first frame outside the abort machinery', () => {
		const stack = [
			'Signal 6',
			'#0 0x1 libsystem_kernel.dylib + 0x10 __pthread_kill',
			'#1 0x2 libsystem_c.dylib + 0x20 abort',
			'#2 0x3 Discord + 0x30 swift_unexpectedError',
		].join('\n');

		expect(nativeCrashFrame(stack)).toBe('swift_unexpectedError (Discord)');
	});

	test('names an image without a symbol', () => {
		expect(nativeCrashFrame('Signal 11\n#0 0x1 Unbound.dylib + 0x10')).toBe('Unbound.dylib');
	});

	test('reads only the crashing thread', () => {
		expect(
			nativeCrashFrame('Signal 11\nThread 1\n#0 0x1 Unbound.dylib + 0x10'),
		).toBeUndefined();
	});

	test('reads the addon that ran native code', () => {
		expect(nativeCrashAddon('Signal 11\nAddon {"id":"unbound.mention-avatars"}')).toBe(
			'unbound.mention-avatars',
		);
		expect(nativeCrashAddon('Signal 11\nAddon {broken')).toBeUndefined();
	});

	test('reads the native call a freeze was stuck in', () => {
		expect(
			freezeCause(
				'It has been inside the native call invoke(attributesAtIndex:effectiveRange:) for 48275 ms.',
			),
		).toEqual({ call: 'attributesAtIndex:effectiveRange:', seconds: 48 });
		expect(
			freezeCause('It has been inside the native call findViews(UIImageView) for 2500 ms.'),
		).toEqual({ call: 'findViews(UIImageView)', seconds: 3 });
		expect(freezeCause('Something else')).toBeUndefined();
	});
});
