import { findByProps } from '@metro';
import type { Common } from '@typings/api/metro/common';

// Preloaded modules
export const ReactNative = window.ReactNative;
export const React = window.React;

export const Reanimated: Common.Reanimated = findByProps('useAnimatedStyle', 'withSpring', { lazy: true }) as Common.Reanimated;
export const Gestures: Common.Gestures = findByProps('Gesture', 'GestureDetector', 'createNativeWrapper', { lazy: true }) as Common.Gestures;
export const Clipboard = findByProps('setString', 'getString', 'setImage', 'getImage', { lazy: true }) as unknown as Common.Clipboard['default'];
export const Flux: Common.Flux = findByProps('Store', 'connectStores', { lazy: true }) as Common.Flux;
export const Moment: Common.Moment = findByProps('isMoment', { lazy: true }) as Common.Moment;

export const StyleSheet = findByProps('createStyles', { lazy: true });
export const Dispatcher = findByProps('_dispatch', { lazy: true });
export const Constants = findByProps('Fonts', 'Endpoints', { lazy: true });
export const Theme = findByProps('colors', 'internal', { lazy: true });
export const REST = findByProps('getAPIBaseURL', { lazy: true });
export const i18n = findByProps('Messages', { lazy: true });