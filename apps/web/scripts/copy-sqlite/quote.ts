/**
 * @description Quotes a SQL identifier, for SQLite and Postgres alike.
 * @param identifier A table or column name.
 * @returns The name in double quotes, with any double quote doubled.
 */
function quote(identifier: string): string {
	return `"${identifier.replaceAll('"', '""')}"`;
}

export default quote;
