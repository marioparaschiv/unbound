import { ensureCapabilities } from '@unbound-plugins/shared/native/ensure-capabilities';
import { expect, spyOn, test } from 'bun:test';

test('passes when the loader offers every capability', () => {
	const native = { capabilities: ['native.objc.classes', 'native.objc.hooks'] as const };

	expect(ensureCapabilities('Plugin', native, ['native.objc.hooks'])).toBe(true);
});

test('fails and names the capabilities a missing bridge lacks', () => {
	const error = spyOn(console, 'error').mockImplementation(() => {});

	expect(ensureCapabilities('Plugin', { capabilities: [] }, ['native.objc.hooks'])).toBe(false);
	expect(String(error.mock.calls[0]?.[0])).toContain('native.objc.hooks');

	error.mockRestore();
});
