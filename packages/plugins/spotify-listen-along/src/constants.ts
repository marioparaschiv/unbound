export const PLUGIN_NAME = 'Spotify Listen Along';

export const LOADING_MS = 5_000;

export const DRAFT_TYPE_CHANNEL_MESSAGE = 0;

export const ACTIVITY_ACTION_LISTEN = 3;

export const Reasons = {
	YOURSELF: 'Listen along with someone else, not yourself.',
	ALREADY_LISTENING: "You're already along for this ride.",
	NOT_DETECTED: 'Spotify is not detected.',
} as const;
