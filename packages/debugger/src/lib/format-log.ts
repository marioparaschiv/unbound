// Hermes joins `console.*` args with `, ` and quotes strings (`'a', 'b', { x: 1 }`). Only what parses
// cleanly as that join is rewritten; anything else is left exactly as received, never mangled.

/**
 * @description Cleans a Hermes-joined console line into space-separated, unquoted output.
 * @param message The raw `nativeLoggingHook` message string.
 * @returns The reformatted line, or the original if it doesn't look like a Hermes join.
 */
export function formatLog(message: string): string {
	const segments = splitTopLevel(message);

	const line = segments ? segments.map(unquoteSegment).join(' ') : message;

	// The client's logger prefixes every line with `»`; the bridge already prints its own `«` marker,
	// so drop that leading arrow to avoid a doubled sigil.
	return line.startsWith('» ') ? line.slice(2) : line;
}

/**
 * Splits on the commas Hermes inserts between arguments — those at nesting depth zero and outside
 * any string literal. Returns null if the delimiters are unbalanced (not a Hermes join we trust).
 */
function splitTopLevel(input: string): string[] | null {
	const segments: string[] = [];

	let depth = 0;
	let inString = false;
	let start = 0;

	for (let i = 0, len = input.length; i < len; i++) {
		const char = input.charAt(i);

		if (inString) {
			// Skip an escaped character (e.g. Hermes escapes an inner quote as \').
			if (char === '\\') {
				i++;
				continue;
			}

			if (char === "'") {
				inString = false;
			}

			continue;
		}

		switch (char) {
			case "'":
				inString = true;
				break;
			case '{':
			case '[':
			case '(':
				depth++;
				break;
			case '}':
			case ']':
			case ')':
				depth--;
				break;
			case ',':
				if (depth === 0) {
					segments.push(input.slice(start, i));

					// Skip the single space Hermes puts after each comma.
					if (input[i + 1] === ' ') {
						i++;
					}

					start = i + 1;
				}

				break;
		}
	}

	// Unbalanced nesting or an unterminated string means this isn't a clean Hermes join; leave it be.
	if (depth !== 0 || inString) return null;

	segments.push(input.slice(start));

	return segments;
}

/** Unwraps a fully single-quoted segment (`'text'`) into `text`; leaves anything else untouched. */
function unquoteSegment(segment: string): string {
	const trimmed = segment.trim();

	if (trimmed.length < 2 || trimmed[0] !== "'" || trimmed[trimmed.length - 1] !== "'") {
		return trimmed;
	}

	return trimmed.slice(1, -1).replace(/\\'/g, "'");
}
