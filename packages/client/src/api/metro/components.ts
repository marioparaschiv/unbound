import type { DesignModule, SwitchProps } from '@unbound-app/types/components';
import firstOf from '@unbound-app/utils/first-of';
import lazy from '@unbound-app/utils/lazy';
import type { ComponentType } from 'react';
import { createElement } from 'react';

import type { HelpMessageProps } from '~/ui/components/help-message';
import { findByPropsLazy } from '~/api/metro/wrappers';
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
let helpMessage: ComponentType<HelpMessageProps> | undefined;

/**
 * @description Discord's help message, or Unbound's own on Discord builds that no longer ship one, picked on first render.
 * @param props The message, its type, text styling, corner radius and an optional trailing button.
 * @returns The help message element.
 */
export function HelpMessage(props: HelpMessageProps) {
	const component: ComponentType<HelpMessageProps> = (helpMessage ??=
		firstOf(
			() => require('~/api/metro').findByName('HelpMessage'),
			() => require('~/ui/components/help-message').default,
		) ?? require('~/ui/components/help-message').default);

	return createElement(component, props);
}

export const HelpMessageTypes = lazy(
	() =>
		firstOf(
			() => require('~/api/metro').findByProps('HelpMessageTypes')?.HelpMessageTypes,
			() => require('~/ui/components/help-message').HelpMessageTypes,
		) ?? {},
);
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
