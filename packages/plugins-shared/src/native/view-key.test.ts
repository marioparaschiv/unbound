import type { NativeObjCBridge, NativeObjectHandle } from '@unbound-app/api/native';
import { describe, expect, test } from 'bun:test';

import { viewKey } from './view-key';

type Answers = {
	hash?: () => number | bigint;
	description?: () => string;
};

const view = Object.create(null) as NativeObjectHandle;

function bridge({ hash, description }: Answers): NativeObjCBridge {
	const objc: Pick<NativeObjCBridge, 'call' | 'className' | 'invoke'> = {
		className: () => 'UIView',
		call: () => hash?.(),
		invoke: () => description?.(),
	};

	return objc as NativeObjCBridge;
}

describe('viewKey', () => {
	test('keys a view by its class and hash', () => {
		expect(viewKey(bridge({ hash: () => 42 }), view)).toBe('UIView:42');
		expect(viewKey(bridge({ hash: () => 42n }), view)).toBe('UIView:42');
	});

	test('falls back to the description when hash fails', () => {
		const objc = bridge({
			hash: () => {
				throw new Error('bridge error');
			},
			description: () => '<UIView: 0x1>',
		});

		expect(viewKey(objc, view)).toBe('UIView:<UIView: 0x1>');
	});

	test('has no key when the view exposes neither', () => {
		const objc = bridge({
			description: () => {
				throw new Error('bridge error');
			},
		});

		expect(viewKey(objc, view)).toBeUndefined();
	});
});
