import type { DiscordFunction } from '@unbound-app/types/components';

import { byFilePath, byName } from '~/api/metro/filters';
import type { onModuleLoaded } from '~/api/metro/wait';

type OverviewModule = { default: DiscordFunction };

type Wait = typeof onModuleLoaded;

const OVERVIEW_PATH = 'modules/user_settings/overview/native/SettingsOverviewScreen.tsx';

function isOverviewModule(value: MetroExport): value is OverviewModule {
	return typeof value === 'object' && value !== null && typeof value.default === 'function';
}

/**
 * @description Calls `onLoad` once with Discord's settings overview module as Discord loads it, matched by its
 * name or, when Discord ships it anonymous, by its Metro path.
 * @param wait Waits for a Metro module without loading it.
 * @param onLoad Receives the overview module.
 * @returns A function that stops waiting.
 */
function waitForSettingsOverview(
	wait: Wait,
	onLoad: (overview: OverviewModule) => void,
): () => void {
	const stops: Array<() => void> = [];
	let found = false;

	function settle(mdl: MetroExport) {
		if (found || !isOverviewModule(mdl)) return;

		found = true;
		stop();
		onLoad(mdl);
	}

	function stop() {
		for (const stopWaiting of stops) stopWaiting();
	}

	stops.push(wait(byName('SettingsOverviewScreen'), settle, { interop: false }));

	// A wait passes a module that has already loaded at once, so the overview may be settled already.
	if (!found) {
		stops.push(wait(byFilePath(OVERVIEW_PATH), settle, { interop: false }));
	}

	return stop;
}

export default waitForSettingsOverview;
