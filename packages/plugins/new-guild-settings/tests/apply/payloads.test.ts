import type { Settings } from '@unbound-app/settings';
import { describe, expect, test } from 'bun:test';

import { buildNotificationUpdates, isApplicableGuildId } from '~/apply/payloads';

// Vencord's defaults.
const DEFAULTS: Settings = {
	guild: true,
	everyone: true,
	role: true,
	highlights: true,
	events: true,
	showAllChannels: true,
	messages: 'serverDefault',
};

describe('buildNotificationUpdates', () => {
	test('sends one update for the server default notification level', () => {
		expect(buildNotificationUpdates(DEFAULTS)).toEqual([
			{
				muted: true,
				suppress_everyone: true,
				suppress_roles: true,
				mute_scheduled_events: true,
				notify_highlights: 1,
			},
		]);
	});

	test("adds a message notification update with Discord's level for any other choice", () => {
		const level = (messages: Settings['messages']) =>
			buildNotificationUpdates({ ...DEFAULTS, messages })[1];

		expect(level('all')).toEqual({ message_notifications: 0 });
		expect(level('mentions')).toEqual({ message_notifications: 1 });
		expect(level('nothing')).toEqual({ message_notifications: 2 });
	});

	test('maps turned-off switches to unmuted, unsuppressed and unset highlights', () => {
		const [update] = buildNotificationUpdates({
			...DEFAULTS,
			guild: false,
			everyone: false,
			role: false,
			highlights: false,
			events: false,
			messages: 'nothing',
		});

		expect(update).toEqual({
			muted: false,
			suppress_everyone: false,
			suppress_roles: false,
			mute_scheduled_events: false,
			notify_highlights: 0,
		});
	});
});

describe('isApplicableGuildId', () => {
	test('accepts a server ID', () => {
		expect(isApplicableGuildId('1015060230222131221')).toBe(true);
	});

	test('rejects DMs, nulls and empty values', () => {
		for (const value of ['@me', 'null', '', null, undefined, 42]) {
			expect(isApplicableGuildId(value)).toBe(false);
		}
	});
});
