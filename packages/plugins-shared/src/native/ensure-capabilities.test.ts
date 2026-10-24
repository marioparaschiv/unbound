import { expect, spyOn, test } from 'bun:test';

import { ensureCapabilities } from './ensure-capabilities';

test('passes when the loader offers every capability', () => {
	const native = { capabilities: ['native.objc.classes', 'native.objc.hooks'] as const };

	expect(ensureCapabilities('Plugin', native, ['native.objc.hooks'])).toBe(true);
});

test('fails and names the capabilities a missing bridge lacks', () => {
	const error = spyOn(console, 'error').mockImplementation(() => {});

	expect(ensureCapabilities('Plugin', { capabilities: [] }, ['native.objc.hooks'])).toBe(false);
	expect(error).toHaveBeenCalledWith(
		'[Plugin] Skipped, native capabilities not available: native.objc.hooks.',
	);

	error.mockRestore();
});
