import { describe, expect, test } from 'bun:test';
import { Value } from 'typebox/value';

import { CommandErrorCodeSchema, CommandErrorSchema } from '~/registry';

import contract from './fixtures/devtools-contract.json';

// The DevTools app reads the same codes and failures, so the CLI's error shape cannot drift from it.
describe('the DevTools contract for CLI failures', () => {
	test('lists every command error code', () => {
		expect(contract.commandErrorCodes).toEqual(
			CommandErrorCodeSchema.anyOf.map((literal) => literal.const),
		);
	});

	test('holds failures whose error the schema accepts', () => {
		for (const failure of Object.values(contract.cliFailures)) {
			expect(Value.Check(CommandErrorSchema, failure.error)).toBe(true);
		}
	});

	test('rejects an error with an unknown code', () => {
		expect(Value.Check(CommandErrorSchema, { code: 'nope', message: 'x' })).toBe(false);
	});
});
