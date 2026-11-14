import { describe, expect, test } from 'bun:test';

import { cleanSvg, isSvg } from '~/lib/svg';

const url = 'https://cdn.discordapp.com/attachments/1/2/logo.svg';

describe('isSvg', () => {
	test('recognises SVGs by type or extension within the size limit', () => {
		expect(isSvg({ url, filename: 'logo.SVG', size: 100 })).toBe(true);
		expect(isSvg({ url, filename: 'logo', size: 100, content_type: 'image/svg+xml' })).toBe(
			true,
		);
		expect(isSvg({ url, filename: 'logo.png', size: 100, content_type: 'image/png' })).toBe(
			false,
		);
		expect(isSvg({ url, filename: 'huge.svg', size: 3 * 1024 * 1024 })).toBe(false);
	});
});

describe('cleanSvg', () => {
	test('strips scripts, handlers and embedded HTML', () => {
		const markup =
			'<svg onload="alert(1)" viewBox="0 0 1 1"><script>alert(2)</script><foreignObject><div/></foreignObject><rect onclick=\'x()\' width="1"/></svg>';

		expect(cleanSvg(markup)).toBe('<svg viewBox="0 0 1 1"><rect width="1"/></svg>');
	});

	test('refuses text without an svg element', () => {
		expect(cleanSvg('<html></html>')).toBeUndefined();
	});
});
