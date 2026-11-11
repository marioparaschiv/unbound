import { createLogger } from '@unbound-app/logger';

import { getSetting, isSettingChange } from '~/settings/unbound';
import { createPatcher } from '~/patcher/create-patcher';
import { byFluxStore } from '~/metro/filters';
import { findByProps } from '~/metro/lookups';
import { onModuleLoaded } from '~/metro/wait';
import { onChange } from '~/storage/api';

const Patcher = createPatcher('unbound::staff-mode');
const Logger = createLogger('StaffMode');
const UserConstants = findByProps('isStaffEnv', 'isStaffEnvRawData');

let stopWaiting: (() => void) | null = null;
let unsubscribe: (() => void) | null = null;
let warnedMissingStaffHelper = false;
let warnedMissingUpdateHandler = false;

/** Makes the developer experiment store report staff status from the `staff-mode` setting. */
export function start() {
	warnedMissingStaffHelper = false;
	warnedMissingUpdateHandler = false;
	stopWaiting = onModuleLoaded(byFluxStore('DeveloperExperiment'), patchStore);
}

function patchStore(Store: MetroExport) {
	if (Object.getOwnPropertyDescriptor(Store, 'isDeveloper') === undefined) {
		const InitializeTarget = Object.getOwnPropertyDescriptor(Store, 'initialize')
			? Store
			: Object.getPrototypeOf(Store);

		if (!InitializeTarget || !Object.isExtensible(InitializeTarget)) {
			Logger.warn('DeveloperExperimentStore cannot be patched before initialization.');
		} else {
			Patcher.instead(InitializeTarget, 'initialize', ({ original }) =>
				withStaffMode(original),
			);
		}
	}

	unsubscribe = onChange(
		(payload) => isSettingChange(payload, 'staff-mode'),
		() => refreshStore(Store),
	);

	if (Object.getOwnPropertyDescriptor(Store, 'isDeveloper') !== undefined) {
		refreshStore(Store);
	}
}

function withStaffMode<T>(operation: () => T): T {
	const original = UserConstants?.isStaffEnv;

	if (!UserConstants || typeof original !== 'function') {
		if (!warnedMissingStaffHelper) {
			Logger.warn('Discord staff environment helper was not found.');
			warnedMissingStaffHelper = true;
		}

		return operation();
	}

	UserConstants.isStaffEnv = function (
		this: MetroExport,
		user: MetroExport,
		environment?: string,
	) {
		return getSetting('staff-mode') || original.call(this, user, environment);
	};

	try {
		return operation();
	} finally {
		UserConstants.isStaffEnv = original;
	}
}

function refreshStore(Store: MetroExport) {
	const token = Store.getDispatchToken?.() ?? Store._dispatchToken;
	const handler = Store._dispatcher?._nodes?.get(token)?.actionHandler?.CURRENT_USER_UPDATE;

	if (typeof handler === 'function') {
		withStaffMode(() => handler({ type: 'CURRENT_USER_UPDATE' }));
	} else if (!warnedMissingUpdateHandler) {
		Logger.warn('DeveloperExperimentStore current-user handler was not found.');
		warnedMissingUpdateHandler = true;
	}

	Store.emitChange();
}

/** Stops following the `staff-mode` setting and restores the developer experiment store. */
export function stop() {
	stopWaiting?.();
	stopWaiting = null;
	unsubscribe?.();
	unsubscribe = null;

	Patcher.unpatchAll();
}

export default { start, stop };
