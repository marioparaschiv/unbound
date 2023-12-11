export * as managers from './managers';
export * as patcher from './patcher';
export * as assets from './assets';

export * as utilities from '@utilities';
export * as commands from './commands';
export * as storage from './storage';
export * as dialogs from './dialogs';
export * as toasts from './toasts';
export * as native from './native';
export * as i18n from './i18n';
export * as components from '@ui/components';

import Filters from '@metro/filters';
import * as Modules from '@metro';

import * as Components from '@metro/components';
import * as Stores from '@metro/stores';
import * as Common from '@metro/common';
import * as API from '@metro/api';

export const metro = Object.assign(Modules, {
	components: Components,
	filters: Filters,
	common: Common,
	stores: Stores,
	api: API
});