/** A property list value as JSON: `date` and `data` stay strings, `integer` and `real` become numbers. */
export type PlistValue = string | number | boolean | PlistValue[] | { [key: string]: PlistValue };

type Token = { closing: boolean; tag: string; empty: boolean; text: string };

type Cursor = { index: number };

// `<plist version="1.0">` carries an attribute, so it never matches; its closing tag is skipped as the root ends.
const TAG = /<(\/?)(\w+)\s*(\/?)>([^<]*)/g;

const ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
};

function decodeEntities(text: string): string {
	return text.replace(
		/&(amp|lt|gt|quot|apos);/g,
		(entity, name: string) => ENTITIES[name] ?? entity,
	);
}

function next(tokens: Token[], cursor: Cursor): Token {
	const token = tokens[cursor.index++];

	if (!token) {
		throw new Error('The plist ends early.');
	}

	return token;
}

function readChildren(tokens: Token[], cursor: Cursor, tag: string, read: () => void) {
	while (
		tokens[cursor.index] &&
		!(tokens[cursor.index]?.closing && tokens[cursor.index]?.tag === tag)
	) {
		read();
	}

	next(tokens, cursor);
}

function readValue(tokens: Token[], cursor: Cursor): PlistValue {
	const token = next(tokens, cursor);

	if (token.closing) {
		throw new Error(`Unexpected </${token.tag}> in the plist.`);
	}

	switch (token.tag) {
		case 'true':
			return true;
		case 'false':
			return false;
		case 'dict': {
			const dict: Record<string, PlistValue> = {};

			if (!token.empty) {
				readChildren(tokens, cursor, 'dict', () => {
					const key = next(tokens, cursor);

					next(tokens, cursor);
					dict[key.text] = readValue(tokens, cursor);
				});
			}

			return dict;
		}
		case 'array': {
			const array: PlistValue[] = [];

			if (!token.empty) {
				readChildren(tokens, cursor, 'array', () => array.push(readValue(tokens, cursor)));
			}

			return array;
		}
		default: {
			if (!token.empty) {
				next(tokens, cursor);
			}

			return token.tag === 'integer' || token.tag === 'real'
				? Number(token.text)
				: token.text;
		}
	}
}

/**
 * @description Reads an XML property list, such as an app's entitlements, as JSON.
 * @param xml The plist's text.
 * @returns The root value, or `undefined` when the text is not a well-formed plist.
 */
export function parsePlist(xml: string): PlistValue | undefined {
	const tokens = [...xml.matchAll(TAG)].map(([, closing, tag, empty, text]) => ({
		closing: closing === '/',
		tag: tag ?? '',
		empty: empty === '/',
		text: decodeEntities(text ?? ''),
	}));

	try {
		return tokens.length ? readValue(tokens, { index: 0 }) : undefined;
	} catch {
		// Malformed: the caller treats the plist as missing.
		return undefined;
	}
}

export default parsePlist;
