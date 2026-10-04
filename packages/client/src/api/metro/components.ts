import type { DesignModule, SwitchProps } from '@unbound-app/types/components';
import type { ComponentType } from 'react';

import { findByPropsLazy, findByNameLazy } from '~/api/metro/wrappers';
import { findByName } from '~/api/metro';

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
export const Switch: ComponentType<SwitchProps> = findByName('Switch');
export const Forms = findByPropsLazy('FormSliderRow');
