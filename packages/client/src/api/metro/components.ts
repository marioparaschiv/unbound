import type { DesignModule, SwitchProps } from '@unbound-app/types/components';
import firstOf from '@unbound-app/utils/first-of';
import lazy from '@unbound-app/utils/lazy';
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
export const Forms = lazy(
	() =>
		firstOf(
			() => require('~/api/metro').findByProps('FormSliderRow'),
			() => require('~/api/metro').findByProps('FormSection', 'FormRow'),
		) ?? {},
);
export const Avatars = findByPropsLazy('AvatarSizes', 'Avatar');
export const AvatarPiles = findByPropsLazy('AvatarPile', 'AvatarDuoPile');
export const DefaultAvatars = findByPropsLazy('DEFAULT_AVATARS', 'DEFAULT_AVATARS_SMALL');
export const BottomSheets = findByPropsLazy('BottomSheetTitleHeader', 'ActionSheet');
