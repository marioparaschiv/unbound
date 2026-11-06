/** A decoded JSON value. */
export type Json = string | number | boolean | null | Json[] | JsonObject;

/** A decoded JSON object. */
export type JsonObject = { [key: string]: Json };

function isJson(value: unknown): value is Json {
	if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
		return true;
	}

	if (Array.isArray(value)) {
		return value.every(isJson);
	}

	return typeof value === 'object' && Object.values(value).every(isJson);
}

/**
 * @description Decodes JSON text from the hub or the device, which callers then read with the helpers below.
 * @param text The JSON text.
 * @param what What the text is, for the error.
 * @returns The decoded value.
 */
export function parseJson(text: string, what: string): Json {
	const value: unknown = JSON.parse(text);

	if (!isJson(value)) {
		throw new Error(`Failed to decode ${what}: not JSON`);
	}

	return value;
}

/**
 * @description Narrows a value to an object.
 * @param value Any decoded value.
 * @returns Whether it is a plain object.
 */
export function isObject(value: Json | undefined): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @description Reads an object field, or an empty object when it is missing or not an object.
 * @param value The object to read.
 * @param key The field.
 * @returns The field's object.
 */
export function objectAt(value: Json | undefined, key: string): JsonObject {
	const field = isObject(value) ? value[key] : undefined;

	return isObject(field) ? field : {};
}

/**
 * @description Reads a string field.
 * @param value The object to read.
 * @param key The field.
 * @returns The string, or `undefined` when it is missing or not a string.
 */
export function stringAt(value: Json | undefined, key: string): string | undefined {
	const field = isObject(value) ? value[key] : undefined;

	return typeof field === 'string' ? field : undefined;
}

/**
 * @description Reads a number field.
 * @param value The object to read.
 * @param key The field.
 * @returns The number, or `undefined` when it is missing or not a number.
 */
export function numberAt(value: Json | undefined, key: string): number | undefined {
	const field = isObject(value) ? value[key] : undefined;

	return typeof field === 'number' ? field : undefined;
}

/**
 * @description Reads an array field.
 * @param value The object to read.
 * @param key The field.
 * @returns The array, or an empty one when it is missing or not an array.
 */
export function listAt(value: Json | undefined, key: string): Json[] {
	const field = isObject(value) ? value[key] : undefined;

	return Array.isArray(field) ? field : [];
}
