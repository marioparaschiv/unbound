import type { ImageSourcePropType } from 'react-native';
import type { ComponentType } from 'react';

/** A button rendered inside a toast. */
export type ToastButton = {
	/** The Discord button style. Defaults to `'primary'`. */
	variant?: 'primary' | 'secondary' | 'tertiary';
	/** The Discord button size. Defaults to `'sm'`. */
	size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
	/** Which side of the label the icon sits on. Defaults to `'start'`. */
	iconPosition?: 'start' | 'end';
	/** The button's label. */
	content: string;
	/** An asset id, drawn beside the label. */
	icon?: number;
	/** Runs when the button is tapped. The toast stays open; call `close` on its handle to dismiss it. */
	onPress: () => void;
};

/** Options accepted when showing a toast. */
export type ToastOptions = {
	/** The bold first line, or a component rendered in its place. */
	title?: string | ComponentType;
	/** The body text under the title. */
	content?: string;
	/** Milliseconds before the toast closes itself; `0` keeps it until dismissed. Omitted, the user's toast duration setting. */
	duration?: number;
	/** Declared for callers, but the client does not call it yet. */
	onTimeout?: () => void;
	/** An asset name, asset id or image source; a name with no matching asset draws no image. */
	icon?: string | number | ImageSourcePropType;
	/** Identifies the toast; showing another toast with the same id replaces it. Omitted, a random id. */
	id?: string;
	/** Buttons in a row under the content. */
	buttons?: ToastButton[];
	/** Tints the icon with the theme's icon colour. Defaults to `true`; set `false` for a coloured icon. */
	tintedIcon?: boolean;
};

/** {@link ToastOptions} enriched with the fields the store tracks internally. */
export type InternalToastOptions = {
	id: string;
	closing?: boolean;
	date?: number;
} & ToastOptions;

/** A handle returned when showing a toast, used to update or close it. */
export type ToastHandle = {
	/** Merges `options` into the shown toast. Does nothing once the toast is gone. */
	update: (options: Partial<ToastOptions>) => void;
	/** Plays the toast's exit animation, then removes it. */
	close: () => void;
};

/** State and actions of the toast store. */
export type ToastStoreState = {
	/** Every toast on screen, keyed by toast id, including ones playing their exit animation. */
	toasts: Record<string, InternalToastOptions>;
	/** Shows a toast, replacing any with the same id, and stamps `date` when unset. */
	addToast: (options: InternalToastOptions) => ToastHandle;
	/** Merges `options` into the toast `id`. Does nothing when no such toast is on screen. */
	updateToastWithOptions: (id: string, options: Partial<InternalToastOptions>) => void;
};
