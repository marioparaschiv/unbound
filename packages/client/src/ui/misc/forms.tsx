import type { ComponentType } from 'react';
import { View, Image } from 'react-native';

import { Discord } from '~/api/metro/components';

import useStyles from './forms.style';

type TintedIconProps = {
	source: number;
	size?: number;
	style?: any;
};

type TintedSvgIconProps = {
	icon: ComponentType<any>;
	size?: number;
	style?: any;
};

type SectionProps = {
	children: any;
	title?: string;
	style?: any;
	margin?: boolean;
};

/**
 * @description Returns the shared form styles (icon tint, section wrapper, list-end spacing).
 * @returns The resolved styles object.
 */
export function useFormStyles() {
	return useStyles();
}

/**
 * @description Renders an image asset tinted with the interactive-icon theme color.
 */
export function TintedIcon({ source, size = 24, style }: TintedIconProps) {
	const styles = useStyles();
	return (
		<Image source={source} style={[{ width: size, height: size }, styles.iconTint, style]} />
	);
}

/**
 * @description Renders an SVG icon component at the given size.
 */
export function TintedSvgIcon({ icon: Icon, size = 24, style }: TintedSvgIconProps) {
	return <Icon width={size} height={size} style={style} />;
}

/**
 * @description Wraps children in a Discord `TableRowGroup` with standard section spacing.
 */
export function Section({ children, title, style, margin = true }: SectionProps) {
	const styles = useStyles();
	return (
		<View style={[margin ? styles.sectionWrapper : null, style]}>
			<Discord.TableRowGroup title={title}>{children}</Discord.TableRowGroup>
		</View>
	);
}

export default { useFormStyles, TintedIcon, TintedSvgIcon, Section };
