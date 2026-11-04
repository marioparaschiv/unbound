import { metro, startPlugin } from '@unbound-app/api/testing';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

export type CardProps = { title?: ReactNode; children?: ReactNode };

/**
 * Discord's profile card. Every test registers this one object, because the plugin finds it with `metro.find`, which the
 * kit resolves once, when the plugin first loads, instead of on each access as the client does.
 */
export const card = {
	default: ({ title, children }: CardProps) => <Text>{title ?? children}</Text>,
};

/** Registers the profile card the plugin patches at start, as Discord has it, then starts the plugin. */
export async function startReviewdb() {
	metro.register(card, 'modules/user_profile/native/UserProfileCard.tsx');
	await startPlugin();
}
