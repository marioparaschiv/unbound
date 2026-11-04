import { createContext } from 'react';

import { createLoadStatus } from '~/load-status';
import { EMBED_ERROR_MODULE, YOUTUBE_MODULE } from '~/constants';

export type ViewerState = {
	visible: boolean;
	onToggleOverlay?: (...args: unknown[]) => unknown;
};

export const ViewerContext = createContext<ViewerState>({ visible: true });

export const loadStatus = createLoadStatus([YOUTUBE_MODULE, EMBED_ERROR_MODULE]);
