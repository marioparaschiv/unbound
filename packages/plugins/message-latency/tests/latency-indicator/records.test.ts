import { flux } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';
import { settings } from '@unbound-app/settings';

import { createLatencyRecords } from '~/latency-indicator/records';
import { DISCORD_EPOCH } from '~/constants';

function snowflake(timestamp: number): string {
	return (BigInt(timestamp - DISCORD_EPOCH) << 22n).toString();
}

// A message whose nonce was made `delay` milliseconds before Discord gave it an id.
function delayed(delay: number, id = '1') {
	const sentAt = DISCORD_EPOCH + 1_000_000_000;

	return {
		id: snowflake(sentAt),
		nonce: snowflake(sentAt - delay),
		author: { id, username: 'wumpus' },
	};
}

beforeEach(() => {
	flux.seed({ User: { getCurrentUser: () => ({ id: 'self' }) } });
});

describe('the latency records', () => {
	test('describe a message that took longer than the threshold', () => {
		const records = createLatencyRecords();
		const message = delayed(3000);

		records.update(message, 'wumpus');

		expect(records.get(message.id)?.tooltip).toBe(
			'This message was sent with a delay of 3 seconds.',
		);
	});

	test('skip a message that was faster than the threshold the user chose', () => {
		const records = createLatencyRecords();
		const message = delayed(3000);

		settings.latency = 5;
		records.update(message, 'wumpus');

		expect(records.get(message.id)).toBeUndefined();
	});

	test('include milliseconds when the user asks for them', () => {
		const records = createLatencyRecords();
		const message = delayed(2500);

		settings.showMillis = true;
		records.update(message, 'wumpus');

		expect(records.get(message.id)?.tooltip).toBe(
			'This message was sent with a delay of 2 seconds and 500 milliseconds.',
		);
	});

	test('skip the user’s own messages when asked to', () => {
		const records = createLatencyRecords();
		const message = delayed(3000, 'self');

		settings.ignoreSelf = true;
		records.update(message, 'self');

		expect(records.get(message.id)).toBeUndefined();
	});
});
