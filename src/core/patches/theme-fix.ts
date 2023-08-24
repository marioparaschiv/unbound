import { Theme as ThemeStore } from '@metro/stores';
import { Dispatcher } from '@metro/common';
import { Themes } from '@metro/ui';

export function apply() {
	if (!Dispatcher?.subscribe) return;

	Dispatcher.subscribe('I18N_LOAD_SUCCESS', handler);
}

export function remove() {
	if (!Dispatcher?.subscribe) return;

	Dispatcher.unsubscribe('I18N_LOAD_SUCCESS', handler);
}

function handler() {
	Themes.overrideTheme(ThemeStore.theme);
}