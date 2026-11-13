import type { FluxStore } from '@unbound-app/api/flux';

export type SpotifyActivity = {
	party?: { id?: string };
	sync_id?: string;
	timestamps?: { start?: number };
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
		Draft: FluxStore & {
			getDraft(channelId: string, draftType: number): string;
		};
	}
}
