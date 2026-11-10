import type { NativeClassHandle, NativeObjCBridge } from '@unbound-app/api/native';
import { installAddonGlobals } from '@unbound-app/api/testing/fakes';
import { describe, expect, test } from 'bun:test';

import { ensureClasses } from '~/native/ios/ensure-classes';

const { logs } = installAddonGlobals();

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
		expect(ensureClasses(bridgeWith('UIView', 'UILabel'), ['UIView', 'UILabel'])).toBe(true);
	});

	test('fails and names only the missing classes', () => {
		expect(ensureClasses(bridgeWith('UIView'), ['UIView', 'YYLabel'])).toBe(false);
		const message = String(logs.at(-1)?.args[0]);

		expect(message).toContain('YYLabel');
		expect(message).not.toContain('UIView');
	});
});
