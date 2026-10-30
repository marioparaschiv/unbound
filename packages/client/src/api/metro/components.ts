import type { DesignModule } from '@unbound-app/types/components';
import type { ComponentProps, ComponentType } from 'react';
import firstOf from '@unbound-app/utils/first-of';
import lazy from '@unbound-app/utils/lazy';
import { createElement } from 'react';

import {
	FallbackCard,
	FallbackHeading,
	FallbackStack,
	FallbackSwitch,
	FallbackText,
} from '~/api/metro/fallbacks/design-fallbacks';
import { Discord, isRenderable, registerDesignFallback } from '~/api/metro/design';
import type { HelpMessageProps } from '~/api/metro/fallbacks/help-message';
import { findByPropsLazy } from '~/api/metro/wrappers';
import { findByName } from '~/api/metro/search';

type SwitchProps = ComponentProps<DesignModule['FormSwitch']>;
type SearchFieldProps = ComponentProps<DesignModule['SearchField']>;

export {
	Discord,
	auditDesignComponents,
	isRenderable,
	registerDesignFallback,
	type DesignComponentAudit,
} from '~/api/metro/design';
export type { DesignComponentName, DesignModule } from '@unbound-app/types/components';
export { DESIGN_COMPONENTS } from '@unbound-app/types/components';
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
			() => findByName('HelpMessage'),
			() => require('~/api/metro/fallbacks/help-message').default,
		) ?? require('~/api/metro/fallbacks/help-message').default);

	return createElement(component, props);
}

export const HelpMessageTypes = lazy(
	() =>
		firstOf(
			() => require('~/api/metro').findByProps('HelpMessageTypes')?.HelpMessageTypes,
			() => require('~/api/metro/fallbacks/help-message').HelpMessageTypes,
		) ?? {},
);
let switchComponent: ComponentType<SwitchProps> | undefined;

/**
 * @description Discord's switch, or its form switch, or React Native's, picked on first render.
 * @param props The switch props.
 * @returns The switch element.
 */
export function Switch(props: SwitchProps) {
	const component: ComponentType<SwitchProps> = (switchComponent ??=
		firstOf(
			() => {
				const found: ComponentType<SwitchProps> | undefined = findByName('Switch');

				return isRenderable(found) ? found : undefined;
			},
			() => Discord.FormSwitch,
		) ?? FallbackSwitch);

	return createElement(component, props);
}
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

/**
 * @description Unbound's stand-in for Discord's `SearchField`, which some builds no longer ship: Discord's
 * round text field with the same props.
 * @param props The search field props.
 * @returns The search field element.
 */
function FallbackSearchField(props: SearchFieldProps) {
	return createElement(Discord.TextField, { isRound: true, ...props });
}

registerDesignFallback('SearchField', FallbackSearchField);
registerDesignFallback('Text', FallbackText);
registerDesignFallback('Heading', FallbackHeading);
registerDesignFallback('FormSwitch', FallbackSwitch);
registerDesignFallback('Stack', FallbackStack);
registerDesignFallback('Card', FallbackCard);
