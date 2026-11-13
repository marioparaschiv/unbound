import { expect, test } from 'bun:test';

import { listCheckIds } from '~/lib/check/registry';
import { CHECK_IDS } from '~/lib/check/check-ids';

test('CHECK_IDS lists the registered checks in run order', () => {
	expect([...CHECK_IDS]).toEqual(listCheckIds());
});
