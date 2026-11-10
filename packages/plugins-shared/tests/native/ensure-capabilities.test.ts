import { installAddonGlobals } from '@unbound-app/api/testing/fakes';
import { expect, test } from 'bun:test';

import { ensureCapabilities } from '~/native/ensure-capabilities';

const { logs } = installAddonGlobals();

test('passes when the loader offers every capability', () => {
	const native = { capabilities: ['native.objc.classes', 'native.objc.hooks'] as const };

	expect(ensureCapabilities(native, ['native.objc.hooks'])).toBe(true);
});

test('fails and names the capabilities a missing bridge lacks', () => {
	expect(ensureCapabilities({ capabilities: [] }, ['native.objc.hooks'])).toBe(false);
	expect(logs.at(-1)).toEqual({
		level: 'error',
		args: ['Skipped, native capabilities not available: native.objc.hooks.'],
	});
});
