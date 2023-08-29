import type{ ReactNode } from "react";
import type { ImageSourcePropType, ViewStyle } from "react-native";

type SectionProps = {
    title?: string;
	children?: React.ReactNode,
	style?: ViewStyle;
	margin?: boolean;
}

type RowProps = {
    label: string;
    subLabel?: string;
    onPress?: Fn;
    icon?: ImageSourcePropType 
        | ReactNode 
        | null;
    trailing?: ReactNode;
    variant?: string;
    arrow?: boolean;
    start?: boolean;
    end?: boolean;
}

type SwitchRowProps = Omit<RowProps, "arrow"> & {
    value: any;
    onValueChange: Fn;
}

type RowIconProps = {
    source?: ImageSourcePropType 
        | ReactNode 
        | null;
    style?: ViewStyle;
}