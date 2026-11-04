import { metro, startPlugin } from '@unbound-app/api/testing';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

export type CardProps = { title?: ReactNode; children?: ReactNode };

/** Registers a new profile card the plugin patches at start, as Discord has it, then starts the plugin. Returns the card. */
export async function startReviewdb() {
	const card = {
		default: ({ title, children }: CardProps) => <Text>{title ?? children}</Text>,
	};

	metro.register(card, 'modules/user_profile/native/UserProfileCard.tsx');
	await startPlugin();

	return card;
}
