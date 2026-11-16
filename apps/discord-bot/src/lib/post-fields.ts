/**
 * @description Writes a full-width field: a bold label, then its value on the same line.
 * @param label The field's name.
 * @param value Its Markdown value.
 * @returns The field's Markdown.
 */
export function field(label: string, value: string): string {
	return `**${label}:** ${value}`;
}

/**
 * @description Writes a field whose value can run long, so it starts on the line under its label.
 * @param label The field's name.
 * @param value Its Markdown value.
 * @returns The field's Markdown.
 */
export function fieldBelow(label: string, value: string): string {
	return `**${label}:**\n${value}`;
}

/**
 * @description Names a user as a mention, which shows their current name, and their id, readable after they leave.
 * @param id The user's id.
 * @returns The Markdown.
 */
export function person(id: string): string {
	return `<@${id}> (${id})`;
}

export default { field, fieldBelow, person };
