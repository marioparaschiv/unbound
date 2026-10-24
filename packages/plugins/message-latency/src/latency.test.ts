import { describe, expect, test } from 'bun:test';

import { formatLatency, latencyDetails, latencyTooltip, snowflakeTimestamp } from './latency';

const DISCORD_EPOCH = 1_420_070_400_000;
const ANDROID_OFFSET = 1_471_228_928;

const defaults = {
	latency: 2,
	showMillis: false,
	ignoreSelf: false,
	detectDiscordKotlin: true,
};

function snowflake(timestamp: number): string {
	return (BigInt(timestamp - DISCORD_EPOCH) << 22n).toString();
}

type Author = {
	id?: string;
	bot?: boolean;
};

function sent(nonceOffset: number, author: Author = { id: 'other' }) {
	return {
		author,
		id: snowflake(DISCORD_EPOCH + 1_000_000),
		nonce: snowflake(DISCORD_EPOCH + 1_000_000 + nonceOffset),
	};
}

describe('snowflakeTimestamp', () => {
	test('extracts the millisecond timestamp', () => {
		const timestamp = DISCORD_EPOCH + 1_700_000_000_000;

		expect(snowflakeTimestamp(snowflake(timestamp))).toBe(timestamp);
	});

	test('rejects malformed and unsafe numeric values', () => {
		expect(snowflakeTimestamp('not-a-snowflake')).toBeNull();
		expect(snowflakeTimestamp(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
	});
});

describe('latencyDetails', () => {
	test('matches Vencord warning and danger thresholds', () => {
		expect(latencyDetails(sent(-2500), 'self', defaults)).toEqual({
			ahead: false,
			androidClient: false,
			delta: 3000,
			displayDelta: '3 seconds',
			fill: ['warning', 'warning', 'muted'],
		});
		expect(latencyDetails(sent(-4000), 'self', defaults)?.fill).toEqual([
			'danger',
			'muted',
			'muted',
		]);
	});

	test('uses muted bars for clock-ahead and long delays', () => {
		expect(latencyDetails(sent(5000), 'self', defaults)?.fill).toEqual([
			'muted',
			'muted',
			'muted',
		]);
		expect(latencyDetails(sent(-180_000), 'self', defaults)?.fill).toEqual([
			'muted',
			'muted',
			'muted',
		]);
	});

	test('ignores missing nonces, bot messages, fast sends, and optional self messages', () => {
		expect(
			latencyDetails({ id: snowflake(DISCORD_EPOCH + 20_000) }, 'self', defaults),
		).toBeNull();
		expect(latencyDetails(sent(-3000, { bot: true }), 'self', defaults)).toBeNull();
		expect(latencyDetails(sent(-1000), 'self', defaults)).toBeNull();
		expect(
			latencyDetails(sent(-3000, { id: 'self' }), 'self', { ...defaults, ignoreSelf: true }),
		).toBeNull();
	});

	test('detects the old Discord Kotlin nonce offset', () => {
		const message = sent(ANDROID_OFFSET);

		expect(latencyDetails(message, 'self', defaults)).toEqual({
			ahead: true,
			androidClient: true,
			delta: 72,
			displayDelta: null,
			fill: ['positive', 'positive', 'muted'],
		});
		expect(
			latencyDetails(message, 'self', { ...defaults, detectDiscordKotlin: false }),
		).toBeNull();
	});
});

describe('latencyTooltip', () => {
	test('describes delays, clock offsets, and old clients like Vencord', () => {
		const delayed = latencyDetails(sent(-2500), 'self', defaults);
		const ahead = latencyDetails(sent(5000), 'self', defaults);
		const android = latencyDetails(sent(ANDROID_OFFSET), 'self', defaults);

		expect(delayed && latencyTooltip(delayed)).toBe(
			'This message was sent with a delay of 3 seconds.',
		);
		expect(ahead && latencyTooltip(ahead)).toBe("This user's clock is 5 seconds ahead.");
		expect(android && latencyTooltip(android)).toBe(
			'User is suspected to be on an old Discord Android client',
		);
	});
});

describe('formatLatency', () => {
	test('uses Vencord unit names and separator behavior', () => {
		expect(formatLatency(3000, false)).toBe('3 seconds');
		expect(formatLatency(1000, false)).toBe('1 second');
		expect(formatLatency(123_000, false)).toBe('2 minutes and 3 seconds');
		expect(formatLatency(3_723_000, false)).toBe('1 hour 2 minutes and 3 seconds');
		expect(formatLatency(2500, true)).toBe('2 seconds and 500 milliseconds');
		expect(formatLatency(325, true)).toBe('325 milliseconds');
		expect(formatLatency(0, true)).toBe('0 seconds');
	});
});
