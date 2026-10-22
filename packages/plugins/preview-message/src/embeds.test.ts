import { expect, test } from 'bun:test';

import { extractUrls, normalizeDiscordEmbed, parseOpenGraph } from '@preview-message/embeds';

test('extracts unique links and removes sentence punctuation', () => {
	expect(extractUrls('See https://example.com/a, then https://example.com/a.')).toEqual([
		'https://example.com/a',
	]);
	expect(
		extractUrls('Suppress <https://example.com/private> but show https://example.com/public'),
	).toEqual(['https://example.com/public']);
});

test('parses Open Graph metadata into a Discord link embed', () => {
	const html = `
		<html><head>
			<meta property="og:title" content="Example title">
			<meta property="og:description" content="A &amp; B">
			<meta property="og:site_name" content="Example">
			<meta property="og:image" content="/preview.png">
			<meta property="og:image:width" content="1200">
			<meta property="og:image:height" content="630">
		</head></html>
	`;

	expect(parseOpenGraph(html, 'https://example.com/article')).toEqual({
		type: 'article',
		url: 'https://example.com/article',
		title: 'Example title',
		description: 'A & B',
		provider: { name: 'Example', url: 'https://example.com/article' },
		image: { url: 'https://example.com/preview.png', width: 1200, height: 630 },
	});
});

test('falls back to the document title and Twitter metadata', () => {
	const html = `
		<head><title>Fallback title</title>
		<meta name="twitter:description" content="Description">
		<meta name="twitter:image" content="https://cdn.example.com/image.jpg">
		</head>
	`;

	expect(parseOpenGraph(html, 'https://example.com')).toMatchObject({
		type: 'article',
		url: 'https://example.com',
		title: 'Fallback title',
		description: 'Description',
		image: { url: 'https://cdn.example.com/image.jpg' },
	});
});

test('returns no embed when a page has no preview metadata', () => {
	expect(
		parseOpenGraph('<html><body>Nothing here</body></html>', 'https://example.com'),
	).toBeNull();
});

test('normalizes Discord resolver results and preserves the source URL', () => {
	expect(
		normalizeDiscordEmbed(
			{
				type: 'article',
				title: 'Resolved',
				image: { url: 'https://cdn.example.com/image.png' },
			},
			'https://example.com',
		),
	).toEqual({
		type: 'article',
		title: 'Resolved',
		image: { url: 'https://cdn.example.com/image.png' },
		url: 'https://example.com',
	});
	expect(
		normalizeDiscordEmbed({ footer: { text: 'not enough' } }, 'https://example.com'),
	).toBeNull();
});

test('drops invalid embed timestamps before rendering', () => {
	const embed = normalizeDiscordEmbed(
		{ type: 'article', title: 'Resolved', timestamp: 'not-a-date' },
		'https://example.com',
	);

	expect(embed).not.toBeNull();
	expect(embed).not.toHaveProperty('timestamp');
	expect(
		normalizeDiscordEmbed(
			{ type: 'article', title: 'Resolved', timestamp: '2026-08-02T12:00:00.000Z' },
			'https://example.com',
		),
	).not.toHaveProperty('timestamp');
});

test('drops optional resolver metadata that native rows cannot safely render', () => {
	expect(
		normalizeDiscordEmbed(
			{
				type: 'article',
				title: 'Resolved',
				provider: { name: 'Example' },
				author: { name: 'Author' },
				footer: { text: 'Footer', timestamp: 'not-a-date' },
				fields: [{ name: 'Field', value: 'Value' }],
			},
			'https://example.com',
		),
	).toEqual({
		type: 'article',
		title: 'Resolved',
		url: 'https://example.com',
	});
});
