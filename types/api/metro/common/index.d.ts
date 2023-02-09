import type { StyleProp, TextStyle, ViewStyle, ImageProps, StyleSheet } from 'react-native';
import type moment from './moment';

export namespace Common {
  export interface StyleSheets {
    createThemedStyleSheet: <T extends Record<string, StyleProp<ViewStyle | TextStyle | ImageProps>>>(style: T) => T;
    getThemedStylesheet: <T extends Record<string, StyleProp<ViewStyle | TextStyle | ImageProps>>>(style: T) => {
      mergedDarkStyles: StyleSheet,
      mergedLightStyles: StyleSheet;
    };
  }

  export type React = typeof import('react');
  export type ReactNative = typeof import('react-native');

  export interface Dispatcher {
    dispatch(payload: Record<string, any>): Promise<void>;
    unsubscribe(event: string, handler: Fn): void;
    subscribe(event: string, handler: Fn): void;
  }

  export interface Flux {
    Store: (new (dispatcher: Dispatcher, listeners: Record<string, ({ [key: string]: any; })>) => any);
    connectStores: Fn;
  }

  export type Moment = typeof moment;

  export type Events = typeof import('events');

  // Discord

  // export const REST = findByProps('getAPIBaseURL', { lazy: true });
  // export const i18n = findByProps('Messages', { lazy: true });

}