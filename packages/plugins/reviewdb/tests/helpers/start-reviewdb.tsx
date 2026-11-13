import { metro, startPlugin } from '@unbound-app/api/testing';
import { Text, View } from 'react-native';

export type AboutCardProps = { userId?: string };

function Bio() {
	return <Text>bio</Text>;
}

function PolicyLinks() {
	return <Text>policy</Text>;
}

/** Registers Discord's About card the plugin patches at start, with a bio and policy links, then starts the plugin. Returns the card. */
export async function startReviewdb() {
	const card = {
		default: (_: AboutCardProps) => (
			<View>
				<Bio />
				<PolicyLinks />
			</View>
		),
	};

	metro.register(card, 'modules/user_profile/native/UserProfileAboutMeCard.tsx');
	await startPlugin();

	return card;
}
