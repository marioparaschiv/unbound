export const CLOCK_SKEW_NOTICE_S = 60;

/**
 * @description Describes how far the device clock is off, in the largest unit that fits.
 * @param skewS Seconds the device runs ahead, negative when behind.
 * @returns A phrase such as `4 min ahead`, or `in sync` within five seconds.
 */
export function skewPhrase(skewS: number): string {
	const seconds = Math.abs(skewS);

	if (seconds < 5) {
		return 'in sync';
	}

	const direction = skewS > 0 ? 'ahead' : 'behind';
	const amount =
		seconds < 120
			? `${seconds} s`
			: seconds < 7200
				? `${Math.round(seconds / 60)} min`
				: seconds < 172_800
					? `${Math.round(seconds / 3600)} h`
					: `${Math.round(seconds / 86_400)} d`;

	return `${amount} ${direction}`;
}

export default skewPhrase;
