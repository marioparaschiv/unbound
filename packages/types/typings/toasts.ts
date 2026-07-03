import type { ImageSourcePropType } from 'react-native';
import type { ComponentType } from 'react';

import type { Fn } from './utils';

/** A button rendered inside a toast. */
export interface ToastButton {
	variant?: 'primary' | 'secondary' | 'tertiary';
	size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
	iconPosition?: 'start' | 'end';
	content: string;
	icon?: number;
	onPress: Fn;
}

/** Options accepted when showing a toast. */
export interface ToastOptions {
	title?: string | ComponentType;
	content?: string;
	duration?: number;
	onTimeout?: Fn;
	icon?: string | number | ImageSourcePropType;
	id?: string;
	buttons?: ToastButton[];
	tintedIcon?: boolean;
}

/** {@link ToastOptions} enriched with the fields the store tracks internally. */
export interface InternalToastOptions extends ToastOptions {
	id: string;
	closing?: boolean;
	date?: number;
}

/** A handle returned when showing a toast, used to update or close it. */
export interface ToastHandle {
	update: (options: Partial<ToastOptions>) => void;
	close: () => void;
}

/** State and actions of the toast store. */
export interface ToastStoreState {
	toasts: Record<string, InternalToastOptions>;
	addToast: (options: InternalToastOptions) => ToastHandle;
	updateToastWithOptions: (id: string, options: Partial<InternalToastOptions>) => void;
}
