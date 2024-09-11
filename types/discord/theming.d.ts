import type { ImageStyle, StyleProp, TextStyle, ViewStyle } from 'react-native';

export type ThemingColors = Record<PropertyKey, Record<PropertyKey, any>>;

export type ShadowResolver = { resolve: (theme: string) => any; };

export type Shadows = Record<PropertyKey, {
	shadowOffset: ShadowResolver;
	shadowColor: ShadowResolver;
	shadowOpacity: ShadowResolver;
	shadowRadius: ShadowResolver;
	elevation: ShadowResolver;
}>;

export interface InternalResolvers {
	isSemanticColor: (...args: any[]) => boolean;
	getSemanticColorName: Fn;
	resolveSemanticColor: (theme: string, ref: Theming['colors'][keyof Theming['colors']]) => string;
	adjustColorSaturation: Fn;
	adjustColorContrast: Fn;
}

export interface Theming {
	themes: Record<PropertyKey, string>;
	colors: ThemingColors;
	unsafe_rawColors: Record<PropertyKey, string>;
	shadows: Shadows;
	internal: InternalResolvers;
	radii: {
		none: number;
		xs: number;
		sm: number;
		md: number;
		lg: number;
		xl: number;
		xxl: number;
		round: number;
	};
	spacing: {
		PX_4: number;
		PX_8: number;
		PX_12: number;
		PX_16: number;
		PX_24: number;
		PX_32: number;
		PX_40: number;
		PX_48: number;
		PX_56: number;
		PX_64: number;
		PX_72: number;
		PX_80: number;
		PX_96: number;
	};

	[key: PropertyKey]: any;
}

export interface StyleSheetModule {
	createStyles: <T extends Record<string, StyleProp<ViewStyle | TextStyle | ImageStyle>>>(style: T) => Fn<T>;

	[key: PropertyKey]: any;
}