import { readFileSync } from 'node:fs';

export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

export type JsonObject = { [key: string]: JsonValue };

/**
 * @description Narrows a JSON value to a plain object, excluding `null` and arrays.
 * @param value The JSON value to test.
 * @returns `true` when the value is a JSON object.
 */
export function isJsonObject(value: JsonValue | undefined): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @description Reads and parses a JSON object file, naming the file in the error so a malformed
 * or non-object manifest is attributable at a glance.
 * @param path The absolute path of the JSON file to read.
 * @returns The parsed object.
 */
export function readJson(path: string): JsonObject {
	let parsed: JsonValue;

	try {
		parsed = JSON.parse(readFileSync(path, 'utf8'));
	} catch (error) {
		throw new Error(`Failed to parse JSON from '${path}'.`, { cause: error });
	}

	if (!isJsonObject(parsed)) {
		throw new Error(`Expected a JSON object in '${path}'.`);
	}

	return parsed;
}
