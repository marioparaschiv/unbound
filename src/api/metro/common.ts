import { Common } from '@typings/api/metro/common';
import { findByProps } from '@metro';

// Libraries
export let Reanimated = findByProps('useAnimatedStyle', 'withSpring', { lazy: true }) as Common.Reanimated;
export const Flux = findByProps('Store', 'connectStores', { lazy: true }) as Common.Flux;
export const Moment = findByProps('isMoment') as Common.Moment;
export const Clipboard = findByProps('setString', 'getString', 'setImage', 'getImage', { lazy: true }) as unknown as Common.Clipboard;

// Preloaded modules
export const ReactNative: Common.ReactNative = window.ReactNative;
export const React: Common.React = window.React;

// Discord
export const StyleSheet = findByProps('createStyles', { lazy: true }) as Common.StyleSheet;
export const Dispatcher = findByProps('_dispatch', { lazy: true }) as unknown as Common.Dispatcher;
export const Constants = findByProps('Fonts', 'Endpoints', { lazy: true });
export const Theme = findByProps('colors', 'meta', { lazy: true });
export const REST = findByProps('getAPIBaseURL', { lazy: true });
export const i18n = findByProps('Messages', { lazy: true });