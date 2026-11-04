import { describe, expect, test } from 'bun:test';

import { buildNotificationUpdates, isApplicableGuildId, readSettings } from '~/apply/payloads';
import { DEFAULTS, MessageNotifications } from '~/constants';

function bucket(values: Record<string, unknown>) {
	return { get: (key: string, def: unknown) => (key in values ? values[key] : def) };
}

describe('readSettings', () => {
	test('uses Vencord defaults for an empty bucket', () => {
		expect(readSettings(bucket({}))).toEqual(DEFAULTS);
	});

	test('keeps stored values', () => {
		const settings = readSettings(bucket({ guild: false, messages: 1, highlights: false }));

		expect(settings.guild).toBe(false);
		expect(settings.messages).toBe(MessageNotifications.Mentions);
		expect(settings.highlights).toBe(false);
		expect(settings.role).toBe(true);
	});

	test('falls back to defaults for malformed values', () => {
		const settings = readSettings(bucket({ guild: 'yes', messages: 7, events: null }));

		expect(settings.guild).toBe(true);
		expect(settings.messages).toBe(MessageNotifications.ServerDefault);
		expect(settings.events).toBe(true);
	});
});

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

	test('adds a message notification update for any other level', () => {
		const updates = buildNotificationUpdates({
			...DEFAULTS,
			messages: MessageNotifications.All,
		});

		expect(updates).toHaveLength(2);
		expect(updates[1]).toEqual({ message_notifications: 0 });
	});

	test('maps turned-off switches to unmuted, unsuppressed and unset highlights', () => {
		const [update] = buildNotificationUpdates({
			...DEFAULTS,
			guild: false,
			everyone: false,
			role: false,
			highlights: false,
			events: false,
			messages: MessageNotifications.Nothing,
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
