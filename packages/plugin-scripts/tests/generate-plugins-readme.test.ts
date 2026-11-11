import { describe, expect, test } from 'bun:test';

import type { PluginManifestEntry } from '~/plugin-manifests';

import { readmeIconFile, readmeIconSvg, renderReadme } from '~/generate-plugins-readme';

function entry(id: string, name: string, description: string): PluginManifestEntry {
	return {
		folder: id.split('.')[1],
		manifest: {
			id,
			name,
			description,
			version: '1.0.0',
			main: 'index.js',
			icon: 'StarIcon',
			authors: [],
		},
	};
}

const icon =
	'<img src="../../assets/plugins/readme-icons/star-icon.svg" width="20" height="20" align="absmiddle" alt="">';

describe('renderReadme', () => {
	test('links each plugin to its store page with its icon, sorted by name', () => {
		const readme = renderReadme([
			entry('unbound.zeta', 'Zeta', 'Last.'),
			entry('adrian.alpha', 'Alpha', 'First.'),
		]);

		expect(readme).toContain('2 first-party plugins');
		expect(readme.indexOf('[Alpha]')).toBeLessThan(readme.indexOf('[Zeta]'));
		expect(readme).toContain(
			`- ${icon} [Alpha](https://unbound.rip/addons/adrian.alpha): First.\n`,
		);
	});

	test('keeps each plugin on one line', () => {
		const readme = renderReadme([entry('unbound.a', 'A', 'one\n  two')]);

		expect(readme).toContain(`- ${icon} [A](https://unbound.rip/addons/unbound.a): one two\n`);
	});
});

describe('readmeIconFile', () => {
	test('names the SVG in kebab-case', () => {
		expect(readmeIconFile('GlobeEarthIcon')).toBe('globe-earth-icon.svg');
		expect(readmeIconFile('BellZIcon')).toBe('bell-z-icon.svg');
		expect(readmeIconFile('ic_swipe_reply_24px')).toBe('ic-swipe-reply-24px.svg');
	});
});

describe('readmeIconSvg', () => {
	test('embeds the PNG behind a grey recolour filter', () => {
		const svg = readmeIconSvg('AAAA');

		expect(svg).toContain('href="data:image/png;base64,AAAA"');
		expect(svg).toContain('filter="url(#grey)"');
	});
});
