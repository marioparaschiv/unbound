import { metro } from '@unbound-app/api';

export type MediaShareActions = {
	useMediaShareActions: (...args: unknown[]) => unknown;
};

const byMediaShareActions = metro.filters.byProps('useMediaShareActions');

// Mirrors `find`'s matching, which returns a module's `default` export when only that matches.
function asMediaShareActions(exports: MediaShareActions & { default?: MediaShareActions }) {
	if (byMediaShareActions(exports, 0)) return exports;
	if (exports.default && byMediaShareActions(exports.default, 0)) return exports.default;
}

/**
 * @description Passes every copy of the media viewer's share actions to `onLoad`: the loaded ones now, the rest as Discord loads them. The Addon scope removes the load listener when the plugin stops.
 * @param onLoad Receives each module exporting `useMediaShareActions`, once.
 */
export function onMediaShareActions(onLoad: (module: MediaShareActions) => void): void {
	const seen = new Set<MediaShareActions>();

	function load(module: MediaShareActions | undefined) {
		if (!module || seen.has(module)) return;

		seen.add(module);
		onLoad(module);
	}

	const loaded: MediaShareActions[] = metro.find(byMediaShareActions, {
		all: true,
		initialize: false,
	});

	for (const module of loaded) load(module);

	metro.onModuleLoad((exports) => load(asMediaShareActions(exports)));
}
