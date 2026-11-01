import type { DesignModule } from '@unbound-app/types/components';
import type { ComponentProps, ComponentType } from 'react';
import firstOf from '@unbound-app/utils/first-of';
import lazy from '@unbound-app/utils/lazy';
import { createElement } from 'react';

import { Discord, isRenderable, registerDesignFallback } from '~/metro/design';
import type { HelpMessageProps } from '~/metro/fallbacks/help-message';
import FallbackHeading from '~/metro/fallbacks/fallback-heading';
import FallbackSwitch from '~/metro/fallbacks/fallback-switch';
import FallbackStack from '~/metro/fallbacks/fallback-stack';
import FallbackCard from '~/metro/fallbacks/fallback-card';
import FallbackText from '~/metro/fallbacks/fallback-text';
import { findByName, findByProps } from '~/metro/search';
import { findByPropsLazy } from '~/metro/wrappers';

/** The props of Discord's `FormSwitch`, which the switch fallback accepts. */
type SwitchProps = ComponentProps<DesignModule['FormSwitch']>;
type SearchFieldProps = ComponentProps<DesignModule['SearchField']>;

export {
	Discord,
	auditDesignComponents,
	isRenderable,
	registerDesignFallback,
	type DesignComponentAudit,
} from '~/metro/design';
export type { DesignComponentName, DesignModule } from '@unbound-app/types/components';
export { DESIGN_COMPONENTS } from '@unbound-app/types/components';
/** Discord's blur backdrop components, with `BackgroundBlurFill`; found on first access. */
export const BackdropFilters = findByPropsLazy('BackgroundBlurFill');
/** Discord's safe area components, with `SafeAreaPaddingView`; found on first access. */
export const SafeArea = findByPropsLazy('SafeAreaPaddingView');
/** Discord's portal components, `Portal` and `PortalHost`, for rendering outside the tree; found on first access. */
export const Portal = findByPropsLazy('PortalHost', 'Portal');
/** Discord's media viewer module, with `openMediaModal`; found on first access. */
export const Media = findByPropsLazy('openMediaModal');
/** Discord's video player module, with `VideoComponent` and `createVideoControls`; found on first access. */
export const Video = findByPropsLazy('VideoComponent', 'createVideoControls');
/** Discord's copy of Shopify's `FlashList` module; found on first access. */
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
			() => require('~/metro/fallbacks/help-message').default,
		) ?? require('~/metro/fallbacks/help-message').default);

	return createElement(component, props);
}

/** The `messageType` values for `HelpMessage`, from Discord or else Unbound's fallback; `{}` when neither loads. */
export const HelpMessageTypes = lazy(
	() =>
		firstOf(
			() => findByProps('HelpMessageTypes')?.HelpMessageTypes,
			() => require('~/metro/fallbacks/help-message').HelpMessageTypes,
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
/** Discord's legacy form components, such as `FormRow` and `FormSection`; `{}` on builds without them. */
export const Forms = lazy<any>(
	() =>
		firstOf(
			() => findByProps('FormSliderRow'),
			() => findByProps('FormSection', 'FormRow'),
		) ?? {},
);
/** Discord's avatar module, with `Avatar` and `AvatarSizes`; found on first access. */
export const Avatars = findByPropsLazy('AvatarSizes', 'Avatar');
/** Discord's stacked avatar components, `AvatarPile` and `AvatarDuoPile`; found on first access. */
export const AvatarPiles = findByPropsLazy('AvatarPile', 'AvatarDuoPile');
/** Discord's default avatar images, `DEFAULT_AVATARS` and `DEFAULT_AVATARS_SMALL`; found on first access. */
export const DefaultAvatars = findByPropsLazy('DEFAULT_AVATARS', 'DEFAULT_AVATARS_SMALL');
/** Discord's bottom sheet components, with `ActionSheet` and `BottomSheetTitleHeader`; found on first access. */
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
