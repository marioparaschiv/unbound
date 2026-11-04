/** An attribute as written: its name and its value between the quotes, entities left as they are. */
export type XmlAttribute = {
	name: string;
	value: string;
};

/** An element with its attributes in source order. */
export type XmlElement = {
	kind: 'element';
	name: string;
	attributes: XmlAttribute[];
	children: XmlNode[];
};

/** Character data as written, entities left as they are. */
export type XmlText = {
	kind: 'text';
	raw: string;
};

/** A CDATA section's contents. */
export type XmlCData = {
	kind: 'cdata';
	raw: string;
};

/** A node an element can hold. Comments, processing instructions and the doctype are dropped while parsing. */
export type XmlNode = XmlElement | XmlText | XmlCData;

function isSpace(char: string | undefined): boolean {
	return char === ' ' || char === '\t' || char === '\n' || char === '\r';
}

function isNameStart(char: string | undefined): boolean {
	if (char === undefined) {
		return false;
	}

	const code = char.charCodeAt(0);

	return (
		(code >= 65 && code <= 90) ||
		(code >= 97 && code <= 122) ||
		char === '_' ||
		char === ':' ||
		code >= 0xc0
	);
}

function isNameChar(char: string | undefined): boolean {
	if (char === undefined) {
		return false;
	}

	const code = char.charCodeAt(0);

	return (
		isNameStart(char) ||
		(code >= 48 && code <= 57) ||
		char === '-' ||
		char === '.' ||
		code === 0xb7
	);
}

function isDigit(char: string | undefined, hex: boolean): boolean {
	if (char === undefined) {
		return false;
	}

	const code = char.toLowerCase().charCodeAt(0);

	return (code >= 48 && code <= 57) || (hex && code >= 97 && code <= 102);
}

// Entity names and character references are ASCII, so testing UTF-16 units is exact.
function everyChar(text: string, test: (char: string) => boolean): boolean {
	for (let index = 0; index < text.length; index++) {
		if (!test(text.charAt(index))) {
			return false;
		}
	}

	return true;
}

/** A tokenizer over one XML document that builds its element tree, throwing at the first well-formedness error. */
class XmlReader {
	private index = 0;
	private readonly source: string;

	// Not a parameter property: Node loads `rollup.config.mjs` imports with type stripping only.
	constructor(source: string) {
		this.source = source;
	}

	parse(): XmlElement {
		if (this.source.startsWith('\uFEFF')) {
			this.index = 1;
		}

		this.skipMisc(true);

		if (!this.startsWith('<') || !isNameStart(this.source[this.index + 1])) {
			this.fail('expected the root element');
		}

		const root = this.element();

		this.skipMisc(false);

		if (this.index < this.source.length) {
			this.fail('content after the root element');
		}

		return root;
	}

	private startsWith(text: string): boolean {
		return this.source.startsWith(text, this.index);
	}

	private fail(reason: string): never {
		const before = this.source.slice(0, this.index);
		const line = before.split('\n').length;
		const column = this.index - before.lastIndexOf('\n');

		throw new Error(`${reason} at line ${line}, column ${column}`);
	}

	private skipUntil(terminator: string, what: string) {
		const end = this.source.indexOf(terminator, this.index);

		if (end === -1) {
			this.fail(`unterminated ${what}`);
		}

		const skipped = this.source.slice(this.index, end);

		this.index = end + terminator.length;

		return skipped;
	}

	private skipSpace() {
		while (isSpace(this.source[this.index])) this.index++;
	}

	// Whitespace, comments, processing instructions and, before the root only, one doctype.
	private skipMisc(prolog: boolean) {
		let doctype = false;

		for (;;) {
			this.skipSpace();

			if (this.startsWith('<!--')) {
				this.index += 4;
				this.skipUntil('-->', 'comment');
			} else if (this.startsWith('<?')) {
				this.index += 2;
				this.skipUntil('?>', 'processing instruction');
			} else if (prolog && !doctype && this.startsWith('<!DOCTYPE')) {
				this.skipDoctype();
				doctype = true;
			} else {
				return;
			}
		}
	}

	private skipDoctype() {
		let depth = 0;

		this.index += '<!DOCTYPE'.length;

		while (this.index < this.source.length) {
			const char = this.source[this.index];

			if (char === '"' || char === "'") {
				this.index++;
				this.skipUntil(char, 'doctype literal');
				continue;
			}

			this.index++;

			if (char === '[') {
				depth++;
			} else if (char === ']') {
				depth--;
			} else if (char === '>' && depth === 0) return;
		}

		this.fail('unterminated doctype');
	}

	private name(what: string): string {
		const start = this.index;

		if (!isNameStart(this.source[this.index])) {
			this.fail(`expected ${what}`);
		}

		while (isNameChar(this.source[this.index])) this.index++;

		return this.source.slice(start, this.index);
	}

