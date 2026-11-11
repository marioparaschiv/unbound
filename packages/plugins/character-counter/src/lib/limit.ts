import type { FluxUser } from '@unbound-app/api/flux';

export type CounterTone = 'primary' | 'muted' | 'yellow' | 'orange' | 'red';

/**
 * @description Discord's message length limit for a user.
 * @param user The signed-in user; a `premiumType` of `2` is Nitro.
 * @returns 4000 for Nitro, otherwise 2000.
 */
export function characterLimit(user: Pick<FluxUser, 'premiumType'> | undefined): number {
	return user?.premiumType === 2 ? 4000 : 2000;
}

/**
 * @description Picks the counter's color as the message approaches the limit.
 * @param length The message length.
 * @param limit The user's message length limit.
 * @param colorEffects Whether the warning colors are turned on.
 * @returns `primary` when warnings are off, otherwise a tone for the share of the limit used.
 */
export function counterTone(length: number, limit: number, colorEffects: boolean): CounterTone {
	if (!colorEffects) return 'primary';

	const used = length / limit;

	if (used < 0.5) return 'muted';
	if (used < 0.75) return 'yellow';
	if (used < 0.9) return 'orange';

	return 'red';
}
