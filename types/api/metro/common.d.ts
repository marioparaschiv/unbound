import type { StyleSheetModule, Theming } from '@typings/discord/theming';
import type { FluxDispatcher } from '@typings/discord/flux-dispatcher';
import type { ClydeModule } from '@typings/discord/messages';
import type { AssetsModule } from '@typings/discord/assets';
import type { FluxModule } from '@typings/discord/flux';
import type { APIModule } from '@typings/discord/api';
import type { i18n } from '@typings/discord/i18n';

export interface ConstantsModule {
	[key: PropertyKey]: any;
}

export type ReanimatedModule = typeof import('react-native-reanimated');
export type GesturesModule = typeof import('react-native-gesture-handler');
export type MomentModule = typeof import('moment');
export type EventsModule = typeof import('events');
export type ClipboardModule = typeof import('@react-native-clipboard/clipboard')['default'];
export type SVGModule = typeof import('react-native-svg');
export type ScreensModule = typeof import('react-native-screens');


export {
	FluxDispatcher as DispatcherModule,
	i18n as i18nModule,
	AssetsModule,
	Theming as ThemingModule,
	FluxModule,
	StyleSheetModule,
	APIModule,
	ClydeModule
};