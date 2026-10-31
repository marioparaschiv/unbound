import type { Greeting } from '~/types';

/**
 * @description Words the greeting for a user on a platform.
 * @param greeting Who to greet and the platform they are on.
 * @returns The greeting.
 */
export function greetingFor({ username, platform }: Greeting): string {
	return `Hello ${username ?? 'there'}, from {{displayName}} on ${platform}.`;
}
