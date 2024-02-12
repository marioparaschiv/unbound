import type { StyleProp, TextStyle, ViewStyle, ImageStyle } from 'react-native';

export namespace Common {
	export interface StyleSheet {
		createStyles: <T extends Record<string, StyleProp<ViewStyle | TextStyle | ImageStyle>>>(style: T) => Fn<T>;
	}

	export type React = typeof import('react');
	export type ReactNative = typeof import('react-native');
	export type Reanimated = typeof import('react-native-reanimated');
	export type Gestures = typeof import('react-native-gesture-handler');

	export interface Dispatcher {
		dispatch(payload: Record<string, any>): Promise<void>;
		unsubscribe(event: string, handler: Fn): void;
		subscribe(event: string, handler: Fn): void;
	}

	export interface Flux {
		Store: (new (dispatcher: Dispatcher, listeners: Record<string, ({ [key: string]: any; })>) => any);
		connectStores: Fn;
	}

	export type Moment = typeof import('moment');

	export type Events = typeof import('events');

	export type Clipboard = typeof import('@react-native-clipboard/clipboard');

	// Discord

	// export const REST = findByProps('getAPIBaseURL', { lazy: true });
	// export const i18n = findByProps('Messages', { lazy: true });

}