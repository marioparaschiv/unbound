import { beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { logs, metro, native, patches, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import type { NativeObjectHandle } from '@unbound-app/api/native';
import { AppState } from 'react-native';

const sent: string[] = [];
const appState = new Set<(state: string) => void>();
const runtimeListeners = new Set<(payload: unknown) => void>();
const rotations: number[] = [];
let inputTop = 601;
let inputView: NativeObjectHandle | undefined;

function registerScreen() {
	let rootView: NativeObjectHandle;
	let viewController: NativeObjectHandle;
	let window: NativeObjectHandle;
	let application: NativeObjectHandle;
	native.objc.registerClass('UIView', {
		methods: {
			bounds: (self) => (self === rootView ? rect(0, 667) : rect(0, 32)),
			'setTransform:': (_self, transform) => {
				const value = Reflect.get(transform as object, 'value');
				rotations.push(Reflect.get(value as object, 'a') === -1 ? 180 : 0);
			},
		},
	});
	native.objc.registerClass('DCDChatInputComponentView', {
		superclass: 'UIView',
		methods: { 'convertRect:toView:': () => rect(inputTop, 32) },
	});
	native.objc.registerClass('UIViewController', {
		methods: { view: () => rootView },
	});
	native.objc.registerClass('UIWindow', {
		methods: { rootViewController: () => viewController },
	});
	native.objc.registerClass('UIApplication', {
		classMethods: { sharedApplication: () => application },
		methods: { keyWindow: () => window },
	});
	rootView = native.objc.create('UIView');
	inputView = native.objc.create('DCDChatInputComponentView');
	viewController = native.objc.create('UIViewController');
	window = native.objc.create('UIWindow');
	application = native.objc.create('UIApplication');
}

function rect(y: number, height: number) {
	return {
		name: 'CGRect',
		value: { origin: { x: 0, y }, size: { width: 375, height } },
	};
}

const Messages = {
	sendMessage: (_channelId: string, message: { content: string }) =>
		void sent.push(message.content),
	editMessage: (_channelId: string, _messageId: string, message: { content: string }) =>
		void sent.push(message.content),
	receiveMessage: () => {},
};

beforeEach(() => {
	sent.length = 0;
	appState.clear();
	runtimeListeners.clear();
	rotations.length = 0;
	inputTop = 601;
	registerScreen();
	metro.register(Messages);
	// The kit's AppState never fires, so a test collects the listener to fire it.
	spyOn(AppState, 'addEventListener').mockImplementation(((
		_event: string,
		listener: (state: string) => void,
	) => {
		appState.add(listener);

		return { remove: () => appState.delete(listener) };
	}) as never);
});

// The rotation awaits the bridge a few times, so a test lets those settle.
async function settle() {
	for (let i = 0; i < 20; i++) await Promise.resolve();
}

async function startAussie() {
	await startPlugin({
		native: {
			objc: { findViews: async () => (inputView ? [inputView] : []) } as never,
			runtime: {
				subscribe: (_event: string, listener: (payload: unknown) => void) => {
					runtimeListeners.add(listener);

					return { active: true, remove: () => runtimeListeners.delete(listener) };
				},
			} as never,
		},
	});
	await settle();
}

describe('once started', () => {
	test('turns a message you send or edit upside down', async () => {
		await startAussie();

		Messages.sendMessage('1', { content: 'please wait a moment' });
		Messages.editMessage('1', '2', { content: 'hello' });

		expect(sent).toEqual(['ʇuǝɯoɯ ɐ ʇᴉɐʍ ǝsɐǝld', 'ollǝɥ']);
		expect(patches.applied.map(({ method }) => method).toSorted()).toEqual([
			'editMessage',
			'sendMessage',
		]);
		await stopPlugin();
	});

	test('turns the screen over, again on returning to the foreground, and back on stop', async () => {
		await startAussie();

		for (const listener of appState) {
			listener('background');
			listener('active');
		}

		await settle();
		await stopPlugin();
		await settle();

		expect(rotations).toEqual([180, 180, 0]);
		expect(appState.size).toBe(0);
		expect(runtimeListeners.size).toBe(0);
	});

	test('does not rotate again when stop races with foreground activation', async () => {
		await startAussie();
		for (const listener of appState) listener('active');

		await stopPlugin();

		expect(rotations).toEqual([180, 0]);
	});

	test('reports a rotation that fails instead of throwing', async () => {
		// A device whose key window cannot be found.
		native.objc.registerClass('UIApplication', {
			classMethods: {
				sharedApplication: () => {
					throw new Error('no decor view');
				},
			},
		});
		await startAussie();
		await stopPlugin();

		expect(logs.entries.some(({ level }) => level === 'error')).toBe(true);
	});
});
