import type { ThemeColors } from '@typings/discord/constants';


export type SemanticColors = {
	[P in keyof ThemeColors]: Record<PropertyKey, any>;
};

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
	resolveSemanticColor: (theme: string, ref: ThemingModule['colors'][keyof ThemingModule['colors']]) => string;
	adjustColorSaturation: Fn;
	adjustColorContrast: Fn;
}

export interface ThemingModule {
	themes: Record<PropertyKey, string>;
	colors: SemanticColors;
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