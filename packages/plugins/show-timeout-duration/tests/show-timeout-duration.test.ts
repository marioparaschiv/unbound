import { flux, logs, metro, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

import type { StoreSeeds } from '@unbound-app/api/testing';

const HOUR = 3_600_000;

type Row = { message: { timestamp: string; timestampAccessibilityLabel: string } };

const MessageRowData = {
	generateMessageRowData: (_props: unknown): Row => ({
		message: { timestamp: '12:00', timestampAccessibilityLabel: 'Today at 12:00' },
	}),
};

function stores(timedOutUntil: string | null): StoreSeeds {
	return {
		Channel: { getChannel: () => ({ id: 'c1', guild_id: 'g1' }) },
		GuildMember: { getMember: () => ({ communicationDisabledUntil: timedOutUntil }) },
	};
}

async function rowFor(timedOutUntil: string | null): Promise<Row> {
	flux.seed(stores(timedOutUntil));
	await startPlugin();

	return MessageRowData.generateMessageRowData({
		message: { id: 'm1', channel_id: 'c1', author: { id: 'u1' } },
	});
}

beforeEach(() => {
	metro.register(MessageRowData);
});

describe('the message timestamp', () => {
	test('shows how long the author stays timed out', async () => {
		const row = await rowFor(new Date(Date.now() + 5 * HOUR - 1000).toISOString());

		expect(row.message.timestamp).toBe('12:00 • 5h timeout remaining');
		expect(row.message.timestampAccessibilityLabel).toBe(
			'Today at 12:00 • Timeout expires in 5h',
		);
	});

	test('is left alone when the author is not timed out', async () => {
		const row = await rowFor(null);

		expect(row.message.timestamp).toBe('12:00');
	});

	test('starts without a warning', async () => {
		await rowFor(null);

		expect(logs.entries.filter(({ level }) => level === 'warn' || level === 'error')).toEqual(
			[],
		);
	});
});
