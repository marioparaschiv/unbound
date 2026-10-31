import { ADDON_SCOPE_GLOBALS } from '@unbound-app/types/addons';
import { runInThisContext } from 'node:vm';
import { expect, test } from 'bun:test';

import { bytecodeSource } from '../src/rollup/hermes-bytecode';

type Factory = (...globals: string[]) => string[];

test('the bytecode wrapper takes the Addon scope globals in the order the client passes them', () => {
	const factory: Factory = runInThisContext(
		bytecodeSource(`[${ADDON_SCOPE_GLOBALS.join(', ')}]`),
	);

	expect(factory(...ADDON_SCOPE_GLOBALS)).toEqual([...ADDON_SCOPE_GLOBALS]);
});
