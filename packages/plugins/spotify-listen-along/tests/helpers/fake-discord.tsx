import { metro } from '@unbound-app/api/testing';
import { memo, type ReactElement } from 'react';
import { Pressable, Text } from 'react-native';

export type OverflowButtons = { text: string; disabled?: boolean; onPress: () => void }[];

export const sent: unknown[][] = [];
export const cleared: unknown[][] = [];
export const discordJoins: unknown[] = [];

export type JoinEvent = { nativeEvent: { messageId: string } };

export const MessagesRenderer = {
	default: (): ReactElement => (
		<Chat onTapJoinRichPresence={(event: JoinEvent) => discordJoins.push(event)} />
	),
};

function Chat(_props: { onTapJoinRichPresence: (event: JoinEvent) => void }): ReactElement {
	return <Text>chat</Text>;
}

export const ActivityButtons = {
	PlayOnSpotifyButton: (_props: { activity?: unknown }): ReactElement => (
		<Text>Play on Spotify</Text>
	),
};

function MediaKeyboardBottomSheetActions({
	overflowButtons,
}: {
	overflowButtons: OverflowButtons;
}) {
	return (
		<>
			{overflowButtons.map((button) => (
				<Pressable
					key={button.text}
					accessibilityLabel={button.text}
					onPress={button.onPress}
				>
					<Text>{button.text}</Text>
				</Pressable>
			))}
		</>
	);
}

export const MediaKeyboardActions = memo(MediaKeyboardBottomSheetActions);

/** Registers the Discord modules the plugin looks up, each recording what the plugin calls on it. */
export function registerDiscord() {
	for (const list of [sent, cleared, discordJoins]) list.length = 0;

	metro.register({
		getAPIBaseURL: () => 'https://discord.com/api',
		get: async () => ({ body: { access_token: 'token' } }),
		put: async () => ({ body: {} }),
	});
	metro.register(ActivityButtons);
	metro.register({ SpotifyPlayButton: (): ReactElement => <Text>Play</Text> });
	metro.register(MediaKeyboardActions);
	metro.register({ SpotifyNeutralIcon: () => null });
	metro.register({
		sendMessage: (...args: unknown[]) => sent.push(args),
		receiveMessage: () => undefined,
	});
	metro.register({ clearDraft: (...args: unknown[]) => cleared.push(args) });
	metro.register(MessagesRenderer, 'modules/messages/native/MessagesRenderer.tsx');
}
