import { flux, metro, storage } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { buildActivity, type Activity, type PresenceOptions } from '~/lib/activity';

const SOCKET_ID = 'unbound.custom-rpc';

type AssetManager = {
	fetchAssetIds(applicationId: string, keys: string[]): Promise<(string | undefined)[]>;
};

declare module '@unbound-app/api/flux' {
	interface FluxActions {
		LOCAL_ACTIVITY_UPDATE: { activity: Activity | null; socketId: string };
	}
}

function dispatchActivity(activity: Activity | null): void {
	void flux.dispatch({ type: 'LOCAL_ACTIVITY_UPDATE', activity, socketId: SOCKET_ID });
}

async function resolveImage(image: string): Promise<string | undefined> {
	const assets: AssetManager | undefined = metro.findByProps('fetchAssetIds', 'getAssetIds');

	if (!assets) return;

	try {
		return (await assets.fetchAssetIds(settings.appId.trim() || '0', [image]))[0] ?? undefined;
	} catch (error) {
		logger.error(`Failed to resolve the image ${image}:`, error);

		return undefined;
	}
}

async function refresh(): Promise<void> {
	try {
		const activity = await buildActivity(settings as PresenceOptions, new Date(), resolveImage);

		dispatchActivity(activity ?? null);
	} catch (error) {
		logger.error('Failed to set the custom Rich Presence:', error);
	}
}

/**
 * @description Shows the Rich Presence the settings describe, and shows it again whenever a setting changes.
 * Sends `LOCAL_ACTIVITY_UPDATE`; the Addon scope removes the settings listener.
 */
export function startPresence(): void {
	storage.onChange(
		({ store }) => store === addon.id,
		() => void refresh(),
	);
	void refresh();
}

/**
 * @description Clears the Rich Presence.
 */
export function stopPresence(): void {
	dispatchActivity(null);
}
