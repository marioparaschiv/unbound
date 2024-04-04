import type { ButtonColors, ButtonLooks, ButtonSizes } from '@typings/discord';
import type { ImageSourcePropType } from 'react-native';

export interface ToastButton {
	color?: ButtonColors[keyof ButtonColors];
	variant?: ButtonLooks[keyof ButtonLooks] | 'primary' | 'secondary' | 'tertiary';
	size?: ButtonSizes[keyof ButtonSizes] | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
	iconPosition?: 'start' | 'end';
	content: string;
	icon?: number;
	onPress: Fn;
}

export type ToastOptions = _ToastOptions | PartialBy<_ToastOptions, 'title'> | PartialBy<_ToastOptions, 'content'>;

interface _ToastOptions {
	title: string;
	content: string;
	duration?: number;
	onTimeout?: Fn;
	icon?: string | number | ImageSourcePropType;
	id?: any;
	buttons?: ToastButton[];
	tintedIcon?: boolean;
}

export type InternalToastOptions = ToastOptions & {
	closing?: boolean;
	date?: number;
};