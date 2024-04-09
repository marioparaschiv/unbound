import type { ReactNode } from 'react';
import type { ImageSourcePropType, ViewStyle } from 'react-native';

type SectionProps = {
	title?: string;
	children?: React.ReactNode,
	style?: ViewStyle;
	margin?: boolean;
};

type IconProps = {
	source: ImageSourcePropType;
	size?: number;
	style?: ViewStyle;
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