import { ADDON_PAGE_ICON_NAMES } from '@unbound-app/contracts/addon-page-icons';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { join } from 'node:path';

import AddonMd from '~/components/addon-md';

import { PAGE_PIN } from './helpers/addon-page';

const PLUGINS = join(import.meta.dir, '../../../packages/plugins');
const SHORTCODE = /:([a-z0-9]+(?:-[a-z0-9]+)*):/g;

function render(source: string): string {
	return renderToStaticMarkup(
		createElement(AddonMd, { source, pin: PAGE_PIN, mediaBase: 'https://cdn.example/' }),
	);
}

function svgCount(html: string): number {
	return html.match(/<svg\b/g)?.length ?? 0;
}

describe('page icons', () => {
	test('draws a known shortcode in headings and list items as an icon', () => {
		const html = render('## :gear: Settings\n\n- :trash: Deleted messages stay.');

		expect(svgCount(html)).toBe(2);
		expect(html).not.toContain(':gear:');
		expect(html).not.toContain(':trash:');
		expect(html).toContain('Settings');
	});

	test('keeps unknown names, code spans and code blocks as text', () => {
		const html = render('Ratio 10:30:45 and :not-an-icon: and `:gear:`\n\n```\n:gear:\n```');

		expect(svgCount(html)).toBe(0);
		expect(html).toContain(':not-an-icon:');
		expect(html.match(/:gear:/g)).toHaveLength(2);
	});

	test('every shortcode a first-party ADDON.md uses is in the set the store draws', async () => {
		const known = new Set<string>(ADDON_PAGE_ICON_NAMES);
		const unknown: string[] = [];

		for (const file of new Bun.Glob('*/ADDON.md').scanSync(PLUGINS)) {
			const prose = (await Bun.file(join(PLUGINS, file)).text()).replace(/`[^`\n]*`/g, '');

			for (const [, name] of prose.matchAll(SHORTCODE)) {
				if (name && !known.has(name)) {
					unknown.push(`${file}: ${name}`);
				}
			}
		}

		expect(unknown).toEqual([]);
	});
});
