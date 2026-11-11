import type { StyleProp, ViewStyle } from 'react-native';
import type { ReactElement } from 'react';

import { find, findByFilePath, findByProps } from '~/metro/lookups';
import { byFilePath } from '~/metro/filters';

const ROOT = 'modules/user_settings/appearance/native/';

/** One swatch of Discord's appearance theme picker. Unbound's carry the addon they stand for. */
export type PickerTheme = {
	type: 'standardBackgroundTheme' | 'customBackgroundGradient';
	/** Discord's base theme the swatch and preview draw on. */
	theme: 'light' | 'dark' | 'darker' | 'midnight';
	getName: () => string;
	customThemeSettings?: {
		colors: string[];
		gradientColorStops: number[];
		gradientAngle: number;
		baseMix: number;
	};
	unboundAddonId: string;
};

/** The props Discord's `ThemePicker` reads, as seen on the App Theme screen. */
export type ThemePickerProps = {
	mobileThemes: PickerTheme[];
	defaultIndex: number;
	isPreview: boolean;
	isSynced: boolean;
	mode: null;
	themeSelector: 'nitro';
	hasSaveButton: boolean;
	hasOnyxNux: boolean;
	canGoBack: boolean;
	headerTitle: string | null;
	onSaveTheme: (() => void) | null;
	deviceWidth: number;
	deviceHeight: number;
};

/** Discord's App Theme screen: reads Discord's own themes, then renders `ThemePicker` with them. */
type ConnectedThemePicker = (props: Partial<ThemePickerProps>) => ReactElement<ThemePickerProps>;

/** `handleSaveTheme(theme, analyticsLocations, isSynced)`, which `ThemePicker` calls on save. */
type ThemeUtilsModule = {
	handleSaveTheme: (theme: PickerTheme, locations: string[], isSynced: boolean) => void;
};

const Settings = findByProps('SETTING_RENDERER_CONFIG');
const PickerScreen = findByFilePath(`${ROOT}SettingsAppearanceThemePickerScreen.tsx`);

/** Discord's theme save helpers; the Design page intercepts `handleSaveTheme` for Unbound's swatches. */
export const ThemeUtils: ThemeUtilsModule = find(
	byFilePath(`${ROOT}UserSettingsAppearanceThemeUtils.tsx`),
);

/** Reports the swatch the carousel settled on; the carousel debounces it by 180 ms while it scrolls. */
export type ThemeSelected = (index: number) => void;

type CarouselProps = {
	themes: PickerTheme[];
	currentThemeIndex: number;
	onThemeSelected: ThemeSelected;
};

type CarouselModule = { default: (props: CarouselProps) => ReactElement | null };

/** A lodash debounced function: callable, with its pending call cancellable and flushable. */
type Debounced = ThemeSelected & { cancel: () => void; flush: () => void };

type LodashModule = { debounce: (fn: ThemeSelected, wait: number) => Debounced };

/** The lodash the carousel debounces `onThemeSelected` with, reading `debounce` off it when it first renders. */
export const Lodash: LodashModule = findByProps('debounce', 'throttle', 'memoize');

/** The picker's swatch carousel; `currentThemeIndex` is the swatch it previews. */
export const Carousel: CarouselModule = find(
	byFilePath(`${ROOT}components/SettingsAppearanceThemeCarousel.tsx`),
);

type SelectorItemProps = { themePreset: PickerTheme; isSelected: boolean };

type SelectorItemModule = { default: (props: SelectorItemProps) => ReactElement };

/** One swatch of the carousel: its background, as `{ item }`, inside the selection ring. */
export const SelectorItem: SelectorItemModule = find(
	byFilePath(`${ROOT}components/SettingsAppearanceThemeSelectorItem.tsx`),
);

type ChannelListPreviewProps = { themes: PickerTheme[]; themeIndex: number };

type ChannelListPreviewModule = { default: (props: ChannelListPreviewProps) => ReactElement };

/** The picker's preview: a backdrop view holding its gradient, the mock "Messages" list and the Nitro upsell. */
export const ChannelListPreview: ChannelListPreviewModule = find(
	byFilePath(`${ROOT}components/SettingsAppearanceChannelList.tsx`),
);

type SwatchGradientProps = {
	customTheme: PickerTheme;
	mix: boolean;
	componentStyles?: StyleProp<ViewStyle>;
};

type GradientModule = {
	/** Draws a gradient swatch; with `mix` it blends the colours 20% towards black, or 50% towards white on light. */
	CustomThemedGradient: (props: SwatchGradientProps) => ReactElement | null;
};

/** Discord's gradient views, among them the one a gradient swatch draws with. */
export const Gradients: GradientModule = find(
	byFilePath('modules/client_themes/native/ThemedGradient.tsx'),
);

/** One colour stop of the backdrop Discord's picker draws behind its preview. */
type BackdropStop = { hex: string; stop: number };

/** A swatch as the picker's backdrop draws it, padded to Discord's maximum number of stops. */
export type BackdropTheme = { colors: BackdropStop[] };

type BackdropModule = {
	/** Dims each gradient swatch's colours towards black, or white on light, by the two opacities. */
	convertThemesToAnimatedThemes: (
		themes: PickerTheme[],
		darkOpacity?: number,
		lightOpacity?: number,
	) => BackdropTheme[];
};

/** Converts the picker's swatches into the backdrop behind its preview. */
export const Backdrop: BackdropModule = findByProps('convertThemesToAnimatedThemes');

/**
 * @description Loads Discord's App Theme screen. Discord loads its modules only when the screen opens,
 * so resolving the route's component loads them first.
 * @returns The connected picker screen, or `undefined` when this Discord build has none.
 */
export function loadThemePicker(): ConnectedThemePicker | undefined {
	Settings.SETTING_RENDERER_CONFIG?.APPEARANCE_THEME_PICKER?.screen?.getComponent?.();

	return PickerScreen.default;
}
