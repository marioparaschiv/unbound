import type { Preferences } from '~/constants';

export type TrackData = {
	name: string;
	album: string;
	artist: string;
	trackURL?: string;
	artistURL?: string;
	albumURL?: string;
	imageURL?: string;
	serviceName?: string;
};

export type ActivityAssets = {
	large_image?: string;
	large_text?: string;
	large_url?: string;
	small_image?: string;
	small_text?: string;
};

export type Activity = {
	application_id: string;
	name: string;
	details?: string;
	details_url?: string;
	state?: string;
	state_url?: string;
	status_display_type?: number;
	assets?: ActivityAssets;
	buttons?: string[];
	metadata?: { button_urls?: string[] };
	type: number;
	flags: number;
};

export type PresenceActivity = {
	application_id?: string;
	type?: number;
};

export type Fetcher = (
	input: string,
	init?: { headers?: Record<string, string> },
) => Promise<{
	ok: boolean;
	status: number;
	statusText: string;
	json(): Promise<unknown>;
}>;

export type Scrobbler = {
	name: string;
	id: 'lastfm' | 'listenbrainz';
	fetchTrackData(preferences: Preferences, fetcher: Fetcher): Promise<TrackData | null>;
	userUrl(preferences: Preferences, username: string): string;
};

export type ResolveAsset = (key: string) => Promise<string | undefined>;

declare module '@unbound-app/api/flux' {
	interface FluxActions {
		LOCAL_ACTIVITY_UPDATE: { activity: Activity | null; socketId: string };
	}
}
