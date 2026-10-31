import { expect, test } from 'bun:test';

import { typeErrors } from './typecheck-plugins';

test('keeps only the lines tsc reports errors on', () => {
	expect(
		typeErrors(
			"src/index.ts(1,2): error TS2345: Argument of type 'string'.\n  Details on the next line\nFound 1 error.\n",
		),
	).toEqual(["src/index.ts(1,2): error TS2345: Argument of type 'string'."]);
});
