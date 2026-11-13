import { flux, metro, toasts } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { Linking } from 'react-native';

import { createFollower, type Follower, type HostActivity } from '~/lib/follow';
import { createSpotifyClient, type DiscordHTTP } from '~/lib/spotify-api';

type Account = { id: string; type: string };

type ConnectedAccountsStore = { getAccounts(): Account[] };

type PresenceStore = { getActivities(userId: string): HostActivity[] | undefined };

const SPOTIFY_URL = 'spotify:';

let follower: Follower | undefined;
let stopListening: (() => void) | undefined;

/**
 * @description Reads someone's current Spotify activity, the one Discord marks with their `spotify:` party.
 * @param userId The user.
 * @returns The activity, or `undefined` while they play nothing.
 */
export function spotifyActivityOf(userId: string): HostActivity | undefined {
	const Presences = flux.getStore('Presence') as unknown as PresenceStore;

	return Presences.getActivities(userId)?.find(
		(activity) => activity.party?.id === `spotify:${userId}`,
	);
}

function spotifyAccountId(): string | undefined {
	const Accounts = flux.getStore('ConnectedAccounts') as unknown as ConnectedAccountsStore;

	return Accounts.getAccounts().find((account) => account.type === 'spotify')?.id;
}

function stoppedText(reason: 'premium' | 'no-device' | 'failed'): string {
	switch (reason) {
		case 'premium':
			return messages.PREMIUM_REQUIRED;
		case 'no-device':
			return messages.NO_DEVICE;
		default:
			return messages.SYNC_FAILED;
	}
}

function createSession(): Follower | undefined {
	const http = metro.findByProps('getAPIBaseURL', 'get', 'put') as DiscordHTTP | undefined;
	const accountId = spotifyAccountId();

	if (!http || !accountId) {
		logger.warn('Listen along skipped: no Spotify account, or Discord moved its HTTP client.');

		return undefined;
	}

	const created = createFollower({
		client: createSpotifyClient(http, accountId),
		openSpotify: () => void Linking.openURL(SPOTIFY_URL).catch(() => undefined),
		wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
	});

	stopListening = flux.onStoreChange(flux.getStore('Presence'), () => {
		const host = created.following;

		if (host) void created.update(host, spotifyActivityOf(host));
	});

	return created;
}

/**
 * @description Ends the listening session, if any, and stops listening to presences.
 */
export function endSessions(): void {
	stopListening?.();
	stopListening = undefined;
	follower?.stop();
	follower = undefined;
}

/**
 * @description Whether you are listening along with someone right now.
 * @param userId The user.
 * @returns Whether you follow them.
 */
export function isFollowing(userId: string | undefined): boolean {
	return Boolean(userId && follower?.following === userId);
}

/**
 * @description Starts listening along with someone, or stops when you already are.
 * @param userId The user.
 * @param activity Their Spotify activity.
 * @returns Whether anything started.
 */
export function toggleListening(userId: string, activity: HostActivity): boolean {
	follower ??= createSession();

	if (!follower) {
		toasts.show({ title: addon.name, content: messages.NOT_DETECTED });

		return false;
	}

	if (follower.following === userId) {
		follower.stop();
		toasts.show({ title: addon.name, content: messages.STOPPED_LISTENING });

		return false;
	}

	void follower.start(userId, activity, {
		onStopped: (reason) => toasts.show({ title: addon.name, content: stoppedText(reason) }),
	});

	return true;
}

export default { endSessions, isFollowing, toggleListening, spotifyActivityOf };
