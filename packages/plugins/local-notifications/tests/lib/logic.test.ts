import { describe, expect, test } from 'bun:test';

import { notificationText } from '~/lib/notification-text';
import { shouldNotify } from '~/lib/should-notify';

const base = {
	fromMe: false,
	optimistic: false,
	mentioned: false,
	direct: false,
	muted: false,
	active: false,
};

describe('shouldNotify', () => {
	test('notifies for mentions and DMs in the background', () => {
		expect(shouldNotify({ ...base, mentioned: true }, { directMessages: false })).toBe(true);
		expect(shouldNotify({ ...base, direct: true }, { directMessages: true })).toBe(true);
	});

	test('stays quiet in the foreground, for your own, muted or disabled DMs', () => {
		expect(
			shouldNotify({ ...base, mentioned: true, active: true }, { directMessages: true }),
		).toBe(false);
		expect(
			shouldNotify({ ...base, mentioned: true, fromMe: true }, { directMessages: true }),
		).toBe(false);
		expect(shouldNotify({ ...base, direct: true, muted: true }, { directMessages: true })).toBe(
			false,
		);
		expect(shouldNotify({ ...base, direct: true }, { directMessages: false })).toBe(false);
	});
});

describe('notificationText', () => {
	const labels = { attachment: 'Sent an attachment', hidden: 'New message' };

	test('names the place for server messages and shows the text', () => {
		expect(
			notificationText(
				{
					author: 'adrian',
					channel: 'dev',
					guild: 'Unbound',
					content: 'hi',
					attachments: 0,
				},
				labels,
				true,
			),
		).toEqual({
			title: 'adrian (#dev, Unbound)',
			body: 'hi',
		});
	});

	test('falls back for attachments and hidden previews', () => {
		expect(
			notificationText({ author: 'a', content: ' ', attachments: 2 }, labels, true).body,
		).toBe('Sent an attachment');
		expect(
			notificationText({ author: 'a', content: 'secret', attachments: 0 }, labels, false)
				.body,
		).toBe('New message');
	});
});

describe('tappedTarget', () => {
	test('picks the newest notification that disappeared and keeps the rest', async () => {
		const { tappedTarget } = await import('~/lib/opened');
		const posted = [
			{ id: 'a', target: 1 },
			{ id: 'b', target: 2 },
			{ id: 'c', target: 3 },
		];

		expect(tappedTarget(posted, ['a', 'c'])).toEqual({
			target: 2,
			remaining: [posted[0], posted[2]],
		});
		expect(tappedTarget(posted, ['a', 'b', 'c']).target).toBeUndefined();
	});
});
