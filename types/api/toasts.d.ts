import { ButtonColors, ButtonLooks, ButtonSizes } from '@typings/discord';
import type { ImageSourcePropType } from 'react-native';

export interface ToastButton {
	color?: ButtonColors[keyof ButtonColors];
	variant?: ButtonLooks[keyof ButtonLooks];
	size?: ButtonSizes[keyof ButtonSizes];
	iconPosition: 'start' | 'end';
	content: string;
	icon?: number;
	onPress: Fn;
}

export interface ToastOptions {
	title: string;
	content: string;
	duration?: number;
	onTimeout?: Fn;
	icon?: string | number | ImageSourcePropType;
	id?: any;
	buttons?: ToastButton[];
}

export interface InternalToastOptions extends ToastOptions {
	closing?: boolean;
	date?: number;
}