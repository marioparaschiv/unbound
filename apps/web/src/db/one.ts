/**
 * @description Reads the row a statement always returns, such as an insert or upsert with `returning()`.
 * @template T The row type.
 * @param rows The statement's result.
 * @returns The first row; throws when there is none, which is a bug, not a lookup miss.
 */
function one<T>(rows: T[]): T {
	const [row] = rows;

	if (row === undefined) {
		throw new Error('Expected the statement to return a row.');
	}

	return row;
}

export default one;
