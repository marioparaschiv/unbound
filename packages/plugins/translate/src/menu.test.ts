import { expect, mock, test } from 'bun:test';

type PatchContext = { args: unknown[]; result?: unknown };

let beforeOpenLazy: ((context: PatchContext) => void) | null = null;
let afterSheet: ((context: PatchContext) => unknown) | null = null;
let copiedText: string | null = null;
let translatedInput: string | null = null;
let hiddenSheet: string | null = null;
const toasts: unknown[] = [];
const sheetsHost = {
	openLazy() {},
	hideActionSheet(key: string) {
		hiddenSheet = key;
	},
};
const ActionSheetRow = Object.assign(function ActionSheetRow() {}, { Icon: function Icon() {} });

mock.module('@unbound-app/api', () => ({
	assets: { getIDByName: () => null },
	metro: {
		common: {
			Clipboard: { setString: async (text: string) => (copiedText = text) },
			React: {
				createElement: (type: unknown, props: Record<string, unknown>) => ({
					type,
					key: props.key,
					props,
				}),
			},
		},
		findByProps: (name: string) => (name === 'openLazy' ? sheetsHost : { ActionSheetRow }),
	},
	patcher: {
		createPatcher: () => ({
			before(_target: unknown, method: string, handler: typeof beforeOpenLazy) {
				if (method === 'openLazy') beforeOpenLazy = handler;
			},
			after(_target: unknown, method: string, handler: typeof afterSheet) {
				if (method === 'default') afterSheet = handler;
			},
			unpatchAll() {
				beforeOpenLazy = null;
				afterSheet = null;
			},
		}),
	},
	toasts: { showToast: (options: unknown) => toasts.push(options) },
}));
mock.module('@translate/api', () => ({
	translateText: async (text: string) => {
		translatedInput = text;
		return 'Translated text';
	},
}));

const { isActionSheetRowGroup, startTranslateMenuPatch, stopTranslateMenuPatch } =
	await import('./menu');

function messageSheet() {
	const row = (label: string) => ({ type: {}, props: { label, onPress: () => undefined } });
	return {
		type: {},
		props: { children: [{ type: {}, props: { hasIcons: true, children: [row('Reply')] } }] },
	};
}

test('recognizes anonymous Discord 347 message action row groups', () => {
	const row = (label: string) => ({ type: {}, props: { label, onPress: () => undefined } });
	const group = {
		type: {},
		props: { hasIcons: true, children: [row('Edit Message'), row('Reply')] },
	};
	const unrelated = { type: {}, props: { hasIcons: true, children: [{ type: {}, props: {} }] } };

	expect(isActionSheetRowGroup(group)).toBe(true);
	expect(isActionSheetRowGroup(unrelated)).toBe(false);
});

test('adds a working translation action and removes it on stop', async () => {
	startTranslateMenuPatch();
	const module = { default: () => null };
	beforeOpenLazy?.({
		args: [
			Promise.resolve(module),
			'TestMessageLongPressActionSheet',
			{ message: { content: 'Hello' } },
		],
	});
	await Promise.resolve();
	const sheet = messageSheet();
	afterSheet?.({ args: [], result: sheet });
	const rows = sheet.props.children[0].props.children;
	expect(rows.length).toBe(2);
	const action = rows[1] as { props: { onPress: () => void } };
	action.props.onPress();
	await Promise.resolve();
	await Promise.resolve();
	expect(translatedInput).toBe('Hello');
	expect(copiedText).toBe('Translated text');
	expect(hiddenSheet).toBe('TestMessageLongPressActionSheet');
	expect(toasts).toContainEqual({ title: 'Translated', content: 'Translated text' });
	stopTranslateMenuPatch();
	expect(afterSheet).toBeNull();
});

test('ignores late sheets after stop and patches the same module after re-enable', async () => {
	startTranslateMenuPatch();
	let resolve!: (module: { default: () => null }) => void;
	const pending = new Promise<{ default: () => null }>((done) => {
		resolve = done;
	});
	beforeOpenLazy?.({
		args: [pending, 'TestMessageLongPressActionSheet', { message: { content: 'Hello' } }],
	});
	stopTranslateMenuPatch();
	const module = { default: () => null };
	resolve(module);
	await Promise.resolve();
	expect(afterSheet).toBeNull();
	startTranslateMenuPatch();
	beforeOpenLazy?.({
		args: [
			Promise.resolve(module),
			'TestMessageLongPressActionSheet',
			{ message: { content: 'Hello' } },
		],
	});
	await Promise.resolve();
	expect(afterSheet).toBeFunction();
	stopTranslateMenuPatch();
});
