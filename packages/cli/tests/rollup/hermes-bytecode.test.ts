import { ADDON_SCOPE_GLOBALS } from '@unbound-app/types/addons';
import { runInThisContext } from 'node:vm';
import { expect, test } from 'bun:test';

import { bytecodeSource } from '../src/rollup/hermes-bytecode';

type Factory = (...globals: string[]) => string[];

type OlderClientFactory = (react: string) => [string, boolean, boolean];

test('the bytecode wrapper takes the Addon scope globals in the order the client passes them', () => {
	const factory: Factory = runInThisContext(
		bytecodeSource(`[${ADDON_SCOPE_GLOBALS.join(', ')}]`),
	);

	expect(factory(...ADDON_SCOPE_GLOBALS)).toEqual([...ADDON_SCOPE_GLOBALS]);
});

test('on a client that passes only React, unbound and the timers resolve to the globals', () => {
	const unbound = { patcher: {} };

	Reflect.set(globalThis, 'unbound', unbound);

	try {
		const factory: OlderClientFactory = runInThisContext(
			bytecodeSource(
				'[React, unbound === globalThis.unbound, setTimeout === globalThis.setTimeout]',
			),
		);

		expect(factory('react')).toEqual(['react', true, true]);
	} finally {
		Reflect.deleteProperty(globalThis, 'unbound');
	}
});
