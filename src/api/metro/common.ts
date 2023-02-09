import { Common } from '@typings/api/metro/common';
import { findByProps } from '@metro';

// Libraries
export const React: Common.React = findByProps('createElement', 'Children', { lazy: true });
export const Flux: Common.Flux = findByProps('Store', 'connectStores', { lazy: true });
export const ReactNative: Common.ReactNative = findByProps('AppState', { lazy: true });
export const EventEmitter: Common.Events = findByProps('EventEmitter').EventEmitter;
export const Moment: Common.Moment = findByProps('isMoment');

// Discord
export const StyleSheet: Common.StyleSheets = findByProps('createThemedStyleSheet', { lazy: true });
export const Constants = findByProps('API_HOST', 'Endpoints', { lazy: true });
export const Dispatcher: Common.Dispatcher = findByProps('_dispatch', { lazy: true });
export const REST = findByProps('getAPIBaseURL', { lazy: true });
export const i18n = findByProps('Messages', { lazy: true });
