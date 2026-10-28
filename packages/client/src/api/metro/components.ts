import type {
	DesignComponentName,
	DesignModule,
	SwitchProps,
	TextFieldProps,
} from '@unbound-app/types/components';
import type { ColorBlockProps, ColorPickerOptions } from '@unbound-app/types/color-picker';
import { DESIGN_COMPONENTS } from '@unbound-app/types/components';
import type { ComponentType, ElementType } from 'react';
import firstOf from '@unbound-app/utils/first-of';
import lazy from '@unbound-app/utils/lazy';
import { createElement } from 'react';

import {
	FallbackCard,
	FallbackHeading,
	FallbackStack,
	FallbackSwitch,
	FallbackText,
} from '~/ui/components/design-fallbacks';
import type { HelpMessageProps } from '~/ui/components/help-message';
import { findByPropsLazy } from '~/api/metro/wrappers';
import { findByName, findByProps } from '~/api/metro';

const designModule: DesignModule = findByPropsLazy('createStyles', 'dismissAlerts', 'ContextMenu');
const designFallbacks = new Map<DesignComponentName, ComponentType<never>>();

/**
 * @description Tells whether a value can be rendered as a React element type: a function or class
 * component, or a `memo`/`forwardRef`/`lazy` object.
 * @param value The value to check.
 * @returns Whether React can render it.
 */
export function isRenderable(
	value:
		| DesignModule[keyof DesignModule]
		| ElementType
		| Record<string, ComponentType<never>>
		| undefined,
): value is ElementType {
	return (
		typeof value === 'function' ||
		(typeof value === 'object' && value !== null && '$$typeof' in value)
	);
}

function isDesignComponent(key: PropertyKey): key is DesignComponentName {
	return typeof key === 'string' && (DESIGN_COMPONENTS as readonly string[]).includes(key);
}

function readDesignModule(key: PropertyKey): DesignModule[keyof DesignModule] | undefined {
	try {
		return Reflect.get(designModule, key);
	} catch {
		return undefined;
	}
}

/**
 * @description Registers the component the design module returns when a Discord build lacks the
 * named one or ships something React can't render.
 * @param name The design component to stand in for.
 * @param component The fallback.
 */
export function registerDesignFallback<K extends DesignComponentName>(
	name: K,
	component: DesignModule[K],
): void {
	designFallbacks.set(name, component as ComponentType<never>);
}

type SearchFieldProps = Omit<TextFieldProps, 'leadingIcon'>;

const designTarget: DesignModule = Object.create(null);

/** Discord's design module, with Unbound's fallbacks standing in for components a build lacks. */
export const Discord: DesignModule = new Proxy(designTarget, {
	get(_, key) {
		const value = readDesignModule(key);

		if (isDesignComponent(key) && !isRenderable(value)) {
			return designFallbacks.get(key) ?? value;
		}

		return value;
	},
	has: (_, key) =>
		readDesignModule(key) !== undefined || (isDesignComponent(key) && designFallbacks.has(key)),
});

/** How each design component resolves on the running Discord build. */
export type DesignComponentAudit = {
	native: DesignComponentName[];
	fallback: DesignComponentName[];
	missing: DesignComponentName[];
};

/**
 * @description Checks every design component the SDK exposes against the running Discord build.
 * @returns The components Discord renders itself, the ones a fallback stands in for, and the ones nothing renders.
 */
export function auditDesignComponents(): DesignComponentAudit {
	const audit: DesignComponentAudit = { native: [], fallback: [], missing: [] };

	for (const name of DESIGN_COMPONENTS) {
		if (isRenderable(readDesignModule(name))) {
			audit.native.push(name);
		} else if (designFallbacks.has(name)) {
			audit.fallback.push(name);
		} else {
			audit.missing.push(name);
		}
	}

	return audit;
}
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
let colorBlock: ComponentType<ColorBlockProps> | undefined;

/**
 * @description Discord's colour picker swatch, or Unbound's own on builds without it, picked on first render.
 * @param props The 0xRRGGBB colour, whether it is selected, a style override and an optional press handler.
 * @returns The swatch element.
 */
export function ColorBlock(props: ColorBlockProps) {
	const component: ComponentType<ColorBlockProps> = (colorBlock ??=
		firstOf(
			() => {
				const found: ComponentType<ColorBlockProps> | undefined = findByName('ColorBlock');

				return isRenderable(found) ? found : undefined;
			},
			() => require('~/ui/components/color-swatch').default,
		) ?? require('~/ui/components/color-swatch').default);

	return createElement(component, props);
}

type ColorPickerOpener = (options: ColorPickerOptions) => void;

let colorPicker: ColorPickerOpener | undefined;

function openHexColorAlert(options: ColorPickerOptions) {
	const HexColorAlert = require('~/ui/components/hex-color-alert').default;
	const key = 'unbound-color-picker';

	Discord.openAlert(
		key,
		createElement(HexColorAlert, { ...options, onClose: () => Discord.dismissAlert(key) }),
	);
}

/**
 * @description Opens Discord's colour picker sheet, or Unbound's hex colour alert on builds without it.
 * @param options The 0xRRGGBB starting colour, suggested `#rrggbb` swatches and the select callback.
 */
export function showColorPicker(options: ColorPickerOptions): void {
	// Only a hit is cached: the sheet's module may not be initialised the first time this runs.
	colorPicker ??= firstOf(() => {
		const found: ColorPickerOpener | undefined =
			findByProps('CUSTOM_COLOR_PICKER_KEY')?.default;

		return typeof found === 'function' ? found : undefined;
	});

	(colorPicker ?? openHexColorAlert)(options);
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
