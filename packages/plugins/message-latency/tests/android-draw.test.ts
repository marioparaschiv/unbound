import { flux, metro, native, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import type { JavaPlain } from '@unbound-app/api/testing/fakes';
import type { NativeJavaValue } from '@unbound-app/api/native';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

const MESSAGE_VIEW = 'com.discord.chat.presentation.message.MessageView';
const MESSAGE = 'com.discord.chat.bridge.Message';
const STRING = 'java.lang.String';
const VIEW = 'android.view.View';
const DISCORD_EPOCH = 1_420_070_400_000;
const VISIBLE = 0;
const INVISIBLE = 4;
const CONTAINER = 'test.MessageList';

function snowflake(timestamp: number): string {
	return (BigInt(timestamp - DISCORD_EPOCH) << 22n).toString();
}

const SENT = snowflake(DISCORD_EPOCH + 1_000_000);
const DELAYED = {
	id: SENT,
	nonce: snowflake(DISCORD_EPOCH + 1_000_000 - 10_000),
	author: { id: 'a', username: 'ada' },
};

function fakeUi() {
	const scope = {
		java: native.java.bridge,
		hooks: native.java.hooks,
		dispose: () => undefined,
	};

	return {
		createScope: () => scope,
		run: (task: (scope: unknown, ...args: unknown[]) => void, ...args: unknown[]) =>
			task(scope, ...args.slice(1)),
	};
}

const shown = { id: SENT };

const POLL_MS = 5;
const GIVE_UP_MS = 2000;

// Waits until the draw has mounted the icon, which is the last step the first placement takes.
async function settle(fabric: { mounted: unknown[] }) {
	const deadline = Date.now() + GIVE_UP_MS;

	while (fabric.mounted.length === 0 && Date.now() < deadline) {
		await new Promise((resolve) => setTimeout(resolve, POLL_MS));
	}
}

const calls = (name: string) =>
	native.calls.filter((call) => call.bridge === 'java' && call.name === name);

// Discord's message row: the bind method is the one that takes the message first and has the most parameters.
function registerRow() {
	const header = native.java.create(VIEW);
	const state = { start: null as NativeJavaValue | null, visible: VISIBLE };
	const author = native.java.create(VIEW);
	const authorId = (author as { value: string }).value;
	const resources = native.java.create('android.content.res.Resources');
	const container = native.java.create(CONTAINER);

	native.java.registerClass('android.content.res.Resources', {
		methods: {
			getIdentifier: (_self, name) => (name === 'header' ? 1 : 2),
			getDisplayMetrics: () =>
				native.java.create('android.util.DisplayMetrics', { density: 2 }),
		},
	});
	native.java.registerClass('android.util.DisplayMetrics', { fields: { density: 2 } });
	native.java.registerClass(VIEW, {
		methods: {
			getVisibility: () => state.visible,
			getCompoundDrawablesRelative: () => [null, null, null, null],
			setCompoundDrawablesRelative: (_self, start) => {
				state.start = start as NativeJavaValue;
			},
			requestLayout: () => null,
			getParent: () => container,
			getContext: () => null,
			getResources: () => resources,
			getLeft: () => 0,
			getScrollX: () => 0,
			getTop: () => 0,
			getScrollY: () => 0,
			getHeight: () => 20,
			getPaddingStart: () => 4,
		},
	});
	native.java.registerClass('java.lang.reflect.Array', {
		staticMethods: { get: () => state.start },
	});
	native.java.registerClass('androidx.recyclerview.widget.RecyclerView', {
		staticMethods: { isInstance: () => false },
	});
	native.java.registerClass('android.graphics.drawable.ColorDrawable', {
		methods: { setBounds: () => null },
	});
	native.java.registerClass('android.widget.FrameLayout', {
		methods: {
			getParent: () => null,
			getChildCount: () => 0,
			measure: () => null,
			layout: () => null,
			setTranslationX: () => null,
			setTranslationY: () => null,
			setVisibility: () => null,
			setLayoutParams: () => null,
		},
	});
	native.java.registerClass('android.view.ViewGroup', {
		staticMethods: {
			isInstance: (_self, view) => (view as { className?: string })?.className === CONTAINER,
		},
	});
	native.java.registerClass('android.view.ViewGroup$LayoutParams');
	native.java.registerClass(CONTAINER, {
		methods: {
			getParent: () => null,
			getChildCount: () => 0,
			addView: () => null,
			removeView: () => null,
		},
	});
	native.java.registerClass(MESSAGE);
	const lists = new Map<unknown, JavaPlain[]>();
	const list = (self: unknown) => lists.get(self) ?? [];

	native.java.registerClass('java.util.ArrayList', {
		methods: {
			add: (self, item) => {
				lists.set(self, [...list(self), item]);

				return true;
			},
			size: (self) => list(self).length,
			get: (self, index) => list(self)[Number(index)],
		},
	});
	native.java.registerClass(MESSAGE_VIEW, {
		superclass: VIEW,
		methods: {
			configureAuthor: () => null,
			// Discord's bind keeps the shown message's id in the row's only `String` field.
			setMessage: (self) => {
				native.java.bridge.setField(self, 'messageId', { type: 'string', value: shown.id });

				return null;
			},
			findViewById: (_self, id) => (id === 1 ? header : author),
		},
		staticMethods: { create: () => null },
		fields: { messageId: SENT, tag: 'x' },
		staticFields: { TAG: 'view' },
		signatures: {
			configureAuthor: {
				parameters: [MESSAGE, 'ChatEventHandler', 'ChainPart', 'MessageContext'],
			},
			setMessage: {
				parameters: [
					MESSAGE,
					'MessageContext',
					'ChatEventHandler',
					'ComponentProvider',
					'Function0',
					'boolean',
					'boolean',
				],
				returnType: 'void',
			},
			create: { parameters: [MESSAGE, 'a', 'b', 'c', 'd', 'e', 'f', 'g'] },
		},
		fieldTypes: { messageId: STRING, tag: 'int', TAG: STRING },
	});

	return { authorId, row: native.java.create(MESSAGE_VIEW) };
}

function seedDiscord() {
	flux.seed({ User: { getCurrentUser: () => ({ id: 'me' }) }, Theme: { theme: 'dark' } });
	metro.register({ colors: {}, internal: {}, themes: { DARK: 'dark' } });
	metro.register({ TooltipArrowDirections: {}, TooltipArrowPositions: {} });
	metro.register({ generateMessageRowData: () => ({ message: {} }) });
}

beforeEach(() => {
	shown.id = SENT;
});

// A plugin that is stopped in a test is not stopped again.
const running = { stopped: false };

afterEach(async () => {
	if (!running.stopped) await stopPlugin();

	running.stopped = false;
});

async function startAndroid() {
	const fabric = {
		mounted: [] as unknown[],
		mountAsync: (_host: unknown, _module: string, props: unknown) => {
			fabric.mounted.push(props);

			return Promise.resolve({ surface: true });
		},
		unmountAsync: () => Promise.resolve(),
	};

	native.setPlatform('android');
	native.setCapabilities(['native.java.hooks']);
	seedDiscord();

	const view = registerRow();

	await startPlugin({ native: { ui: fakeUi(), fabric } as never });
	await flux.dispatch({ type: 'MESSAGE_CREATE', message: DELAYED } as never);

	return { ...view, fabric };
}

describe('the latency indicator on Android', () => {
	test('hooks the bind method Discord declares, found by its shape', async () => {
		await startAndroid();

		const hooked = native.calls.filter(
			(call) => call.bridge === 'hooks' && call.method === 'hook',
		);

		// The rebind guard and the draw hook, both on the method that takes the message first and has the most parameters.
		expect(hooked.map((call) => `${call.target}.${call.name}`)).toEqual([
			`${MESSAGE_VIEW}.setMessage`,
			`${MESSAGE_VIEW}.setMessage`,
		]);
	});

	test('draws a spacer for a delayed message, mounts the icon and shows it', async () => {
		const { row, fabric } = await startAndroid();

		native.java.bridge.invoke(row as never, 'setMessage', [native.java.create(MESSAGE)]);
		await settle(fabric);

		expect(calls('setCompoundDrawablesRelative')).toHaveLength(1);
		expect(calls('setBounds')).toHaveLength(1);
		expect(fabric.mounted).toEqual([{ surfaceId: 'message-latency-android-0' }]);
		expect(calls('setVisibility').map((call) => call.args)).toContainEqual([
			{ type: 'int', value: VISIBLE },
		]);
	});

	test('hides the icon when the row rebinds to a message it was not drawn for', async () => {
		const { row, fabric } = await startAndroid();

		native.java.bridge.invoke(row as never, 'setMessage', [native.java.create(MESSAGE)]);
		await settle(fabric);
		shown.id = 'another';
		native.java.bridge.invoke(row as never, 'setMessage', [native.java.create(MESSAGE)]);

		expect(calls('setVisibility').at(-1)?.args).toEqual([{ type: 'int', value: INVISIBLE }]);
	});

	test('takes the spacer back out when the plugin stops', async () => {
		const { row, fabric } = await startAndroid();

		native.java.bridge.invoke(row as never, 'setMessage', [native.java.create(MESSAGE)]);
		await settle(fabric);
		await stopPlugin();
		running.stopped = true;

		const last = calls('setCompoundDrawablesRelative').at(-1)?.args;

		expect(last?.every((arg) => (arg as NativeJavaValue).type === 'null')).toBe(true);
	});
});
