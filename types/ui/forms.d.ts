import type { ImageSourcePropType, ImageStyle, ViewStyle } from 'react-native';
import type { ComponentType, ReactNode } from 'react';

type SectionProps = {
	title?: string;
	children?: ReactNode,
	style?: ViewStyle;
	margin?: boolean;
};

type SvgIconProps = {
	size?: number;
	style?: ImageStyle;
	icon?: ComponentType<any>;
};

type IconProps = {
	source: ImageSourcePropType;
	size?: number;
	style?: ImageStyle;
	defaultSource?: number;
};

type RowProps = {
	label: string;
	subLabel?: string;
	onPress?: Fn;
	icon?: ImageSourcePropType | ReactNode | null;
	trailing?: ReactNode;
	variant?: string;
	arrow?: boolean;
	start?: boolean;
	end?: boolean;
};

type SwitchProps = {
	value: any;
	onValueChange: Fn;
};

type FormSwitchProps = AnyProps<SwitchProps>;

type SwitchRowProps = Omit<RowProps, 'arrow'> & SwitchProps;

type RowIconProps = {
	source?: ImageSourcePropType | ReactNode | null;
	style?: ViewStyle;
	size?: 'small' | 'medium' | 'large';
};