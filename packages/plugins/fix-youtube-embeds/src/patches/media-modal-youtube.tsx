import { findRenderTarget } from '@unbound-plugins/shared/react/render-target';
import ensureModules from '@unbound-plugins/shared/metro/ensure-modules';
import { recordSkip } from '@unbound-plugins/shared/lifecycle/health';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';
import { patcher } from '@unbound-app/api';

import { loadStatus, ViewerContext, type ViewerState } from '~/viewer-state';
import { PLUGIN_NAME, YOUTUBE_MODULE, YOUTUBE_PATH } from '~/constants';
import { MediaModalYoutube } from '~/modules';

type YoutubeProps = {
	visible?: unknown;
	onToggleOverlay?: unknown;
};

function toViewerState(props: YoutubeProps | undefined): ViewerState {
	const onToggleOverlay = props?.onToggleOverlay;

	return {
		visible: props?.visible !== false,
		...(typeof onToggleOverlay === 'function'
			? { onToggleOverlay: onToggleOverlay as ViewerState['onToggleOverlay'] }
			: {}),
	};
}

/**
 * @description Passes the media viewer's `visible` and `onToggleOverlay` props from `MediaModalYoutube` down to the fallback player it may render, once the module loads.
 * @returns A function that stops waiting for the module and removes the patch.
 */
export function patchMediaModalYoutube(): () => void {
	if (!ensureModules(`${PLUGIN_NAME}: ${YOUTUBE_MODULE}`, { MediaModalYoutube })) {
		return () => undefined;
	}

	return whenLoaded<AnyProps>(YOUTUBE_PATH, (module) => {
		const target = findRenderTarget(module);

		if (!target) {
			const reason = `${YOUTUBE_MODULE} has no render function`;

			console.error(`[${PLUGIN_NAME}] Skipped, ${reason}.`);
			recordSkip(reason);

			return;
		}

		const unpatch = patcher.after(target.holder, target.key, ({ args, result }) => (
			<ViewerContext.Provider value={toViewerState(args[0] as YoutubeProps | undefined)}>
				{result}
			</ViewerContext.Provider>
		));
		const unmark = loadStatus.markLoaded(YOUTUBE_MODULE);

		return () => {
			unmark();
			unpatch();
		};
	});
}

export default patchMediaModalYoutube;
