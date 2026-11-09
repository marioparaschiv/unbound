import { describe, expect, test } from 'bun:test';

import { listPageIcons, renderPageIcons } from '~/lib/page-icon-svgs';
import { buildStorePageFile } from '~/lib/store-page-file';

describe('page icon SVGs', () => {
	test('lists each known icon once, in order of first use', () => {
		expect(
			listPageIcons('## :gear: Settings\n\n- :bell: Pings\n- :gear::bolt: Fast\n'),
		).toEqual(['gear', 'bell', 'bolt']);
	});

	test('skips names outside the set', () => {
		expect(listPageIcons(':smile: 10:30: :toString:')).toEqual([]);
	});

	test('renders each icon as a standalone SVG on its 20-unit box', () => {
		const icons = renderPageIcons(':arrow-down: :eye-slash:');

		expect(Object.keys(icons)).toEqual(['arrow-down', 'eye-slash']);
		expect(icons['arrow-down']).toStartWith(
			'<svg viewBox="0 0 20 20"><line x1="10" y1="3" x2="10" y2="17"',
		);
		expect(icons['eye-slash']).toStartWith('<svg viewBox="0 0 20 20">');
		expect(Object.values(icons).join('')).not.toContain('data-color');
	});
});

describe('store-page.json', () => {
	test('holds the body without frontmatter, the measured page and only the icons it uses', () => {
		const file = JSON.parse(
			buildStorePageFile('---\ntitle: :bell:\n---\n## :gear: Settings', null),
		);

		expect(file).toEqual({
			body: '## :gear: Settings',
			measured: null,
			icons: renderPageIcons(':gear:'),
		});
		expect(Object.keys(file.icons)).toEqual(['gear']);
	});
});
