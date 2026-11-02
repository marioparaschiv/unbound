/** One failed check, at a `/`-separated path into the value (empty at the root). */
export type SchemaIssue = { path: string; message: string };

/** Thrown by `parse`; `message` lists every issue on its own line. */
export class SchemaError extends Error {
	readonly issues: SchemaIssue[];

	constructor(issues: SchemaIssue[]) {
		super(
			issues
				.map(({ path, message }) => (path ? `${message} (at ${path})` : message))
				.join('\n'),
		);
		this.name = 'SchemaError';
		this.issues = issues;
	}
}

export default { SchemaError };
