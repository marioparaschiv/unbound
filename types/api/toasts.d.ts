import type { ImageSourcePropType } from "react-native";

export interface ToastOptions {
	title: string;
	content: string;
	duration?: number;
	onTimeout?: Fn;
	icon?: string | number | ImageSourcePropType;
	id?: any;
}

export interface InternalToastOptions extends ToastOptions {
	closing?: boolean;
	date?: number;
}