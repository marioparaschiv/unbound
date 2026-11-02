import { SchemaError } from '@unbound-app/contracts/schema-error';

/**
 * @description Narrows a value the client built itself to its contract, the way `parse` did before
 * the client switched to generated checks: throws a {@link SchemaError} naming the contract when the
 * value does not match.
 * @template T What the check narrows to.
 * @param value The value to check.
 * @param check The generated contract check.
 * @param contract What the value should be, such as `The sync document`.
 * @returns The value, narrowed.
 */
// UNKNOWN: a value the client assembled, which the contract has not checked yet.
export function expectContract<T>(
	value: unknown,
	check: (value: unknown) => value is T,
	contract: string,
): T {
	if (!check(value)) {
		throw new SchemaError([{ path: '', message: `${contract} does not match the contract.` }]);
	}

	return value;
}
