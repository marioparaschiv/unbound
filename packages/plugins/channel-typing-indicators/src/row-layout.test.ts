import { describe, expect, test } from 'bun:test';

import { findTextChannelSlot, findThreadChannelSlot, type RenderNode } from './row-layout';
import { INDICATOR_KEY } from './constants';

function textRow(channelId: string, parts: RenderNode[] = []) {
	const info = { props: { channel: { id: channelId } } };
	const content = { props: { children: [{}, {}, ...parts, info] } };
	const row = { props: { accessibilityRole: 'button', children: [false, content] } };

	return { result: { props: { children: [null, row, false] } }, row, content, info };
}

function threadRow(channelId: string, channelInfo: RenderNode | null = null) {
	const row = { props: { channel: { id: channelId }, accessibilityRole: 'button', channelInfo } };
	const container = { props: { children: [false, null, row] } };

	return { result: { props: { children: [null, null, container] } }, row, container };
}

describe('findTextChannelSlot', () => {
	test('finds the channel info inside the row button', () => {
		const { result, row, content } = textRow('channel');
		const slot = findTextChannelSlot(result, 'channel');

		expect(slot?.row).toBe(row);
		expect(slot?.content).toBe(content);
		expect(slot?.index).toBe(2);
	});

	test('leaves an unfamiliar row alone', () => {
		expect(
			findTextChannelSlot({ props: { children: ['unchanged'] } }, 'channel'),
		).toBeUndefined();
		expect(findTextChannelSlot(textRow('other').result, 'channel')).toBeUndefined();
	});

	test('leaves a row that already shows the indicator alone', () => {
		const { result } = textRow('channel', [{ key: INDICATOR_KEY }]);

		expect(findTextChannelSlot(result, 'channel')).toBeUndefined();
	});
});

describe('findThreadChannelSlot', () => {
	test('finds the thread row button and its container', () => {
		const { result, row, container } = threadRow('thread');
		const slot = findThreadChannelSlot(result, 'thread');

		expect(slot?.row).toBe(row);
		expect(slot?.container).toBe(container);
	});

	test('leaves a thread row that already shows the indicator alone', () => {
		const { result } = threadRow('thread', { key: INDICATOR_KEY });

		expect(findThreadChannelSlot(result, 'thread')).toBeUndefined();
	});
});
