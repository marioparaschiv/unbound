import { describe, expect, test } from 'bun:test';

import {
	findRenderedLinkRange,
	linkedTargets,
	nativeUsernameColor,
} from '@message-link-embeds/link-targets';

describe('linked message targets', () => {
	test('extracts Discord message links from nested rich content', () => {
		expect(
			linkedTargets({
				content: [
					{
						text: 'First https://discord.com/channels/1019387038820216882/1534546622371987657/1551930605325910056',
					},
					{
						content:
							' and https://discord.com/channels/@me/1534546622371987658/1551930605325910057',
					},
				],
			}),
		).toEqual([
			{ channelId: '1534546622371987657', messageId: '1551930605325910056' },
			{ channelId: '1534546622371987658', messageId: '1551930605325910057' },
		]);
	});

	test('deduplicates repeated links and ignores non-Discord URLs', () => {
		expect(
			linkedTargets({
				content:
					'https://discord.com/channels/1019387038820216882/1534546622371987657/1551930605325910056 ' +
					'https://discord.com/channels/1019387038820216882/1534546622371987657/1551930605325910056 ' +
					'https://example.com/channels/1019387038820216882/1534546622371987657/1551930605325910056',
			}),
		).toEqual([{ channelId: '1534546622371987657', messageId: '1551930605325910056' }]);
	});

	test('returns no targets for content without message links', () => {
		expect(linkedTargets({ content: 'not a message link' })).toEqual([]);
	});
});

describe('rendered message link ranges', () => {
	test('includes directional markers and native attachments around the channel label', () => {
		const text = 'body\n\n\u2068\u2068\uFFFCdevelopment\u2069\uFFFC\u2068\uFFFC\u2069\u2069';
		const range = findRenderedLinkRange(text, 'development');

		expect(range).toEqual({
			location: text.indexOf('\u2068\u2068'),
			length: text.length - text.indexOf('\u2068\u2068'),
		});
	});

	test('ignores plain text that shares a channel name', () => {
		expect(findRenderedLinkRange('development and more', 'development')).toBeUndefined();
	});
});

describe('native username color', () => {
	test('converts a Discord role color to an opaque React Native color', () => {
		expect(nativeUsernameColor('#277ecd')).toBe(0xff277ecd);
	});

	test('rejects colors that are not six-digit hexadecimal strings', () => {
		expect(nativeUsernameColor('#27e')).toBeUndefined();
		expect(nativeUsernameColor(undefined)).toBeUndefined();
	});
});
