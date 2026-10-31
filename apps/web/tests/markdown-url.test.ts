import { describe, expect, test } from 'bun:test';

import {
	getPinnedMediaBase,
	getPublishedMediaBase,
	resolveMarkdownUrl,
	resolveMediaUrl,
} from '~/lib/markdown-url';
import type { MarkdownPin, MarkdownUrl, MarkdownUrlKind } from '~/lib/markdown-url';

type Case = [url: string, expected: MarkdownUrl | undefined];

const SHA = '3f9c2e1aa0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5';
const BLOB = `https://github.com/acme/addons/blob/${SHA}`;

const PIN: MarkdownPin = { repository: 'acme/addons', commitSha: SHA, path: 'plugins/hello' };
const ROOT_PIN: MarkdownPin = { ...PIN, path: '' };

function external(href: string): MarkdownUrl {
	return { href, external: true };
}

function check(cases: Case[], kind: MarkdownUrlKind, pin: MarkdownPin = PIN) {
	for (const [url, expected] of cases) {
		expect([url, resolveMarkdownUrl(url, pin, kind)]).toEqual([url, expected]);
	}
}

describe('resolveMarkdownUrl', () => {
	test('keeps web, mail and fragment links', () => {
		check(
			[
				['https://example.com/a?b=1#c', external('https://example.com/a?b=1#c')],
				['http://example.com', external('http://example.com/')],
				['HTTPS://Example.com/X', external('https://example.com/X')],
				['  https://example.com  ', external('https://example.com/')],
				['mailto:dev@example.com', external('mailto:dev@example.com')],
				['#install', { href: '#install', external: false }],
			],
			'link',
		);
	});

	test('drops every other scheme and protocol-relative URLs', () => {
		check(
			[
				['javascript:alert(1)', undefined],
				['JaVaScRiPt:alert(1)', undefined],
				[' javascript:alert(1)', undefined],
				['java\tscript:alert(1)', undefined],
				['java\nscript:alert(1)', undefined],
				['data:text/html,<script>alert(1)</script>', undefined],
				['vbscript:msgbox(1)', undefined],
				['file:///etc/passwd', undefined],
				['ftp://example.com/x', undefined],
				['//evil.example/x', undefined],
				['/\\evil.example/x', undefined],
				['\\\\evil.example/x', undefined],
				['https://', undefined],
				['', undefined],
				['   ', undefined],
			],
			'link',
		);
	});

	test('resolves relative URLs to the file at the pinned commit', () => {
		check(
			[
				['docs/usage.md', external(`${BLOB}/plugins/hello/docs/usage.md`)],
				['./docs/usage.md', external(`${BLOB}/plugins/hello/docs/usage.md`)],
				['../shared/LICENSE', external(`${BLOB}/plugins/shared/LICENSE`)],
				['docs/../README.md#setup', external(`${BLOB}/plugins/hello/README.md#setup`)],
				['/README.md', external(`${BLOB}/README.md`)],
				['notes.md?plain=1', external(`${BLOB}/plugins/hello/notes.md?plain=1`)],
				['my file.md', external(`${BLOB}/plugins/hello/my%20file.md`)],
			],
			'link',
		);
	});

	test('never resolves above the repository root', () => {
		check(
			[
				['../../../../etc/passwd', external(`${BLOB}/etc/passwd`)],
				['../../..', external(`${BLOB}/`)],
				['/../../x', external(`${BLOB}/x`)],
			],
			'link',
		);
		check(
			[
				['./LICENSE', external(`${BLOB}/LICENSE`)],
				['../LICENSE', external(`${BLOB}/LICENSE`)],
			],
			'link',
			ROOT_PIN,
		);
	});

	test('resolves images like links, except fragments and mail addresses', () => {
		check(
			[
				['./screenshot.png', external(`${BLOB}/plugins/hello/screenshot.png`)],
				['https://example.com/a.png', external('https://example.com/a.png')],
				['#logo', undefined],
				['mailto:dev@example.com', undefined],
				['data:image/png;base64,AAAA', undefined],
				['javascript:alert(1)', undefined],
			],
			'image',
		);
	});

	test('is stable when applied to its own output', () => {
		for (const url of ['./docs/usage.md', 'https://example.com/a', '#install']) {
			const once = resolveMarkdownUrl(url, PIN, 'link');

			expect(once).toBeDefined();
			expect(resolveMarkdownUrl(once?.href ?? '', PIN, 'link')).toEqual(once);
		}
	});
});

describe('resolveMediaUrl', () => {
	const RAW = `https://raw.githubusercontent.com/acme/addons/${SHA}`;

	test('loads media from the addon directory at the pinned commit before publish', () => {
		expect(getPinnedMediaBase(PIN)).toBe(`${RAW}/plugins/hello/`);
		expect(getPinnedMediaBase(ROOT_PIN)).toBe(`${RAW}/`);
		expect(resolveMediaUrl('media/a/shot.png', getPinnedMediaBase(PIN))).toBe(
			`${RAW}/plugins/hello/media/a/shot.png`,
		);
	});

	test('loads media from the CDN version folder after publish', () => {
		const base = getPublishedMediaBase(
			'https://cdn.example/addons/acme.hello/1.2.0/manifest.json',
		);

		expect(base).toBe('https://cdn.example/addons/acme.hello/1.2.0/');
		expect(resolveMediaUrl('media/clip.mp4', base)).toBe(
			'https://cdn.example/addons/acme.hello/1.2.0/media/clip.mp4',
		);
	});

	test('resolves only files inside media/', () => {
		const base = getPinnedMediaBase(PIN);

		for (const path of [
			'./media/shot.png',
			'media/../shot.png',
			'../media/shot.png',
			'/media/shot.png',
			'shot.png',
			'media/shot.svg',
			'media/.hidden.png',
			'https://evil.example/media/shot.png',
			'//evil.example/media/shot.png',
		]) {
			expect([path, resolveMediaUrl(path, base)]).toEqual([path, undefined]);
		}
	});
});
