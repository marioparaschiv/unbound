import type { i18nLoadedPayload } from '@typings/built-ins/hindi-timestamps';
import { Moment, Dispatcher } from '@api/metro/common';
import type { BuiltInData } from '@typings/built-ins';

export const data: BuiltInData = {
	name: 'Locale Fix'
};

export function start() {
	Dispatcher.subscribe<i18nLoadedPayload>('I18N_LOAD_SUCCESS', onDispatch);
}

export function stop() {
	Dispatcher.unsubscribe<i18nLoadedPayload>('I18N_LOAD_SUCCESS', onDispatch);
}

function onDispatch(payload: i18nLoadedPayload) {
	const { locale } = payload;

	Moment.locale(locale.toLowerCase());

	Dispatcher.unsubscribe('I18N_LOAD_SUCCESS', onDispatch);
}