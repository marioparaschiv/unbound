import { afterEach, describe, expect, mock, test } from 'bun:test';

import { mockLookups } from '../helpers/lookups';

type User = { isStaff: boolean };
type Filter = (payload: MetroExport) => boolean;

let enabled = false;
let loaded: ((store: MetroExport) => void) | null = null;
let settingChanged: (() => void) | null = null;
let currentUser: User = { isStaff: false };

const UserConstants = {
	isStaffEnv: (user: User) => user.isStaff,
	isStaffEnvRawData: () => false,
};

Object.assign(globalThis, { window: globalThis });

mock.module('@unbound-app/logger', () => ({
	createLogger: () => ({ warn: () => undefined, error: () => undefined }),
}));

mock.module('~/settings/unbound', () => ({
	getSetting: () => enabled,
	isSettingChange: () => true,
}));

mock.module('~/metro/filters', () => ({ byFluxStore: () => () => true }));
mockLookups({
	findByProps: (...props: string[]) =>
		props.includes('isStaffEnv') ? UserConstants : { getPublicInstanceFromRootTag: () => null },
});
mock.module('~/metro/wait', () => ({
	onModuleLoaded: (_filter: Filter, callback: (store: MetroExport) => void) => {
		loaded = callback;

		return () => void (loaded = null);
	},
}));
mock.module('~/storage/api', () => ({
	onChange: (_filter: Filter, callback: () => void) => {
		settingChanged = callback;

		return () => void (settingChanged = null);
	},
}));

const { start, stop } = await import('~/builtins/staff-mode');

afterEach(() => {
	stop();
	enabled = false;
	loaded = null;
	settingChanged = null;
	currentUser = { isStaff: false };
});

describe('staff mode', () => {
	function createStore({ legacyDispatcher = false } = {}) {
		let isDeveloper = false;
		let changeCount = 0;
		const dispatchToken = 'ID_0';

		function currentUserUpdate() {
			isDeveloper = UserConstants.isStaffEnv(currentUser);
		}

		const nodes = new Map([
			[dispatchToken, { actionHandler: { CURRENT_USER_UPDATE: currentUserUpdate } }],
		]);
		const store: MetroExport = {
			_dispatcher: legacyDispatcher
				? { _nodes: nodes }
				: { _actionHandlers: { _nodes: nodes } },
			getDispatchToken: () => dispatchToken,
			initialize() {
				Object.defineProperty(this, 'isDeveloper', {
					configurable: false,
					get: () => isDeveloper,
					set: () => {},
				});
				currentUserUpdate();
			},
			getExperimentDescriptor() {
				return isDeveloper
					? {
							type: 'developer',
							name: 'discord_dev_testing',
							revision: 1,
							override: true,
							bucket: 1,
						}
					: null;
			},
			waitFor() {},
			emitChange() {
				changeCount++;
			},
			getChangeCount: () => changeCount,
		};

		return store;
	}

	test('exposes the developer experiment descriptor when enabled before initialization', () => {
		const store = createStore();

		enabled = true;
		start();
		loaded?.(store);
		store.initialize();

		expect(store.isDeveloper).toBe(true);
		expect(store.getExperimentDescriptor()).toMatchObject({
			type: 'developer',
			name: 'discord_dev_testing',
		});
	});

	test('refreshes a store on the older dispatcher, which keeps its nodes on the dispatcher itself', () => {
		const store = createStore({ legacyDispatcher: true });

		store.initialize();
		start();
		loaded?.(store);
		enabled = true;
		settingChanged?.();

		expect(store.isDeveloper).toBe(true);
	});

	test('refreshes the initialized store when the setting changes', () => {
		const store = createStore();

		store.initialize();
		Object.freeze(store);
		enabled = true;
		start();
		loaded?.(store);
		settingChanged?.();

		expect(store.isDeveloper).toBe(true);
		expect(store.getExperimentDescriptor()).toMatchObject({
			type: 'developer',
			name: 'discord_dev_testing',
		});

		enabled = false;
		settingChanged?.();
		expect(store.isDeveloper).toBe(false);
		expect(store.getExperimentDescriptor()).toBeNull();
		expect(store.getChangeCount()).toBe(3);

		currentUser.isStaff = true;
		settingChanged?.();
		expect(store.isDeveloper).toBe(true);
	});
});
