import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';

import type { MarkdownPin } from '~/lib/markdown-url';
import Markdown from '~/components/markdown';

const SHA = '3f9c2e1aa0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5';
const PIN: MarkdownPin = { repository: 'acme/addons', commitSha: SHA, path: 'plugins/hello' };

function render(source: string): string {
	return renderToStaticMarkup(createElement(Markdown, { source, pin: PIN }));
}

function hrefs(html: string): string[] {
	return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1] ?? '');
}

const HOSTILE = [
	'<script>alert(1)</script>',
	'<img src=x onerror="alert(1)">',
	'<iframe src="https://evil.example"></iframe>',
	'<a href="javascript:alert(1)">raw</a>',
	'<div style="position:fixed" onclick="alert(1)">x</div>',
	'[click](javascript:alert(1))',
	'[data](data:text/html,<script>alert(1)</script>)',
	'[proto](//evil.example/x)',
	'![tracker](https://evil.example/pixel.png)',
	'![local](./shot.png "title")',
	'![inline](javascript:alert(1))',
	'[ref][r]',
	'',
	'[r]: javascript:alert(1)',
].join('\n\n');

describe('Markdown', () => {
	test('renders no raw HTML, script, handler or image', () => {
		const html = render(HOSTILE);

		expect(html).not.toMatch(/<script|<iframe|<img|<div style|\son[a-z]+=/i);
		expect(html).not.toContain('javascript:');
		expect(html).not.toContain('data:');
		expect(html).not.toContain('//evil.example/x');
	});

	test('shows images as links labelled with their alt text', () => {
		const html = render(HOSTILE);

		expect(html).toContain('tracker</a>');
		expect(html).toContain('local</a>');
		expect(hrefs(html)).toEqual([
			'https://evil.example/pixel.png',
			`https://github.com/acme/addons/blob/${SHA}/plugins/hello/shot.png`,
		]);
	});

	test('resolves relative links to the pinned commit and opens them in a new tab', () => {
		const html = render('[Docs](./docs/usage.md) and [up](../../README.md#setup)');

		expect(hrefs(html)).toEqual([
			`https://github.com/acme/addons/blob/${SHA}/plugins/hello/docs/usage.md`,
			`https://github.com/acme/addons/blob/${SHA}/README.md#setup`,
		]);
		expect(html.match(/target="_blank"/g)).toHaveLength(2);
		expect(html.match(/rel="[^"]*\bnoopener\b/g)).toHaveLength(2);
	});

	test('keeps fragment links in the page', () => {
		const html = render('[Install](#install)');

		expect(html).toContain('href="#install"');
		expect(html).not.toContain('target=');
	});

	test('never renders an h1', () => {
		const html = render('# Title\n\n## Section\n\n### Sub');

		expect(html).not.toContain('<h1');
		expect(html).toMatch(/<h2[^>]*>Title<\/h2>/);
		expect(html).toMatch(/<h3[^>]*>Section<\/h3>/);
	});

	test('decodes character references in text but not in code', () => {
		const html = render('Tom &amp; Jerry &copy; 2026 &#8594; `&amp;`');

		expect(html).toContain('Tom &amp; Jerry © 2026 → ');
		expect(html).toMatch(/<code[^>]*>&amp;amp;<\/code>/);
	});

	test('renders GitHub-flavoured tables, task lists, strikethrough and code', () => {
		const html = render(
			[
				'| Option | Default |',
				'| --- | --- |',
				'| `color` | `red` |',
				'',
				'- [x] done',
				'- [ ] todo',
				'',
				'~~old~~',
				'',
				'```js',
				'const a = 1;',
				'```',
			].join('\n'),
		);

		expect(html).toMatch(
			/<table[^>]*>.*<th[^>]*>Option<\/th>.*<td[^>]*><code[^>]*>color<\/code><\/td>/s,
		);
		expect(html.match(/<input[^>]*type="checkbox"/g)).toHaveLength(2);
		expect(html).toMatch(/<del[^>]*>old<\/del>/);
		expect(html).toMatch(/<pre[^>]*><code[^>]*>const a = 1;/);
	});
});
