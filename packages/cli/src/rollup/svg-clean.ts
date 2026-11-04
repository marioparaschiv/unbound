import {
	parseXml,
	serializeXml,
	type XmlAttribute,
	type XmlElement,
	type XmlNode,
} from './svg-xml.ts';

/** Paints a node draws with, by kind. */
type Paints = {
	fill: string;
	stroke: string;
};

const EDITOR_PREFIXES = ['sodipodi:', 'inkscape:'];
const EDITOR_NAMESPACES = new Set(['xmlns:sodipodi', 'xmlns:inkscape']);
const TEXT_CONTENT = new Set(['text', 'tspan', 'textPath']);
const SHAPES = new Set([
	'path',
	'rect',
	'circle',
	'ellipse',
	'line',
	'polyline',
	'polygon',
	'text',
	'tspan',
	'textPath',
]);
// Their colours are not plain fills and strokes, or depend on where they are used.
const UNANALYSED = new Set(['style', 'use', 'mask', 'pattern', 'filter', 'image', 'foreignObject']);
const NOT_DRAWN = new Set(['defs', 'clipPath', 'symbol', 'marker']);
const OTHER_COLOURS = ['stop-color', 'flood-color', 'lighting-color', 'class'];
const NO_PAINT = new Set(['none', 'transparent', 'inherit']);

function isEditorName(name: string): boolean {
	return EDITOR_PREFIXES.some((prefix) => name.startsWith(prefix)) || EDITOR_NAMESPACES.has(name);
}

function clean(element: XmlElement): XmlElement {
	const keepSpace = TEXT_CONTENT.has(element.name);
	const children: XmlNode[] = [];

	for (const child of element.children) {
		if (child.kind === 'text' && !keepSpace && child.raw.trim() === '') {
			continue;
		}

		if (child.kind === 'element') {
			if (child.name === 'metadata' || isEditorName(child.name)) {
				continue;
			}

			children.push(clean(child));
		} else {
			children.push(child);
		}
	}

	return {
		...element,
		attributes: element.attributes.filter((attribute) => !isEditorName(attribute.name)),
		children,
	};
}

function attribute(element: XmlElement, name: string): XmlAttribute | undefined {
	return element.attributes.find((candidate) => candidate.name === name);
}

type Declaration = { property: string; value: string };

// A `style` attribute is CSS declarations, `property: value` separated by `;`.
function declarations(style: string): Declaration[] {
	return style
		.split(';')
		.map((part) => {
			const colon = part.indexOf(':');

			return colon === -1
				? { property: part.trim(), value: '' }
				: { property: part.slice(0, colon).trim(), value: part.slice(colon + 1).trim() };
		})
		.filter((declaration) => declaration.property);
}

function normalize(paint: string): string {
	const value = paint.trim().toLowerCase();

	if (value.length === 4 && value.startsWith('#')) {
		// `#rgb` is ASCII hex digits, so splitting by UTF-16 unit is exact.
		return `#${value
			.slice(1)
			.split('')
			.map((digit) => digit + digit)
			.join('')}`;
	}

	return value;
}

function ownPaint(element: XmlElement, kind: keyof Paints): string | undefined {
	const style = attribute(element, 'style');
	const declared = style
		? declarations(style.value).find((declaration) => declaration.property === kind)
		: undefined;

	return declared?.value ?? attribute(element, kind)?.value;
}

type Usage = { colours: Set<string>; defaultFill: boolean; analysable: boolean };

function collect(element: XmlElement, inherited: Paints, usage: Usage) {
	if (UNANALYSED.has(element.name) || OTHER_COLOURS.some((name) => attribute(element, name))) {
		usage.analysable = false;

		return;
	}

	if (NOT_DRAWN.has(element.name)) return;

	const fill = ownPaint(element, 'fill');
	const stroke = ownPaint(element, 'stroke');
	const paints = {
		fill: fill === undefined ? inherited.fill : normalize(fill),
		stroke: stroke === undefined ? inherited.stroke : normalize(stroke),
	};

	if (SHAPES.has(element.name)) {
		for (const paint of [paints.fill, paints.stroke]) {
			if (!NO_PAINT.has(paint)) {
				usage.colours.add(paint);
			}
		}

		if (fill === undefined && inherited.fill === 'default') {
			usage.defaultFill = true;
		}
	}

	for (const child of element.children) {
		if (child.kind === 'element') {
			collect(child, paints, usage);
		}
	}
}

/**
 * @description Finds the one solid colour an SVG draws with, counting the default black fill.
 * @param root The cleaned root element.
 * @returns The colour, and whether a shape draws with the default fill; `undefined` when there is not exactly one.
 */
function singleColour(root: XmlElement): { colour: string; defaultFill: boolean } | undefined {
	const usage: Usage = { colours: new Set(), defaultFill: false, analysable: true };

	collect(root, { fill: 'default', stroke: 'none' }, usage);

	const colours = [...usage.colours].map((colour) => (colour === 'default' ? '#000000' : colour));
	const distinct = new Set(colours.map((colour) => (colour === 'black' ? '#000000' : colour)));
	const [colour] = [...distinct];

	if (!usage.analysable || distinct.size !== 1 || !colour) return;

	if (colour.startsWith('url(') || colour === 'currentcolor' || colour.startsWith('var(')) return;

	return { colour, defaultFill: usage.defaultFill };
}

function sameColour(value: string, colour: string): boolean {
	const normalized = normalize(value);

	return (normalized === 'black' ? '#000000' : normalized) === colour;
}

function recolour(element: XmlElement, colour: string): XmlElement {
	const attributes = element.attributes.map((current) => {
		if (
			(current.name === 'fill' || current.name === 'stroke') &&
			sameColour(current.value, colour)
		) {
			return { name: current.name, value: 'currentColor' };
		}

		if (current.name !== 'style') {
			return current;
		}

		const rewritten = declarations(current.value).map(({ property, value }) =>
			(property === 'fill' || property === 'stroke') && sameColour(value, colour)
				? `${property}:currentColor`
				: `${property}:${value}`,
		);

		return { name: 'style', value: rewritten.join(';') };
	});

	return {
		...element,
		attributes,
		children: element.children.map((child) =>
			child.kind === 'element' ? recolour(child, colour) : child,
		),
	};
}

function setAttribute(element: XmlElement, name: string, value: string): void {
	const existing = attribute(element, name);

	if (existing) {
		existing.value = value;
	} else {
		element.attributes.push({ name, value });
	}
}

/**
 * @description Cleans an SVG for `SvgXml`: drops comments, the doctype, editor metadata (`<metadata>`, `sodipodi:*`,
 * `inkscape:*`) and whitespace between tags. An SVG drawn in one solid colour has it replaced by `currentColor`, with the
 * colour kept as the root's `color`, so it looks the same until a `color` prop tints it.
 * @param source The SVG file's text.
 * @returns The cleaned markup; throws naming why the file is not a well-formed SVG.
 */
export function cleanSvg(source: string): string {
	const parsed = parseXml(source);

	if (parsed.name !== 'svg') {
		throw new Error(`its root element is <${parsed.name}>, not <svg>`);
	}

	let root = clean(parsed);
	const single = singleColour(root);

	if (single) {
		root = recolour(root, single.colour);

		if (single.defaultFill) {
			setAttribute(root, 'fill', 'currentColor');
		}

		if (!attribute(root, 'color')) {
			setAttribute(root, 'color', single.colour);
		}
	}

	return serializeXml(root);
}

export default { cleanSvg };
