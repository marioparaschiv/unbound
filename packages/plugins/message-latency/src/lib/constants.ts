import type { LatencyColor } from '~/lib/latency';

export const ICON_TAG = 0x1a7e9c;

export const DISCORD_EPOCH = 1_420_070_400_000;

// 2^22: a snowflake's timestamp is its value shifted right by 22 bits.
export const SNOWFLAKE_SHIFT = 4_194_304;

// Old Discord Android (Kotlin) clients generate nonces this far ahead of the message ID.
export const ANDROID_NONCE_OFFSET = 1_471_228_928;
export const ANDROID_OFFSET_TOLERANCE = 86_400_000;

export const MAX_LATENCY_RECORDS = 500;

export const Icon = {
	width: 12,
	height: 12,
	controlWidth: 16,
	controlHeight: 20,
	bars: [
		{ x: 1.2, y: 12.4, width: 2.4, height: 2.4 },
		{ x: 4.8, y: 8.8, width: 2.4, height: 6 },
		{ x: 8.4, y: 5.2, width: 2.4, height: 9.6 },
	],
};

export const FILL_TOKENS: Record<LatencyColor, string> = {
	danger: 'STATUS_DANGER',
	muted: 'TEXT_MUTED',
	positive: 'STATUS_POSITIVE',
	warning: 'STATUS_WARNING',
};
