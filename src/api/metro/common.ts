import { Common } from '@typings/api/metro/common';
import { findByProps } from '@metro';

// Libraries
export const Reanimated: Common.Reanimated = findByProps('useAnimatedStyle', { lazy: true });
export const Flux: Common.Flux = findByProps('Store', 'connectStores', { lazy: true });
export const Moment: Common.Moment = findByProps('isMoment');
export const Clipboard: Common.Clipboard = findByProps('setString', 'getString', 'setImage', 'getImage', { lazy: true });

// Preloaded modules
export const ReactNative: Common.ReactNative = window.ReactNative;
export const React: Common.React = window.React;

// Discord
export const StyleSheet: Common.StyleSheets = findByProps('createThemedStyleSheet', { lazy: true });
export const Dispatcher: Common.Dispatcher = findByProps('_dispatch', { lazy: true });
export const Constants = findByProps('Fonts', 'Endpoints', { lazy: true });
export const Theme = findByProps('colors', 'meta', { lazy: true });
export const REST = findByProps('getAPIBaseURL', { lazy: true });
export const i18n = findByProps('Messages', { lazy: true });