	private checkReferences(raw: string, offset: number) {
		for (let at = raw.indexOf('&'); at !== -1; at = raw.indexOf('&', at + 1)) {
			const end = raw.indexOf(';', at);
			const body = end === -1 ? '' : raw.slice(at + 1, end);
			const numeric = body.startsWith('#');
			const hex = body.startsWith('#x');
			const digits = body.slice(hex ? 2 : 1);
			const valid = numeric
				? digits.length > 0 && everyChar(digits, (char) => isDigit(char, hex))
				: body.length > 0 && isNameStart(body[0]) && everyChar(body, isNameChar);

			if (!valid) {
				this.index = offset + at;
				this.fail('"&" that starts no entity reference');
			}
		}
	}

	private attributes(): XmlAttribute[] {
		const attributes: XmlAttribute[] = [];

		for (;;) {
			const hadSpace = isSpace(this.source[this.index]);

			this.skipSpace();

			if (this.startsWith('/>') || this.startsWith('>')) {
				return attributes;
			}

			if (!hadSpace) {
				this.fail('expected whitespace before an attribute');
			}

			const name = this.name('an attribute name');

			if (attributes.some((attribute) => attribute.name === name)) {
				this.fail(`duplicate attribute ${name}`);
			}

			this.skipSpace();

			if (this.source[this.index] !== '=') {
				this.fail(`expected "=" after ${name}`);
			}

			this.index++;
			this.skipSpace();

			const quote = this.source[this.index];

			if (quote !== '"' && quote !== "'") {
				this.fail(`expected a quoted value for ${name}`);
			}

			this.index++;

			const start = this.index;
			const value = this.skipUntil(quote, `value of ${name}`);

			if (value.includes('<')) {
				this.index = start + value.indexOf('<');
				this.fail(`"<" in the value of ${name}`);
			}

			this.checkReferences(value, start);
			attributes.push({ name, value });
		}
	}

	private element(): XmlElement {
		this.index++;

		const name = this.name('an element name');
		const attributes = this.attributes();
		const element: XmlElement = { kind: 'element', name, attributes, children: [] };

		if (this.startsWith('/>')) {
			this.index += 2;

			return element;
		}

		this.index++;
		this.content(element);

		return element;
	}

	private content(element: XmlElement) {
		for (;;) {
			if (this.index >= this.source.length) {
				this.fail(`<${element.name}> is never closed`);
			}

			if (this.startsWith('</')) {
				this.index += 2;

				const name = this.name('a closing tag name');

				if (name !== element.name) {
					this.fail(`</${name}> closes <${element.name}>`);
				}

				this.skipSpace();

				if (this.source[this.index] !== '>') {
					this.fail(`expected ">" to close </${name}`);
				}

				this.index++;

				return;
			}

			if (this.startsWith('<!--')) {
				this.index += 4;
				this.skipUntil('-->', 'comment');
			} else if (this.startsWith('<![CDATA[')) {
				this.index += '<![CDATA['.length;
				element.children.push({
					kind: 'cdata',
					raw: this.skipUntil(']]>', 'CDATA section'),
				});
			} else if (this.startsWith('<?')) {
				this.index += 2;
				this.skipUntil('?>', 'processing instruction');
			} else if (this.startsWith('<')) {
				element.children.push(this.element());
			} else {
				this.text(element);
			}
		}
	}

	private text(element: XmlElement) {
		const start = this.index;
		const end = this.source.indexOf('<', start);
		const raw = this.source.slice(start, end === -1 ? this.source.length : end);

		this.checkReferences(raw, start);
		this.index = start + raw.length;
		element.children.push({ kind: 'text', raw });
	}
}

/**
 * @description Parses an XML document into its element tree, dropping comments, processing instructions and the doctype.
 * @param source The document.
 * @returns The root element; throws naming the first well-formedness error and its line and column.
 */
export function parseXml(source: string): XmlElement {
	return new XmlReader(source).parse();
}

function attributeText({ name, value }: XmlAttribute): string {
	return `${name}="${value.split('"').join('&quot;')}"`;
}

/**
 * @description Writes an element tree back out as compact XML: double-quoted attributes and self-closed empty elements.
 * @param node The node to write.
 * @returns Its markup.
 */
export function serializeXml(node: XmlNode): string {
	if (node.kind === 'text') {
		return node.raw;
	}

	if (node.kind === 'cdata') {
		return `<![CDATA[${node.raw}]]>`;
	}

	const open = [node.name, ...node.attributes.map(attributeText)].join(' ');

	if (!node.children.length) {
		return `<${open}/>`;
	}

	return `<${open}>${node.children.map(serializeXml).join('')}</${node.name}>`;
}

export default { parseXml, serializeXml };
