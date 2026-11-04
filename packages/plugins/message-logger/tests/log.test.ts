import { describe, expect, test } from 'bun:test';

import { createMessageLog } from '~/log';

describe('createMessageLog', () => {
	test('records deletions and asks for one redraw', () => {
		const log = createMessageLog();

		log.markDeleted('c', 'm');

		expect(log.isDeleted('m')).toBe(true);
		expect(log.hasHistory('m')).toBe(true);
		expect(log.takeRender('m')).toBe(true);
		expect(log.takeRender('m')).toBe(false);
		expect(log.deletedMessages()).toEqual([{ channelId: 'c', messageId: 'm' }]);
	});

	test('keeps edits in order and forgets them on request', () => {
		const log = createMessageLog();

		log.addEdit('m', { content: 'one', timestamp: 't1' });
		log.addEdit('m', { content: 'two', timestamp: 't2' });

		expect(log.editsOf('m').map((edit) => edit.content)).toEqual(['one', 'two']);

		log.forgetEdits('m');

		expect(log.hasHistory('m')).toBe(false);
	});

	test('tracks deleted attachments by channel', () => {
		const log = createMessageLog();

		log.addDeletedAttachments('c', 'm', ['a']);

		expect(log.isAttachmentDeleted('m', 'a')).toBe(true);
		expect(log.messagesWithDeletedAttachments()).toEqual([{ channelId: 'c', messageId: 'm' }]);
	});
});
