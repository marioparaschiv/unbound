import { findByPropsLazy } from '~/metro/wrappers';
import * as FluxModules from '~/flux/modules';

export const ReactNative = window.ReactNative;
export const React = window.React;

export const Reanimated = findByPropsLazy('useAnimatedStyle', 'useSharedValue');
export const Gestures = findByPropsLazy('PanGestureHandler');
export const Clipboard = findByPropsLazy('setString', 'getString', 'setImage', 'getImage');
export const MarkdownParser = findByPropsLazy('parse', 'parseToAST', 'reactParserFor');
export const Screens = findByPropsLazy('FullWindowOverlay');
export const SVG = findByPropsLazy('Svg', 'Path');
export const Commands = findByPropsLazy('getBuiltInCommands');
export const Moment = findByPropsLazy('isMoment');

export const Util = findByPropsLazy('inspect');
/** @deprecated Use the flux namespace */
export const Flux = FluxModules.Flux;
/** @deprecated Use flux.useStore */
export const FluxHooks = FluxModules.FluxHooks;
export const Assets = findByPropsLazy('registerAsset');
export const Clyde = findByPropsLazy('createBotMessage');
/** @deprecated Use flux.dispatch, flux.onAction and flux.interceptAction */
export const Dispatcher = FluxModules.Dispatcher;
export const Constants = findByPropsLazy('Fonts', 'Endpoints');
export const Radius = findByPropsLazy('Radius');
export const Theme = findByPropsLazy('colors', 'internal');
export const REST = findByPropsLazy('getAPIBaseURL');
export const i18n = findByPropsLazy('getLanguages', 'getSystemLocale', 'intl');
