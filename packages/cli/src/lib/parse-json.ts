import { z } from 'zod';

export type ParsedJson<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * @description Parses JSON another program printed against the shape it answers with.
 * @template T The parsed shape.
 * @param text The JSON text.
 * @param schema The shape to parse it with.
 * @param source Who printed it, for the error, such as `jb-p1lot` or `The device`.
 * @returns The parsed value, or why the text did not match.
 */
export function parseJson<T>(text: string, schema: z.ZodType<T>, source: string): ParsedJson<T> {
	let json: unknown;

	try {
		json = JSON.parse(text);
	} catch {
		return {
			ok: false,
			error: `${source} answered with something other than JSON: ${text.trim()}`,
		};
	}

	const parsed = schema.safeParse(json);

	return parsed.success
		? { ok: true, value: parsed.data }
		: {
				ok: false,
				error: `${source} answered with unexpected JSON:\n${z.prettifyError(parsed.error)}`,
			};
}

export default parseJson;
