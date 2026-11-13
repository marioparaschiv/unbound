import { describe, expect, test } from 'bun:test';

import { sheetChannelId } from '~/lib/sheet-channel';

const CHANNEL = '709062739581992971';

describe('long-press sheet channel', () => {
	test('reads channel and thread sheets', () => {
		expect(sheetChannelId('ChannelLongPressActionSheet', { channel: { id: CHANNEL } })).toBe(
			CHANNEL,
		);
		expect(sheetChannelId('ThreadLongPressActionSheet', { channelId: CHANNEL })).toBe(CHANNEL);
	});

	test('ignores other sheets and missing ids', () => {
		expect(
			sheetChannelId('MessageLongPressActionSheet', { channelId: CHANNEL }),
		).toBeUndefined();
		expect(sheetChannelId('ChannelLongPressActionSheet', {})).toBeUndefined();
	});
});
