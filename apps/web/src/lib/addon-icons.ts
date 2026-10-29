import { renderToStaticMarkup } from 'react-dom/server';
import * as nucleo from 'nucleo-micro-bold';
import { createElement } from 'react';

// The package also exports `Icon`, the bare frame every icon renders into.
const ICONS = new Map(Object.entries(nucleo).filter(([name]) => /^Icon[A-Z]/.test(name)));

const markup = new Map<string, string>();

/** Every icon a maintainer can pick, in name order. */
export const ADDON_ICON_NAMES = [...ICONS.keys()].sort();

/**
 * @description Checks a name against the icons a maintainer can pick.
 * @param name The Nucleo Micro Bold export name.
 * @returns Whether the icon exists.
 */
export function isAddonIcon(name: string): boolean {
	return ICONS.has(name);
}

/**
 * @description Renders an icon to SVG markup, sized by its container, once per name.
 * @param name The Nucleo Micro Bold export name, or `null` for none.
 * @returns The `<svg>` markup, or `null` when the name is `null` or unknown.
 */
export function renderAddonIcon(name: string | null | undefined): string | null {
	const Icon = name ? ICONS.get(name) : undefined;

	if (!name || !Icon) return null;

	let svg = markup.get(name);

	if (svg === undefined) {
		svg = renderToStaticMarkup(createElement(Icon, { size: '100%', 'aria-hidden': true }));
		markup.set(name, svg);
	}

	return svg;
}

/** Icons per atlas row. */
export const ATLAS_COLUMNS = 43;

/** Each icon's cell in the atlas, in icon units: its 20-unit box plus a 1-unit gutter on every side. */
export const ATLAS_PITCH = 22;

/**
 * @description Lays every icon out on one grid, in name order, to use as a CSS mask: a cell is then a
 * plain element showing part of one image, not an SVG tree of its own.
 * @returns The atlas's markup.
 */
export function buildAddonIconAtlas(): string {
	const rows = Math.ceil(ADDON_ICON_NAMES.length / ATLAS_COLUMNS);
	const width = ATLAS_COLUMNS * ATLAS_PITCH;
	const height = rows * ATLAS_PITCH;
	const cells = ADDON_ICON_NAMES.map((name, index) => {
		const Icon = ICONS.get(name);
		const svg = Icon ? renderToStaticMarkup(createElement(Icon)) : '';
		const body = svg
			.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'))
			.replaceAll(' data-color="color-2"', '');
		const x = (index % ATLAS_COLUMNS) * ATLAS_PITCH + 1;
		const y = Math.floor(index / ATLAS_COLUMNS) * ATLAS_PITCH + 1;

		return `<svg x="${x}" y="${y}" width="20" height="20" viewBox="0 0 20 20">${body}</svg>`;
	});

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${cells.join('')}</svg>`;
}

export default {
	ADDON_ICON_NAMES,
	ATLAS_COLUMNS,
	ATLAS_PITCH,
	isAddonIcon,
	renderAddonIcon,
	buildAddonIconAtlas,
};
