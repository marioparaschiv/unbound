import {
	ACTIVITY_FLAG_INSTANCE,
	ActivityType,
	DISCORD_APP_ID,
	LASTFM_PLACEHOLDER_IMAGE_HASH,
	StatusDisplayType,
	type Preferences,
	type StatusDisplay,
} from '~/constants';
import type {
	Activity,
	ActivityAssets,
	PresenceActivity,
	ResolveAsset,
	Scrobbler,
	TrackData,
} from '~/types';

const STATUS_DISPLAY: Record<StatusDisplay, number> = {
	off: StatusDisplayType.NAME,
	artist: StatusDisplayType.STATE,
	track: StatusDisplayType.DETAILS,
};

/**
 * @description Fills the `{artist}`, `{album}` and `{title}` variables of the custom status text.
 * @param template The custom status text.
 * @param track The playing track.
 * @returns The text with every variable replaced.
 */
export function fillStatusName(template: string, track: TrackData): string {
	return template
		.replaceAll('{artist}', track.artist || '')
		.replaceAll('{album}', track.album || '')
		.replaceAll('{title}', track.name || '');
}

/**
 * @description Picks the activity name shown after "Playing" or "Listening to", following the name format setting.
 * @param preferences The current preferences.
 * @param track The playing track.
 * @returns The activity name.
 */
export function formatStatusName(preferences: Preferences, track: TrackData): string {
	const custom = () => fillStatusName(preferences.statusName, track);

	switch (preferences.nameFormat) {
		case 'artist-first':
			return `${track.artist} - ${track.name}`;
		case 'song-first':
			return `${track.name} - ${track.artist}`;
		case 'artist':
			return track.artist;
		case 'song':
			return track.name;
		case 'album':
			return track.album || custom();
		case 'service-name':
			return track.serviceName || custom();
		default:
			return custom();
	}
}

/**
 * @description Picks the large image for a track: its cover, the generic placeholder, or nothing for the scrobbler logo.
 * @param preferences The current preferences.
 * @param track The playing track.
 * @returns An image URL, `'placeholder'`, or `undefined` to show the large scrobbler logo.
 */
export function pickLargeImage(preferences: Preferences, track: TrackData): string | undefined {
	if (
		preferences.showAlbumCover &&
		track.imageURL &&
		!track.imageURL.includes(LASTFM_PLACEHOLDER_IMAGE_HASH)
	) {
		return track.imageURL;
	}

	return preferences.missingArt === 'placeholder' ? 'placeholder' : undefined;
}

/**
 * @description Tells whether another activity should hide the music presence.
 * @param preferences The current preferences.
 * @param activities The signed-in user's current activities.
 * @returns `true` when Spotify, another music app, or any other activity the settings defer to is showing.
 */
export function shouldHide(preferences: Preferences, activities: PresenceActivity[]): boolean {
	const others = activities.filter((activity) => activity.application_id !== DISCORD_APP_ID);

	if (
		preferences.hideWithActivity &&
		others.some((activity) => activity.type !== ActivityType.CUSTOM_STATUS)
	) {
		return true;
	}

	return (
		preferences.hideWithSpotify &&
		others.some((activity) => activity.type === ActivityType.LISTENING)
	);
}

async function buildAssets(
	preferences: Preferences,
	track: TrackData,
	scrobbler: Scrobbler,
	resolve: ResolveAsset,
): Promise<ActivityAssets> {
	const largeImage = pickLargeImage(preferences, track);
	const large_text = track.album || undefined;

	if (!largeImage) {
		return { large_image: await resolve(`${scrobbler.id}-large`), large_text };
	}

	return {
		large_image: await resolve(largeImage),
		large_text,
		...(preferences.showLogo && {
			small_image: await resolve(`${scrobbler.id}-small`),
			small_text: scrobbler.id,
		}),
	};
}

/**
 * @description Builds the Rich Presence activity for a playing track.
 * @param preferences The current preferences.
 * @param track The playing track.
 * @param scrobbler The backend the track came from.
 * @param resolve Turns an asset key or image URL into a Discord asset id.
 * @returns The activity to set.
 */
export async function buildActivity(
	preferences: Preferences,
	track: TrackData,
	scrobbler: Scrobbler,
	resolve: ResolveAsset,
): Promise<Activity> {
	const assets = await buildAssets(preferences, track, scrobbler, resolve);
	const buttons =
		preferences.shareUsername && preferences.username
			? [
					{
						label: `${scrobbler.name} Profile`,
						url: scrobbler.userUrl(preferences, preferences.username),
					},
				]
			: [];

	const activity: Activity = {
		application_id: DISCORD_APP_ID,
		name: formatStatusName(preferences, track),
		details: track.name,
		state: track.artist,
		status_display_type: STATUS_DISPLAY[preferences.statusDisplayType],
		assets,
		buttons: buttons.length ? buttons.map((button) => button.label) : undefined,
		metadata: { button_urls: buttons.map((button) => button.url) },
		type: preferences.useListeningStatus ? ActivityType.LISTENING : ActivityType.PLAYING,
		flags: ACTIVITY_FLAG_INSTANCE,
	};

	if (preferences.clickableLinks) {
		activity.details_url = track.trackURL;
		activity.state_url = track.artistURL;

		if (track.album) assets.large_url = track.albumURL;
	}

	return activity;
}

/**
 * @description Looks up what is playing and builds the activity for it, or decides none should show.
 * @param preferences The current preferences.
 * @param activities The signed-in user's current activities.
 * @param scrobbler The chosen backend.
 * @param fetcher Makes HTTP requests.
 * @param resolve Turns an asset key or image URL into a Discord asset id.
 * @returns The activity to set, or `null` to clear it.
 */
export async function resolveActivity(
	preferences: Preferences,
	activities: PresenceActivity[],
	scrobbler: Scrobbler,
	fetcher: Parameters<Scrobbler['fetchTrackData']>[1],
	resolve: ResolveAsset,
): Promise<Activity | null> {
	if (shouldHide(preferences, activities)) return null;

	const track = await scrobbler.fetchTrackData(preferences, fetcher);

	return track ? buildActivity(preferences, track, scrobbler, resolve) : null;
}
