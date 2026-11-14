// Image imports in a plugin. `ubd build` ships the file and the import evaluates to the image's registered
// asset id, which `<Image source={id}>` and Discord's icon props take.

declare module '*.png' {
	/** The image's asset id. */
	const id: number;

	export default id;
}

declare module '*.jpg' {
	/** The image's asset id. */
	const id: number;

	export default id;
}

declare module '*.jpeg' {
	/** The image's asset id. */
	const id: number;

	export default id;
}

declare module '*.webp' {
	/** The image's asset id. */
	const id: number;

	export default id;
}

declare module '*.gif' {
	/** The image's asset id. */
	const id: number;

	export default id;
}

declare module '*.svg' {
	import type { DiscordIconProps } from '@unbound-app/api/global';
	import type { StyleProp, ViewStyle } from 'react-native';
	import type { ComponentType } from 'react';

	/** An imported SVG's props: Discord's icon `size` and `color`, which `currentColor` draws, or an explicit `width` and `height`. */
	export type SvgIconProps = DiscordIconProps & {
		width?: number | string;
		height?: number | string;
		fill?: string;
		stroke?: string;
		opacity?: number;
		style?: StyleProp<ViewStyle>;
	};

	/** The SVG as an icon component, drawn with Discord's `react-native-svg`; pass it as `IconComponent={Star}` or `icon={<Star />}`. */
	const Component: ComponentType<SvgIconProps>;

	export default Component;
}
