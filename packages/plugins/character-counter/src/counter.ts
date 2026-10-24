export type CounterTone = 'primary' | 'muted' | 'yellow' | 'orange' | 'red';

/**
 * @description Discord's message length limit for the current user.
 * @param premiumType The user's Nitro tier; `2` is Nitro.
 * @returns 4000 for Nitro, otherwise 2000.
 */
export function characterLimit(premiumType: unknown): number {
	return premiumType === 2 ? 4000 : 2000;
}

/**
 * @description Picks the counter's color as the message approaches the limit.
 * @param count The message length.
 * @param limit The user's message length limit.
 * @param colorEffects Whether the warning colors are turned on.
 * @returns `primary` when warnings are off, otherwise a tone for the share of the limit used.
 */
export function counterTone(count: number, limit: number, colorEffects: boolean): CounterTone {
	if (!colorEffects) return 'primary';

	const percentage = (count / limit) * 100;

	if (percentage < 50) return 'muted';
	if (percentage < 75) return 'yellow';
	if (percentage < 90) return 'orange';

	return 'red';
}
