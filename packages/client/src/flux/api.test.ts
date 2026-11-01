import type { FluxAction, FluxChangeListener, FluxStore } from '@unbound-app/types/flux';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

type Listener = (action: FluxAction) => void;
type Interceptor = (action: FluxAction) => boolean;
type StoreSearch = { name: string; options: Record<string, boolean | undefined> };
type HookCall = { stores: FluxStore[]; deps: readonly string[] | undefined };

function createDiscordDispatcher() {
	const subscriptions = new Map<string, Set<Listener>>();
	const interceptors: Interceptor[] = [];
	const handled: FluxAction[] = [];

	return {
		handled,
		interceptors,
		subscriptions,
		dispatch(action: FluxAction) {
			if (interceptors.some((interceptor) => interceptor(action))) {
				return Promise.resolve();
			}

			handled.push(action);

			for (const listener of subscriptions.get(action.type) ?? []) {
				listener(action);
			}

			return Promise.resolve();
		},
		subscribe(type: string, listener: Listener) {
			const listeners = subscriptions.get(type) ?? new Set<Listener>();

			listeners.add(listener);
			subscriptions.set(type, listeners);
		},
		unsubscribe(type: string, listener: Listener) {
			subscriptions.get(type)?.delete(listener);
		},
		addInterceptor(interceptor: Interceptor) {
			interceptors.push(interceptor);
		},
	};
}

function createStore(name: string) {
	const listeners = new Set<FluxChangeListener>();

	return {
		listeners,
		getName: () => name,
		addChangeListener: (listener: FluxChangeListener) => void listeners.add(listener),
		removeChangeListener: (listener: FluxChangeListener) => void listeners.delete(listener),
		emitChange() {
			for (const listener of listeners) listener();
		},
	};
}

const dispatcher = createDiscordDispatcher();
const searches: StoreSearch[] = [];
const hookCalls: HookCall[] = [];
const userStore = createStore('UserStore');

mock.module('~/flux/modules', () => ({
	Dispatcher: dispatcher,
	Flux: {},
	FluxHooks: {
		useStateFromStores<T>(stores: FluxStore[], getter: () => T, deps?: readonly string[]) {
			hookCalls.push({ stores, deps });

			return getter();
		},
	},
}));

mock.module('~/metro/finders', () => ({
	finder: () => (name: string, options: StoreSearch['options']) => {
		searches.push({ name, options });

		return userStore;
	},
}));

Reflect.set(globalThis, '$$DEV$$', false);

const flux = await import('./api');
const filters = await import('~/metro/filters');
const { CACHE_KEY } = await import('~/core/constants');

beforeEach(() => {
	dispatcher.subscriptions.clear();
	dispatcher.handled.length = 0;
	searches.length = 0;
	hookCalls.length = 0;
});

describe('getStore', () => {
	test('searches lazily by default and passes the name and options on', () => {
		expect<FluxStore>(flux.getStore('User')).toBe(userStore);
		flux.getStore('Typing', { lazy: false, short: false });

		expect(searches).toEqual([
			{ name: 'User', options: { lazy: true } },
			{ name: 'Typing', options: { lazy: false, short: false } },
		]);
	});
});

describe('byFluxStore', () => {
	test('matches a store by name and keeps the byStore cache key', () => {
		const filter = filters.byFluxStore('User');

		expect(filter[CACHE_KEY]).toBe('byStore::UserStore');
		expect(filter({ _dispatcher: dispatcher, getName: () => 'UserStore' }, 1)).toBe(true);
		expect(filter({ _dispatcher: dispatcher, getName: () => 'GuildStore' }, 1)).toBe(false);
	});
});

describe('useStore', () => {
	test('reads one store or several through Discord’s hook', () => {
		const guildStore = createStore('GuildStore');

		expect(flux.useStore(userStore, () => 'one')).toBe('one');
		expect(flux.useStore([userStore, guildStore], () => 'two', ['dep'])).toBe('two');

		expect(hookCalls).toEqual([
			{ stores: [userStore], deps: undefined },
			{ stores: [userStore, guildStore], deps: ['dep'] },
		]);
	});
});

describe('onStoreChange', () => {
	test('runs on each change until removed', () => {
		let changes = 0;
		const remove = flux.onStoreChange(userStore, () => changes++);

		userStore.emitChange();
		remove();
		userStore.emitChange();

		expect(changes).toBe(1);
		expect(userStore.listeners.size).toBe(0);
	});
});

describe('onAction', () => {
	test('runs for its action type until removed', async () => {
		const seen: string[] = [];
		const remove = flux.onAction('TYPING_START', (action) => seen.push(action.userId));

		await flux.dispatch({ type: 'TYPING_START', channelId: 'c', userId: 'u1' });
		await flux.dispatch({ type: 'TYPING_STOP', channelId: 'c', userId: 'u2' });
		remove();
		await flux.dispatch({ type: 'TYPING_START', channelId: 'c', userId: 'u3' });

		expect(seen).toEqual(['u1']);
	});

	test('a throwing listener does not stop the others', async () => {
		const seen: string[] = [];

		flux.onAction('CUSTOM_ACTION', () => {
			throw new Error('listener failed');
		});
		flux.onAction('CUSTOM_ACTION', (action) => seen.push(action.type));

		await flux.dispatch({ type: 'CUSTOM_ACTION' });

		expect(seen).toEqual(['CUSTOM_ACTION']);
	});
});

describe('interceptAction', () => {
	test('drops an action until the interceptor is removed', async () => {
		const remove = flux.interceptAction('MESSAGE_DELETE', (action) => action.id === 'kept');

		await flux.dispatch({ type: 'MESSAGE_DELETE', id: 'kept', channelId: 'c' });
		await flux.dispatch({ type: 'MESSAGE_DELETE', id: 'gone', channelId: 'c' });
		remove();
		await flux.dispatch({ type: 'MESSAGE_DELETE', id: 'kept', channelId: 'c' });

		expect<object[]>(dispatcher.handled).toEqual([
			{ type: 'MESSAGE_DELETE', id: 'gone', channelId: 'c' },
			{ type: 'MESSAGE_DELETE', id: 'kept', channelId: 'c' },
		]);
	});

	test('may change an action, and a throwing one lets it through', async () => {
		const removeThrowing = flux.interceptAction('CHANNEL_SELECT', () => {
			throw new Error('interceptor failed');
		});
		const removeRewrite = flux.interceptAction('CHANNEL_SELECT', (action) => {
			action.channelId = 'rewritten';

			return false;
		});

		await flux.dispatch({ type: 'CHANNEL_SELECT', channelId: 'original' });
		removeThrowing();
		removeRewrite();

		expect<object[]>(dispatcher.handled).toEqual([
			{ type: 'CHANNEL_SELECT', channelId: 'rewritten' },
		]);
	});

	test('installs one dispatcher interceptor however many are registered', () => {
		const removers = [
			flux.interceptAction('TYPING_START', () => false),
			flux.interceptAction('TYPING_STOP', () => false),
		];

		for (const remove of removers) remove();

		expect(dispatcher.interceptors).toHaveLength(1);
	});
});

describe('dispatch', () => {
	test('sends the action through Discord’s dispatcher', async () => {
		await flux.dispatch({ type: 'CHANNEL_SELECT', channelId: 'c', guildId: 'g' });

		expect<object[]>(dispatcher.handled).toEqual([
			{ type: 'CHANNEL_SELECT', channelId: 'c', guildId: 'g' },
		]);
	});
});
