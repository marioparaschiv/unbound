import type{ ReactNode } from "react";
import type { ViewStyle } from "react-native";

type SectionProps = {
	children?: React.ReactNode,
	style?: ViewStyle;
	margin?: boolean;
	[k: PropertyKey]: any;
}

type RowProps = {
    label: string;
    subLabel?: string;
    onPress?: Fn;
    icon?: ReactNode | null;
    trailing?: ReactNode;
    variant?: string;
    arrow?: boolean;
    start?: boolean;
    end?: boolean;
}

type SwitchRowProps = Omit<RowProps, "trailing" | "arrow"> & {
    value: any;
    onValueChange: Fn;
}

type RowIconProps = {
    // ReactNode includes string | number, etc
    source: ReactNode;
    style?: ViewStyle;
}