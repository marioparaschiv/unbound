import { metro, startPlugin } from '@unbound-app/api/testing';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

export type CardProps = { title?: ReactNode; children?: ReactNode };

/**
 * Discord's profile card. Every test registers this one object, because the plugin keeps the lookup it made when it first
 * loaded and the testing kit's patcher keeps a patch by that lookup.
 */
export const card = {
	default: ({ title, children }: CardProps) => <Text>{title ?? children}</Text>,
};

/** Registers the profile card the plugin patches at start, as Discord has it, then starts the plugin. */
export async function startReviewdb() {
	metro.register(card, 'modules/user_profile/native/UserProfileCard.tsx');
	await startPlugin();
}
