// Image imports, as @unbound-app/api's ambient image-modules.d.ts declares them.

declare module '*.png' {
	/** The image's asset id. */
	const id: number;

	export default id;
}

declare module '*.svg' {
	import type { ComponentType } from 'react';

	type SvgImageProps = { width?: number | string; height?: number | string; color?: string };

	/** The SVG, drawn with Discord's `react-native-svg`. */
	const Component: ComponentType<SvgImageProps>;

	export default Component;
}

declare module '*.svg?asset' {
	/** The SVG rasterized to PNG, as a registered asset id. */
	const id: number;

	export default id;
}
