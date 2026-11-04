import { patcher } from '@unbound-app/api';

import { ViewerContext, type ViewerState } from '~/youtube-embeds/viewer-state';
import { MediaModalYoutube } from '~/youtube-embeds/modules';

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
 * @description Passes the media viewer's `visible` and `onToggleOverlay` props from `MediaModalYoutube` down to the fallback player it may render.
 */
export function patchMediaModalYoutube(): void {
	patcher.react.after(MediaModalYoutube, 'default', ({ props, result }) => (
		<ViewerContext.Provider value={toViewerState(props as YoutubeProps | undefined)}>
			{result}
		</ViewerContext.Provider>
	));
}
