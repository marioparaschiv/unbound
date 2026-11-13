// Metro explorer answers for `device.mjs`: the four `metro-*-request` frames, answered by the client's own
// `debugger/metro.dev.ts` over the fake registry in `metro-registry.mjs`. Only `~/metro/search` is swapped
// out, since it reaches React Native; its stand-in runs a factory through `__r` the way `initializeModule` does.
import { plugin } from 'bun';

import './metro-registry.mjs';

plugin({
	name: 'unbound-metro-search',
	setup(build) {
		build.onLoad({ filter: /packages\/client\/src\/metro\/search\.ts$/ }, () => ({
			contents: `export function initializeModule(id) {
				try { __r(id); return true; } catch { return false; }
			}`,
			loader: 'js',
		}));
	},
});

// Imported after the plugin is registered, so the client resolves the stand-in.
const { answerMetro } = await import('../../../packages/client/src/debugger/metro.dev.ts');

/**
 * Answers a Metro request frame, or returns `undefined` for any other frame.
 * @param {{ type: string }} frame A frame from a controller.
 */
export function answerMetroFrame(frame) {
	return frame.type.startsWith('metro-') ? answerMetro(frame) : undefined;
}
