import { expect, mock, test } from 'bun:test';

type PatchContext = { args: unknown[] };

let beforeOpenLazy: ((context: PatchContext) => void) | null = null;
let sheetPatches = 0;
const patcher = {
	before(_target: unknown, method: string, handler: typeof beforeOpenLazy) {
		if (method === 'openLazy') beforeOpenLazy = handler;
	},
	after() {
		sheetPatches++;
	},
	unpatchAll() {
		beforeOpenLazy = null;
		sheetPatches = 0;
	},
};

mock.module('@unbound-app/api', () => ({
	assets: {},
	metro: {
		findByProps(name: string) {
			if (name === 'showContextMenu') return { showContextMenu() {} };
			if (name === 'openLazy') return { openLazy() {} };
			if (name === 'ActionSheetRow') return { ActionSheetRow: function ActionSheetRow() {} };
			return null;
		},
	},
	patcher: { createPatcher: () => patcher },
	toasts: {},
}));

const plugin = (await import('./index')).default;

test('ignores a profile action sheet resolved after stop and patches it on restart', async () => {
	plugin.start();
	let resolve!: (module: { default: () => null }) => void;
	const pending = new Promise<{ default: () => null }>((done) => {
		resolve = done;
	});
	beforeOpenLazy?.({
		args: [pending, 'UserProfileActionSheet', { userId: '123' }],
	});
	plugin.stop();
	const module = { default: () => null };
	resolve(module);
	await Promise.resolve();
	expect(sheetPatches).toBe(0);
	plugin.start();
	beforeOpenLazy?.({
		args: [Promise.resolve(module), 'UserProfileActionSheet', { userId: '123' }],
	});
	await Promise.resolve();
	expect(sheetPatches).toBe(1);
	plugin.stop();
	expect(sheetPatches).toBe(0);
});
