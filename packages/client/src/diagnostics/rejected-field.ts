const FIELD_PATH = /\(at \/([^/)]+)/;

/**
 * @description Reads which top-level field of a request body the API's validation message names.
 * @param message The error message, such as `must not have more than 8 characters (at /clock/utcOffset)`.
 * @returns The field name, or `undefined` when the message names none.
 */
export function rejectedField(message: string): string | undefined {
	return FIELD_PATH.exec(message)?.[1];
}

/**
 * @description Copies a request body without the field the API rejected, so an older or newer server can still take the rest.
 * @template T The body's type.
 * @param body The body the API rejected.
 * @param message The API's validation message.
 * @param required Fields that must stay; a rejection of one of them is final.
 * @returns The body without the rejected field, or `undefined` when nothing can be dropped.
 */
export function withoutRejectedField<T extends object>(
	body: T,
	message: string,
	required: ReadonlySet<string>,
): T | undefined {
	const field = rejectedField(message);

	if (!field || required.has(field) || !(field in body)) {
		return undefined;
	}

	const rest = { ...body };

	Reflect.deleteProperty(rest, field);

	return rest;
}
