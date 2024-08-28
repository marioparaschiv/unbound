import type { Common } from '@typings/api/metro/common';
import { findByProps } from '@metro';

// Preloaded modules
export const ReactNative = window.ReactNative;
export const React = window.React;

export const Reanimated: Common.Reanimated = findByProps('useAnimatedStyle', 'withSpring', { lazy: true }) as Common.Reanimated;
export const Gestures: Common.Gestures = findByProps('Gesture', 'GestureDetector', 'createNativeWrapper', { lazy: true }) as Common.Gestures;
export const Clipboard = findByProps('setString', 'getString', 'setImage', 'getImage', { lazy: true }) as unknown as Common.Clipboard['default'];
export const Flux: Common.Flux = findByProps('Store', 'connectStores', { lazy: true }) as Common.Flux;
export const Moment: Common.Moment = findByProps('isMoment', { lazy: true }) as Common.Moment;
export const Screens = findByProps('FullWindowOverlay', { lazy: true });
export const Portal = findByProps('PortalHost', 'Portal', { lazy: true });
export const SVG = findByProps('Svg', 'Path', { lazy: true });

export const StyleSheet = findByProps('createStyles', { lazy: true }) as Common.StyleSheet;
export const Dispatcher = findByProps('_dispatch', { lazy: true });
export const Constants = findByProps('Fonts', 'Endpoints', { lazy: true });
export const Theme = findByProps('colors', 'internal', { lazy: true });
export const REST = findByProps('getAPIBaseURL', { lazy: true });
export const i18n = findByProps('Messages', '_requestedLocale', { lazy: true });