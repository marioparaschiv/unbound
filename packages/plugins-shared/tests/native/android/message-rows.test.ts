import type {
	NativeJavaBridge,
	NativeJavaReference,
	NativeJavaValue,
	NativeUIBridge,
	NativeUIScope,
} from '@unbound-app/api/native';
import {
	createFakeJava,
	installAddonGlobals,
	withMissingMembers,
	type JavaPlain,
} from '@unbound-app/api/testing';
import { afterEach, describe, expect, test } from 'bun:test';

import { watchMessageRows, type MessageRows } from '~/native/android/message-rows';

installAddonGlobals();

const MESSAGE_VIEW = 'com.discord.chat.presentation.message.MessageView';
const MESSAGE = 'com.discord.chat.bridge.Message';
const INVISIBLE = 4;

type Drawn = { row: string; messageId: string };

function fakeAndroid() {
	const fake = createFakeJava();
	const lists = new Map<JavaPlain, JavaPlain[]>();
	const list = (self: JavaPlain) => lists.get(self) ?? [];
	const hidden: string[] = [];

	fake.registerClass('java.util.ArrayList', {
		methods: {
			add: (self, item) => {
				lists.set(self, [...list(self), item]);

				return true;
			},
			size: (self) => list(self).length,
			get: (self, index) => list(self)[Number(index)],
		},
	});
	fake.registerClass('android.widget.FrameLayout', {
		methods: {
			setVisibility: (self, value) => {
				if (value === INVISIBLE) {
					hidden.push(String(Reflect.get(self, 'id')));
				}

				return null;
			},
		},
	});
	fake.registerClass(MESSAGE);
	// MessageView as Discord 353.1 ships it: its widest bind `f` first stores the message id in `x`, its only `String` field.
	fake.registerClass(MESSAGE_VIEW, {
		methods: {
			b: () => null,
			f: (self, message) => {
				java.setField(self, 'x', {
					type: 'string',
					value: String(Reflect.get(message as object, 'fields').get('id')),
				});

				return null;
			},
			onSizeChanged: () => null,
		},
		fields: { E: false, H: false, K: null, x: null },
		fieldTypes: { E: 'boolean', H: 'boolean', K: 'java.util.ArrayList', x: 'java.lang.String' },
		signatures: {
			b: { parameters: [MESSAGE, 'd9.b', 'k9.v', 'ga.c'] },
			f: {
				parameters: [
					MESSAGE,
					'ga.c',
					'd9.b',
					'r9.c',
					'kotlin.jvm.functions.Function0',
					'boolean',
					'boolean',
				],
			},
			onSizeChanged: { parameters: ['int', 'int', 'int', 'int'] },
		},
	});

	// No activity has resumed, so the startup scan finds nothing on screen.
	fake.registerClass('app.unbound.android.ActivityTracker', { staticFields: { INSTANCE: null } });

	const java: NativeJavaBridge = fake.bridge;
	const scope: NativeUIScope = { java, hooks: fake.hooks, dispose: () => undefined };
	// Worklets run on this thread against the fake bridges.
	const ui = withMissingMembers<NativeUIBridge>('ui', {
		createScope: () => scope,
		run: (worklet, ...args) => worklet(...args),
	});

	return {
		native: { java, hooks: fake.hooks, ui },
		hidden,
		row: () => fake.create(MESSAGE_VIEW) as NativeJavaReference,
		host: () => fake.create('android.widget.FrameLayout') as NativeJavaReference,
		bind(row: NativeJavaReference, id: string) {
			java.invoke(row, 'f', [fake.create(MESSAGE, { id })]);
		},
		resize(row: NativeJavaReference) {
			java.invoke(
				row,
				'onSizeChanged',
				[1, 1, 0, 0].map((value) => ({ type: 'int', value })),
			);
		},
	};
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 5));
const key = (row: NativeJavaReference) =>
	String((row as NativeJavaValue & { value: string }).value);

let watching: MessageRows | undefined;

afterEach(async () => {
	await watching?.dispose();
	watching = undefined;
});

describe('watchMessageRows', () => {
	test('draws a row once Discord binds it, with the id the bind left on the row', async () => {
		const android = fakeAndroid();
		const drawn: Drawn[] = [];
		const row = android.row();

		watching = watchMessageRows(android.native, {
			draw: async (view, messageId) => void drawn.push({ row: key(view), messageId }),
			clear: async () => {},
		});
		android.bind(row, 'm1');
		await settle();

		expect(drawn).toEqual([{ row: key(row), messageId: 'm1' }]);
	});

	test('skips a queued draw for a message the row no longer shows', async () => {
		const android = fakeAndroid();
		const drawn: string[] = [];
		const row = android.row();
		let release = () => {};

		watching = watchMessageRows(android.native, {
			async draw(_view, messageId) {
				drawn.push(messageId);

				if (messageId === 'm1') {
					await new Promise<void>((resolve) => (release = resolve));
				}
			},
			clear: async () => {},
		});
		android.bind(row, 'm1');
		await settle();
		android.bind(row, 'm2');
		await settle();
		android.bind(row, 'm3');
		await settle();
		release();
		await settle();

		expect(drawn).toEqual(['m1', 'm3']);
	});

	test('draws again once a row that was not laid out changes size', async () => {
		const android = fakeAndroid();
		const drawn: string[] = [];
		const row = android.row();

		watching = watchMessageRows(android.native, {
			draw: async (_view, messageId) => {
				drawn.push(messageId);

				return drawn.length > 1;
			},
			clear: async () => {},
		});
		android.bind(row, 'm1');
		await settle();
		android.resize(row);
		await settle();
		android.resize(row);
		await settle();

		expect(drawn).toEqual(['m1', 'm1']);
	});

	test('hides the views drawn for one message as soon as the row binds another', async () => {
		const android = fakeAndroid();
		const row = android.row();
		const host = android.host();

		watching = watchMessageRows(android.native, {
			draw: async (view, messageId) => watching?.markDrawn(view, messageId, [host]),
			clear: async () => {},
		});
		android.bind(row, 'm1');
		await settle();
		android.bind(row, 'm1');

		expect(android.hidden).toEqual([]);

		android.bind(row, 'm2');

		expect(android.hidden).toEqual([key(host)]);
	});

	test('redraws only the rows that show a message', async () => {
		const android = fakeAndroid();
		const drawn: string[] = [];
		const [first, second] = [android.row(), android.row()];

		watching = watchMessageRows(android.native, {
			draw: async (_view, messageId) => void drawn.push(messageId),
			clear: async () => {},
		});
		android.bind(first, 'm1');
		android.bind(second, 'm2');
		await settle();
		watching.redraw('m2');
		await settle();

		expect(drawn).toEqual(['m1', 'm2', 'm2']);
	});

	test('waits for draws in flight, then clears every row it drew on', async () => {
		const android = fakeAndroid();
		const events: string[] = [];
		const row = android.row();

		watching = watchMessageRows(android.native, {
			async draw() {
				await settle();
				events.push('drawn');
			},
			clear: async (view) => void events.push(`cleared ${key(view)}`),
		});
		android.bind(row, 'm1');
		await new Promise((resolve) => setTimeout(resolve, 0));
		await watching.dispose();
		watching = undefined;
		android.bind(row, 'm2');
		await settle();

		expect(events).toEqual(['drawn', `cleared ${key(row)}`]);
	});
});
