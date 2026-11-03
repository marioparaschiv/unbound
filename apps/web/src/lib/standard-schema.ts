import type { StaticDecode, TSchema } from '@unbound-app/contracts/schema';
import { safeParse } from '@unbound-app/contracts/schema';

type StandardIssue = { path: string[]; message: string };

/** What a Standard Schema validator returns: the decoded value, or every issue it found. */
export type StandardSchemaResult<T> = { value: T } | { issues: StandardIssue[] };

/** The one member of the Standard Schema interface a form or router validator reads. */
export type StandardSchema<T> = {
	readonly '~standard': {
		readonly version: 1;
		readonly vendor: string;
		readonly validate: (
			// UNKNOWN: the form or route value before the schema checks it.
			value: unknown,
		) => StandardSchemaResult<T>;
	};
};

/**
 * @description Wraps a contract schema as a Standard Schema validator, so a form or router validates with it.
 * @template T The contract schema.
 * @param schema The contract schema.
 * @returns The validator `~standard` readers such as TanStack Form and TanStack Router call.
 */
export function standardSchema<T extends TSchema>(schema: T): StandardSchema<StaticDecode<T>> {
	return {
		'~standard': {
			version: 1,
			vendor: 'unbound',
			validate: (value) => {
				const result = safeParse(schema, value);

				if (result.success) {
					return { value: result.data };
				}

				return {
					issues: result.error.issues.map((issue) => ({
						path: issue.path === '' ? [] : issue.path.slice(1).split('/'),
						message: issue.message,
					})),
				};
			},
		},
	};
}

export default standardSchema;
