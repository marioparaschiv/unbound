import type { GestureResponderEvent, ImageStyle, TextStyle, ViewProps, ViewStyle } from 'react-native';
import type { ThemeColorsLiterals } from '@typings/discord/constants';
import type { SemanticColors } from '@typings/discord/theming';
import type { PropsWithChildren, ReactElement } from 'react';

export interface ButtonColors {
	BRAND: 'brand';
	RED: 'red';
	GREEN: 'green';
	PRIMARY: 'primary';
	TRANSPARENT: 'transparent';
	GREY: 'grey';
	LIGHTGREY: 'lightgrey';
	WHITE: 'white';
	LINK: 'link';
}

export interface ButtonLooks {
	FILLED: 'filled';
	LINK: 'link';
	OUTLINED: 'outlined';
}

export interface ButtonSizes {
	XSMALL: 'xsmall';
	SMALL: 'small';
	MEDIUM: 'medium';
	LARGE: 'large';
}

export type Borders<T extends PropertyKey = keyof ThemeColorsLiterals> = T extends `BORDER_${infer K}` ? Lowercase<K> : never;
export type Shadows<T extends PropertyKey = keyof ThemeColorsLiterals> = T extends `SHADOW_${infer K}` ? Lowercase<K> : never;

export type CardVariants = 'primary' | 'secondary' | 'transparent';
export type CardShadows = 'none' | 'border' | 'high' | 'ledge' | 'low' | 'medium';
export type CardBorders = Borders;

export interface CardProps extends PropsWithChildren, ViewProps {
	onPress?: ((event: GestureResponderEvent) => void) | undefined;
	variant?: CardVariants | AnyString;
	shadow?: CardShadows | AnyString;
	border?: CardBorders | AnyString;
}

export type TextColors = ThemeColorsLiterals[keyof ThemeColorsLiterals];
export interface TextProps extends PropsWithChildren, ViewProps {
	color?: TextColors | AnyString;
	variant?: TextVariants | AnyString;
}

export type TextVariants = |
	'heading-sm/normal' |
	'heading-sm/medium' |
	'heading-sm/semibold' |
	'heading-sm/bold' |
	'heading-sm/extrabold' |
	'heading-md/normal' |
	'heading-md/medium' |
	'heading-md/semibold' |
	'heading-md/bold' |
	'heading-md/extrabold' |
	'heading-lg/normal' |
	'heading-lg/medium' |
	'heading-lg/semibold' |
	'heading-lg/bold' |
	'heading-lg/extrabold' |
	'heading-xl/normal' |
	'heading-xl/medium' |
	'heading-xl/semibold' |
	'heading-xl/bold' |
	'heading-xl/extrabold' |
	'heading-xxl/normal' |
	'heading-xxl/medium' |
	'heading-xxl/semibold' |
	'heading-xxl/bold' |
	'heading-xxl/extrabold' |
	'eyebrow' |
	'heading-deprecated-12/normal' |
	'heading-deprecated-12/medium' |
	'heading-deprecated-12/semibold' |
	'heading-deprecated-12/bold' |
	'heading-deprecated-12/extrabold' |
	'redesign/heading-18/bold' |
	'text-xxs/normal' |
	'text-xxs/medium' |
	'text-xxs/semibold' |
	'text-xxs/bold' |
	'text-xs/normal' |
	'text-xs/medium' |
	'text-xs/semibold' |
	'text-xs/bold' |
	'text-sm/normal' |
	'text-sm/medium' |
	'text-sm/semibold' |
	'text-sm/bold' |
	'text-md/normal' |
	'text-md/medium' |
	'text-md/semibold' |
	'text-md/bold' |
	'text-lg/normal' |
	'text-lg/medium' |
	'text-lg/semibold' |
	'text-lg/bold' |
	'redesign/message-preview/normal' |
	'redesign/message-preview/medium' |
	'redesign/message-preview/semibold' |
	'redesign/message-preview/bold' |
	'redesign/channel-title/normal' |
	'redesign/channel-title/medium' |
	'redesign/channel-title/semibold' |
	'redesign/channel-title/bold' |
	'display-sm' |
	'display-md' |
	'display-lg' |
	'code';

export interface ComponentsModule {
	createStyles: <T extends Record<string, ViewStyle | TextStyle | ImageStyle | SemanticColors | Record<PropertyKey, any>>>(style: T) => Fn<{
		[P in keyof T]:
		T[P] extends ImageStyle ? ImageStyle :
		T[P] extends ViewStyle ? ViewStyle :
		T[P] extends TextStyle ? TextStyle :
		T[P] extends SemanticColors ? SemanticColors :
		never;
	}>;

	Text: (props: TextProps) => ReactElement;
	Card: (props: CardProps) => ReactElement;

	[key: PropertyKey]: any;
}