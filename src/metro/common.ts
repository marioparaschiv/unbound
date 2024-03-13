import type { Common } from '@typings/api/metro/common';
import { fastFindByProps, findByProps } from '@metro';

// Preloaded modules
export const ReactNative = window.ReactNative;
export const React = window.React;

export const Reanimated: Common.Reanimated = fastFindByProps('useAnimatedStyle', 'withSpring', { lazy: true }) as Common.Reanimated;
export const Gestures: Common.Gestures = fastFindByProps('Gesture', 'GestureDetector', 'createNativeWrapper', { lazy: true }) as Common.Gestures;
export const Clipboard = fastFindByProps('setString', 'getString', 'setImage', 'getImage', { lazy: true }) as unknown as Common.Clipboard['default'];
export const Flux: Common.Flux = fastFindByProps('Store', 'connectStores', { lazy: true }) as Common.Flux;
export const Moment: Common.Moment = fastFindByProps('isMoment', { lazy: true }) as Common.Moment;

export const StyleSheet = fastFindByProps('createStyles', { lazy: true });
export const Dispatcher = findByProps('_dispatch', { lazy: true });
export const Constants = fastFindByProps('Fonts', 'Endpoints', { lazy: true });
export const Theme = fastFindByProps('colors', 'internal', { lazy: true });
export const REST = fastFindByProps('getAPIBaseURL', { lazy: true });
export const i18n = fastFindByProps('Messages', '_requestedLocale', { lazy: true });