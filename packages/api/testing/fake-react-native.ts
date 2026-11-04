import type {
	ActivityIndicatorProps,
	FlatListProps,
	ImageProps,
	ModalProps,
	PressableProps,
	ScrollViewProps,
	SwitchProps,
	TextInputProps,
	TextProps,
	TouchableOpacityProps,
	ViewProps,
} from 'react-native';
import { createElement, Fragment, type ReactNode } from 'react';

import type { ReactValue } from './react-value';
import type { FakeModule } from './fake-metro';

/** The props of each host component the fake `react-native` renders, by name, for `find('Text')`. */
export type HostPropsByName = {
	View: ViewProps;
	Text: TextProps;
	Image: ImageProps;
	ImageBackground: ImageProps;
	ScrollView: ScrollViewProps;
	Pressable: PressableProps;
	TouchableOpacity: TouchableOpacityProps;
	TouchableHighlight: TouchableOpacityProps;
	TouchableWithoutFeedback: TouchableOpacityProps;
	TextInput: TextInputProps;
	Switch: SwitchProps;
	ActivityIndicator: ActivityIndicatorProps;
	Modal: ModalProps;
	SafeAreaView: ViewProps;
	KeyboardAvoidingView: ViewProps;
	FlatList: Omit<FlatListProps<unknown>, 'data' | 'renderItem'>;
	SvgXml: {
		xml: string;
		asset: string;
		color?: string;
		width?: number | string;
		height?: number | string;
	};
};

/** A host component's name. */
export type HostName = keyof HostPropsByName;

const HOSTS = [
	'View',
	'Text',
	'Image',
	'ImageBackground',
	'ScrollView',
	'Pressable',
	'TouchableOpacity',
	'TouchableHighlight',
	'TouchableWithoutFeedback',
	'TextInput',
	'Switch',
	'ActivityIndicator',
	'Modal',
	'SafeAreaView',
	'KeyboardAvoidingView',
] as const satisfies readonly HostName[];

type Style = FakeModule;

type StyleValue = Style | false | null | undefined | StyleValue[];

function flattenStyle(style: StyleValue): Style {
	if (Array.isArray(style)) {
		return Object.assign({}, ...style.map(flattenStyle));
	}

	return style ? { ...style } : {};
}

type ListItemInfo = { item: ReactValue; index: number };

type PlatformChoices<T> = { ios?: T; android?: T; native?: T; default?: T };

type ListProps = {
	data?: readonly ReactValue[] | null;
	renderItem?: (info: ListItemInfo) => ReactNode;
	keyExtractor?: (item: ReactValue, index: number) => string;
	ListHeaderComponent?: ReactNode;
	ListFooterComponent?: ReactNode;
	ListEmptyComponent?: ReactNode;
};

// A list renders every item at once, so `find` reaches each row.
function FlatList({ data, renderItem, keyExtractor, ...rest }: ListProps) {
	const items = data ?? [];
	const rows = items.map((item, index) =>
		createElement(
			Fragment,
			{ key: keyExtractor?.(item, index) ?? String(index) },
			renderItem?.({ item, index }),
		),
	);

	return createElement(
		'FlatList',
		rest,
		rest.ListHeaderComponent,
		items.length ? rows : rest.ListEmptyComponent,
		rest.ListFooterComponent,
	);
}

/**
 * @description Creates the `react-native` a test imports: each primitive a host component named after itself,
 * and the plain modules (`StyleSheet`, `Platform`, `Dimensions`) plugins read at import.
 * @param os The platform `Platform.OS` reports.
 * @returns The module's exports.
 */
export function createFakeReactNative(os: 'ios' | 'android' = 'ios') {
	const hosts = Object.fromEntries(HOSTS.map((name) => [name, name]));
	const window = { width: 390, height: 844, scale: 3, fontScale: 1 };

	return {
		...hosts,
		FlatList,
		StyleSheet: {
			create: <T>(styles: T) => styles,
			flatten: flattenStyle,
			compose: (left: StyleValue, right: StyleValue) => [left, right],
			hairlineWidth: 1 / 3,
			absoluteFill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
			absoluteFillObject: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
		},
		Platform: {
			OS: os,
			Version: os === 'ios' ? '18.0' : 35,
			select: <T>(choices: PlatformChoices<T>) =>
				choices[os] ?? choices.native ?? choices.default,
		},
		Dimensions: {
			get: () => window,
			addEventListener: () => ({ remove: () => {} }),
		},
		PixelRatio: { get: () => window.scale, getFontScale: () => window.fontScale },
		Appearance: {
			getColorScheme: () => 'dark',
			addChangeListener: () => ({ remove: () => {} }),
		},
		Linking: { openURL: async () => {}, canOpenURL: async () => true },
		Keyboard: { dismiss: () => {}, addListener: () => ({ remove: () => {} }) },
		useWindowDimensions: () => window,
		useColorScheme: () => 'dark',
	};
}
