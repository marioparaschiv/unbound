import type { DesignModule } from '@unbound-app/types/components';

import { findByPropsLazy, findByNameLazy } from '~/api/metro/wrappers';

export const Discord: DesignModule = findByPropsLazy(
	'createStyles',
	'dismissAlerts',
	'ContextMenu',
);
export const BackdropFilters = findByPropsLazy('BackgroundBlurFill');
export const SafeArea = findByPropsLazy('SafeAreaPaddingView');
export const Portal = findByPropsLazy('PortalHost', 'Portal');
export const Media = findByPropsLazy('openMediaModal');
export const FlashList = findByPropsLazy('FlashList');
export const HelpMessage = findByNameLazy('HelpMessage');
export const Forms = findByPropsLazy('FormSliderRow');
