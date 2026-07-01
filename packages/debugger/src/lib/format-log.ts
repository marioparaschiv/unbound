/**
 * Reformats a log line as Hermes hands it to `nativeLoggingHook`. Hermes inspects each `console.*`
 * argument and joins them with `, ` — quoting string args (`'a', 'b', { x: 1 }`). That reads badly
 * in the debugger terminal, so we split on the top-level commas Hermes inserted, unquote the plain
 * string segments, and rejoin with spaces — leaving inspected objects/arrays untouched.
 *
 * This is best-effort: it only rewrites what parses cleanly as Hermes's join format. A segment it
 * can't confidently classify is left exactly as received, so worst case a line is unchanged, never
 * mangled.
 */

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
		const char = input[i];

		if (inString) {
			// Skip an escaped character (e.g. Hermes escapes an inner quote as \').
			if (char === '\\') {
				i++;
				continue;
			}
			if (char === "'") inString = false;
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
					if (input[i + 1] === ' ') i++;
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
