import type { NativeClassHandle, NativeObjCBridge } from '@unbound-app/api/native';
import { describe, expect, spyOn, test } from 'bun:test';

import { ensureClasses } from './ensure-classes';

type ClassLookup = Pick<NativeObjCBridge, 'getClass'>;

function classHandle(): NativeClassHandle {
	return Object.create(null);
}

function bridgeWith(...available: string[]): NativeObjCBridge {
	const lookup: ClassLookup = {
		getClass: (name) => (available.includes(name) ? classHandle() : null),
	};

	return lookup as NativeObjCBridge;
}

describe('ensureClasses', () => {
	test('passes when every class exists', () => {
		expect(
			ensureClasses('Plugin', bridgeWith('UIView', 'UILabel'), ['UIView', 'UILabel']),
		).toBe(true);
	});

	test('fails and names only the missing classes', () => {
		const error = spyOn(console, 'error').mockImplementation(() => {});

		expect(ensureClasses('Plugin', bridgeWith('UIView'), ['UIView', 'YYLabel'])).toBe(false);
		const message = String(error.mock.calls[0]?.[0]);

		expect(message).toContain('YYLabel');
		expect(message).not.toContain('UIView');

		error.mockRestore();
	});
});
