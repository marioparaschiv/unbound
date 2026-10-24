import {
	ANDROID_NONCE_OFFSET,
	ANDROID_OFFSET_TOLERANCE,
	DISCORD_EPOCH,
	SNOWFLAKE_SHIFT,
} from '~/constants';

export type LatencyColor = 'danger' | 'muted' | 'positive' | 'warning';
export type LatencyFill = [LatencyColor, LatencyColor, LatencyColor];

export type LatencyMessage = {
	author?: { bot?: boolean; id?: string; username?: string };
	id?: string | number;
	nonce?: string | number | null;
};

export type LatencyOptions = {
	latency: number;
	showMillis: boolean;
	ignoreSelf: boolean;
	detectDiscordKotlin: boolean;
};

export type LatencyDetails = {
	ahead: boolean;
	androidClient: boolean;
	delta: number;
	displayDelta: string | null;
	fill: LatencyFill;
};

/**
 * @description Reads the creation time out of a Discord snowflake using decimal long division, so it never needs `BigInt`.
 * @param value The snowflake, as a string or a safe integer.
 * @returns The Unix timestamp in milliseconds, or `null` when the value is not a valid snowflake.
 */
export function snowflakeTimestamp(value: string | number | null | undefined): number | null {
	if (typeof value === 'number' && !Number.isSafeInteger(value)) return null;

	const digits = String(value);

	if (!/^\d+$/.test(digits)) return null;

	let remainder = 0;
	let quotient = '';

	for (const digit of digits) {
		const current = remainder * 10 + Number(digit);
		const next = Math.floor(current / SNOWFLAKE_SHIFT);

		remainder = current % SNOWFLAKE_SHIFT;

		if (quotient || next) quotient += String(next);
	}

	if (!quotient) return null;

	const timestamp = DISCORD_EPOCH + Number(quotient);

	return Number.isSafeInteger(timestamp) ? timestamp : null;
}

/**
 * @description Spells out a duration the way Vencord's MessageLatency does, such as "2 minutes and 3 seconds".
 * @param delta The duration in milliseconds.
 * @param showMillis Whether milliseconds are shown, which moves the "and" before them.
 * @returns The English duration text.
 */
export function formatLatency(delta: number, showMillis: boolean): string {
	// Vencord's joining rule ("1 hour 2 minutes and 3 seconds") has no `Intl.ListFormat` equivalent.
	const parts: [number, string][] = [
		[Math.floor(delta / 86_400_000), 'day'],
		[Math.floor((delta / 3_600_000) % 24), 'hour'],
		[Math.floor((delta / 60_000) % 60), 'minute'],
		[Math.floor((delta / 1000) % 60), 'second'],
		[Math.floor(delta % 1000), 'millisecond'],
	];
	const lastJoined = showMillis ? 'millisecond' : 'second';
	let result = '';

	for (const [value, unit] of parts) {
		if (!value) continue;

		if (result) result += unit === lastJoined ? ' and ' : ' ';

		result += `${value} ${unit}${value > 1 ? 's' : ''}`;
	}

	return result || '0 seconds';
}

/**
 * @description Measures how long a message took to send, from the gap between its ID and its nonce.
 * @param message The message, with the author, ID, and nonce.
 * @param currentUserId The signed-in user's ID, for the "ignore my messages" setting.
 * @param options The user's latency settings.
 * @returns What the indicator shows, or `null` when the message gets no indicator.
 */
export function latencyDetails(
	message: LatencyMessage,
	currentUserId: string | undefined,
	options: LatencyOptions,
): LatencyDetails | null {
	if (message.nonce == null || message.author?.bot) return null;

	if (options.ignoreSelf && message.author?.id === currentUserId) return null;

	const messageTimestamp = snowflakeTimestamp(message.id);
	const nonceTimestamp = snowflakeTimestamp(message.nonce);

	if (messageTimestamp == null || nonceTimestamp == null) return null;

	let delta = messageTimestamp - nonceTimestamp;

	if (!options.showMillis) delta = Math.round(delta / 1000) * 1000;

	let androidClient = false;

	if (-delta >= ANDROID_NONCE_OFFSET - ANDROID_OFFSET_TOLERANCE) {
		androidClient = options.detectDiscordKotlin;
		delta += ANDROID_NONCE_OFFSET;
	}

	const absoluteDelta = Math.abs(delta);
	const ahead = absoluteDelta !== delta;
	const displayDelta =
		absoluteDelta >= options.latency * 1000
			? formatLatency(absoluteDelta, options.showMillis)
			: null;

	if (displayDelta === null && !androidClient) return null;

	let fill: LatencyFill = ['warning', 'warning', 'muted'];

	if (androidClient) {
		fill = ['positive', 'positive', 'muted'];
	} else if (delta >= 120_000 || ahead) {
		fill = ['muted', 'muted', 'muted'];
	} else if (delta >= options.latency * 2000) {
		fill = ['danger', 'muted', 'muted'];
	}

	return { ahead, androidClient, delta: absoluteDelta, displayDelta, fill };
}

/**
 * @description Builds the tooltip text shown when the indicator is tapped.
 * @param details The indicator details from `latencyDetails`.
 * @returns The tooltip sentence.
 */
export function latencyTooltip(details: LatencyDetails): string {
	if (!details.displayDelta) return 'User is suspected to be on an old Discord Android client';

	const message = details.ahead
		? `This user's clock is ${details.displayDelta} ahead.`
		: `This message was sent with a delay of ${details.displayDelta}.`;

	return details.androidClient
		? `${message} User is suspected to be on an old Discord Android client.`
		: message;
}

export default { snowflakeTimestamp, formatLatency, latencyDetails, latencyTooltip };
