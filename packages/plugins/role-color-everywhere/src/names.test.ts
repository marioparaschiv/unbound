import { expect, test } from 'bun:test';

import { presentNames, uniqueNames } from '~/names';

test('presentNames drops missing and empty names', () => {
	expect(presentNames('Ann', null, '', undefined, 'ann')).toEqual(['Ann', 'ann']);
});

test('uniqueNames leaves out a name two owners share', () => {
	const names = uniqueNames([
		[['Ann', 'ann'], 'first'],
		[['Ann', 'Bob', 'Bob'], 'second'],
		[['Ann'], 'third'],
	]);

	expect([...names]).toEqual([
		['ann', 'first'],
		['Bob', 'second'],
	]);
});
