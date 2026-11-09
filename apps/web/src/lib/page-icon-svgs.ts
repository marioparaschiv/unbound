import type { AddonPageIconName } from '@unbound-app/contracts/addon-page-icons';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

import { ADDON_PAGE_ICONS } from '~/lib/page-icons';

// Every `:name:` candidate, overlapping ones included: a superset only adds unused icons.
const SHORTCODE = /:(?=([a-z0-9]+(?:-[a-z0-9]+)*):)/g;
const SVG_OPEN = /^<svg[^>]*viewBox="([^"]*)"[^>]*>/;

function isPageIcon(name: string): name is AddonPageIconName {
	return Object.hasOwn(ADDON_PAGE_ICONS, name);
}

function renderIcon(name: AddonPageIconName): string {
	const svg = renderToStaticMarkup(createElement(ADDON_PAGE_ICONS[name]));
	const open = SVG_OPEN.exec(svg);
	const body = svg
		.slice(open?.[0].length ?? 0, svg.lastIndexOf('</svg>'))
		.replaceAll(' data-color="color-2"', '');

	return `<svg viewBox="${open?.[1] ?? '0 0 20 20'}">${body}</svg>`;
}

/**
 * @description Lists the page icons a Markdown body names as `:name:`, in order of first use.
 * @param body ADDON.md after its frontmatter.
 * @returns Each known icon name once.
 */
export function listPageIcons(body: string): AddonPageIconName[] {
	const names = new Set<AddonPageIconName>();

	for (const [, name = ''] of body.matchAll(SHORTCODE)) {
		if (isPageIcon(name)) {
			names.add(name);
		}
	}

	return [...names];
}

/**
 * @description Renders the icons a Markdown body uses, so the app draws only those instead of shipping
 * every icon.
 * @param body ADDON.md after its frontmatter.
 * @returns Each icon's standalone `<svg>` markup in `currentColor`, by name.
 */
export function renderPageIcons(body: string): Record<string, string> {
	return Object.fromEntries(listPageIcons(body).map((name) => [name, renderIcon(name)]));
}

export default { listPageIcons, renderPageIcons };
