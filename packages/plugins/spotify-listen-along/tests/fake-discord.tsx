import { metro as pluginMetro } from '@unbound-app/api';
import { metro } from '@unbound-app/api/testing';
import { mock } from 'bun:test';
import { memo, type ReactElement } from 'react';
import { Pressable, Text } from 'react-native';

// The testing kit has no fake of Discord's design components or of `filters.byTypeName`; these stand in until it has.
function IconButton(props: Record<string, unknown>) {
	return <Pressable {...props} />;
}

mock.module('@unbound-app/api/metro/components', () => ({ Discord: { IconButton } }));

Object.assign(pluginMetro.filters, {
	byTypeName: (name: string) => (module: { type?: { name?: string } }) =>
		module.type?.name === name,
});

export type OverflowButtons = { text: string; disabled?: boolean; onPress: () => void }[];

export const sent: unknown[][] = [];
export const cleared: unknown[][] = [];
export const played: unknown[][] = [];
export const synced: unknown[][] = [];

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
	for (const list of [sent, cleared, played, synced]) list.length = 0;

	metro.register({
		play: (...args: unknown[]) => played.push(args),
		sync: (...args: unknown[]) => synced.push(args),
		getMetadata: () => undefined,
	});
	metro.register(ActivityButtons);
	metro.register({ SpotifyPlayButton: (): ReactElement => <Text>Play</Text> });
	metro.register(MediaKeyboardActions);
	metro.register({ SpotifyNeutralIcon: () => null });
	metro.register({
		sendMessage: (...args: unknown[]) => sent.push(args),
		revealMessage: () => undefined,
	});
	metro.register({ clearDraft: (...args: unknown[]) => cleared.push(args) });
}
