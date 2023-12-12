import { findByProps } from '@metro';
import type { Common } from '@typings/api/metro/common';

// Preloaded modules
export const ReactNative = window.ReactNative;
export const React = window.React;

export const [
	Reanimated,
	Gestures,
	Flux,
	Moment,
	Clipboard,
	StyleSheet,
	Dispatcher,
	Constants,
	Theme,
	REST,
	i18n
] = [
		findByProps('useAnimatedStyle', 'withSpring', { lazy: true }) as Common.Reanimated,
		findByProps('Gesture', 'GestureDetector', 'createNativeWrapper', { lazy: true }) as unknown as Common.Gestures,
		findByProps('Store', 'connectStores', { lazy: true }) as Common.Flux,
		findByProps('isMoment', { lazy: true }) as Common.Moment,
		findByProps('setString', 'getString', 'setImage', 'getImage', { lazy: true }) as Common.Clipboard,
		findByProps('createStyles', { lazy: true }),
		findByProps('_dispatch', { lazy: true }),
		findByProps('Fonts', 'Endpoints', { lazy: true }),
		findByProps('colors', 'meta', { lazy: true }),
		findByProps('getAPIBaseURL', { lazy: true }),
		findByProps('Messages', { lazy: true })
	];