import { Moment, Dispatcher } from '@api/metro/common';

function onDispatch(payload: { locale: string; }) {
	const { locale } = payload;

	Moment.locale(locale.toLowerCase());

	Dispatcher.unsubscribe('I18N_LOAD_SUCCESS', onDispatch);
}

export function apply() {
	Dispatcher.subscribe('I18N_LOAD_SUCCESS', onDispatch);
}

export function remove() {
	Dispatcher.unsubscribe('I18N_LOAD_SUCCESS', onDispatch);
}