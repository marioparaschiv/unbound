import type { ThemingModule, ReanimatedModule, GesturesModule, ClipboardModule, FluxModule, MomentModule, AssetsModule, SVGModule, ScreensModule, ConstantsModule, DispatcherModule, i18nModule, APIModule, ClydeModule, MarkdownParserModule } from '@typings/api/metro/common';
import { findByProps } from '@api/metro';


export type * from '@typings/api/metro/common';

// Preloaded modules
export const ReactNative: typeof import('react-native') = window.ReactNative;
export const React: typeof import('react') = window.React;

// Typed Libraries
export const Reanimated = findByProps('useAnimatedStyle', 'withSpring', { lazy: true }) as ReanimatedModule;
export const Gestures = findByProps('Gesture', 'GestureDetector', 'createNativeWrapper', { lazy: true }) as GesturesModule;
export const Clipboard = findByProps('setString', 'getString', 'setImage', 'getImage', { lazy: true }) as ClipboardModule;
export const MarkdownParser = findByProps('parse', 'parseToAST', 'reactParserFor', { lazy: true }) as MarkdownParserModule;
export const Screens = findByProps('FullWindowOverlay', { lazy: true }) as ScreensModule;
export const Moment = findByProps('isMoment', { lazy: true }) as MomentModule;
export const SVG = findByProps('Svg', 'Path', { lazy: true }) as SVGModule;
export const Commands = findByProps('getBuiltInCommands', { lazy: true });

// Modules
export const Util = findByProps('inspect', { lazy: true });
export const Flux = findByProps('Store', 'connectStores', { lazy: true }) as FluxModule;
export const Assets = findByProps('registerAsset', { lazy: true }) as AssetsModule;
export const Clyde = findByProps('createBotMessage', { lazy: true }) as ClydeModule;
export const Dispatcher = findByProps('dispatch', 'subscribe', { lazy: true }) as DispatcherModule;
export const Constants = findByProps('Fonts', 'Endpoints', { lazy: true }) as ConstantsModule;
export const Theme = findByProps('colors', 'internal', { lazy: true }) as ThemingModule;
export const REST = findByProps('getAPIBaseURL', { lazy: true }) as APIModule;
export const i18n = findByProps('Messages', '_requestedLocale', { lazy: true }) as i18nModule;
export const Navigation = findByProps('pushLazy', { lazy: true });
