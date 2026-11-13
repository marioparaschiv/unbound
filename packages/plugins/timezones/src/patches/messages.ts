import { settings } from '@unbound-app/settings';
import { format } from '@unbound-app/i18n';

import {
	onMessageRow,
	type MessageRow,
	type RowMessage,
} from '@unbound-plugins/shared/metro/message-rows';

import { deviceTimezone, showsFor, timezoneOf } from '~/lib/timezone';
import { clockOf, offsetMinutes, timeIn, twelveHour, type Clock } from '~/lib/zones';

const DISCORD_EPOCH = 1420070400000n;

type HeaderRow = MessageRow & { timestamp: string };

function sentAt(messageId: string): Date | undefined {
	try {
		return new Date(Number((BigInt(messageId) >> 22n) + DISCORD_EPOCH));
	} catch {
		return undefined;
	}
}

function isChatMessage(message: RowMessage): boolean {
	return message.type === 0 || message.type === 19;
}

function hasTimestamp(row: MessageRow | undefined): row is HeaderRow {
	return typeof row?.timestamp === 'string';
}

function addTime(row: HeaderRow, time: string): void {
	const shown = ` • ${time}`;

	if (!row.timestamp.endsWith(shown)) row.timestamp += shown;

	const spoken = `, ${format('THEIR_TIME', { time })}`;

	if (
		typeof row.timestampAccessibilityLabel === 'string' &&
		!row.timestampAccessibilityLabel.endsWith(spoken)
	) {
		row.timestampAccessibilityLabel += spoken;
	}
}

/**
 * @description Adds the author's local time after each message's timestamp, when their timezone's offset differs from the device's.
 * @returns Removes the patch.
 */
export function patchMessageTimes(): () => void {
	return onMessageRow({
		feature: 'Message times',
		after({ message, row }) {
			const author = message?.author;

			if (!settings.messages || !message?.id || !isChatMessage(message)) return;

			if (!author?.id || author.bot || author.system || !showsFor(author.id)) return;

			const zone = timezoneOf(author.id);
			const moment = sentAt(message.id);

			if (!zone || !moment || !hasTimestamp(row)) return;

			const seen = clockOf(row.timestamp);

			if (settings.discordClock !== seen) settings.discordClock = seen;

			if (offsetMinutes(moment, zone) === offsetMinutes(moment, deviceTimezone())) return;

			addTime(row, timeIn(moment, zone, twelveHour(settings.clock as Clock, seen)));
		},
	});
}

export default { patchMessageTimes };
