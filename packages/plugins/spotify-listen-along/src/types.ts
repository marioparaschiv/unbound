import type { FluxStore } from '@unbound-app/api/flux';

export type SpotifyActivity = {
	party?: { id?: string };
};

export type OverflowButton = {
	text: string;
	IconComponent: unknown;
	onPress: () => void;
	disabled?: boolean;
};

declare module '@unbound-app/api/flux' {
	interface FluxStores {
		Spotify: FluxStore & {
			getActivity(): SpotifyActivity | null;
			getActiveSocketAndDevice(): unknown;
			hasConnectedAccount(): boolean;
		};
		SpotifyProtocol: FluxStore & {
			isProtocolRegistered(): boolean;
		};
		Draft: FluxStore & {
			getDraft(channelId: string, draftType: number): string;
		};
	}

	interface FluxActions {
		SPOTIFY_PLAYER_STATE: Record<string, unknown>;
	}
}
