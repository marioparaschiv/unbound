import type { ThemingModule, ReanimatedModule, GesturesModule, ClipboardModule, FluxModule, MomentModule, AssetsModule, SVGModule, ScreensModule, StyleSheetModule, ConstantsModule, DispatcherModule, i18nModule, APIModule, ClydeModule } from '@typings/api/metro/common';
import { findByProps } from '@api/metro';

export type * from '@typings/api/metro/common';

// Preloaded modules
export const ReactNative: typeof import('react-native') = window.ReactNative;
export const React: typeof import('react') = window.React;

// Typed Libraries
export const Reanimated: ReanimatedModule = findByProps('useAnimatedStyle', 'withSpring', { lazy: true }) as ReanimatedModule;
export const Gestures: GesturesModule = findByProps('Gesture', 'GestureDetector', 'createNativeWrapper', { lazy: true }) as GesturesModule;
export const Clipboard: ClipboardModule = findByProps('setString', 'getString', 'setImage', 'getImage', { lazy: true }) as ClipboardModule;
export const Screens: ScreensModule = findByProps('FullWindowOverlay', { lazy: true }) as ScreensModule;
export const Moment: MomentModule = findByProps('isMoment', { lazy: true }) as MomentModule;
export const SVG: SVGModule = findByProps('Svg', 'Path', { lazy: true }) as SVGModule;
export const Commands = findByProps('getBuiltInCommands', { lazy: true });

// Modules
export const Util = findByProps('inspect', { lazy: true });
export const Flux: FluxModule = findByProps('Store', 'connectStores', { lazy: true }) as FluxModule;
export const Assets: AssetsModule = findByProps('registerAsset', { lazy: true }) as AssetsModule;
export const Clyde: ClydeModule = findByProps('createBotMessage', { lazy: true }) as ClydeModule;
export const Dispatcher: DispatcherModule = findByProps('dispatch', 'subscribe', { lazy: true }) as DispatcherModule;
export const StyleSheet: StyleSheetModule = findByProps('createStyles', { lazy: true }) as StyleSheetModule;
export const Constants: ConstantsModule = findByProps('Fonts', 'Endpoints', { lazy: true }) as ConstantsModule;
export const Theme: ThemingModule = findByProps('colors', 'internal', { lazy: true }) as ThemingModule;
export const REST: APIModule = findByProps('getAPIBaseURL', { lazy: true }) as APIModule;
export const i18n: i18nModule = findByProps('Messages', '_requestedLocale', { lazy: true }) as i18nModule;