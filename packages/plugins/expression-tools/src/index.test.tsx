import { expect, mock, test } from 'bun:test';

type PatchContext = { args: unknown[] };

let beforeOpenLazy: ((context: PatchContext) => void) | null = null;
let sheetPatches = 0;

mock.module('@unbound-app/api', () => ({
	metro: {
		components: {},
		findByFilePath: () => null,
		findByProps: (name: string) => (name === 'openLazy' ? { openLazy() {} } : null),
	},
	patcher: {
		before(_target: unknown, method: string, handler: typeof beforeOpenLazy) {
			if (method === 'openLazy') beforeOpenLazy = handler;
			return () => {
				beforeOpenLazy = null;
			};
		},
		after() {
			sheetPatches++;
			return () => {
				sheetPatches--;
			};
		},
	},
	toasts: {},
}));

const plugin = (await import('./index')).default;

test('does not patch a lazily resolved expression sheet after stop', async () => {
	plugin.start();
	let resolve!: (module: { default: () => null }) => void;
	const pending = new Promise<{ default: () => null }>((done) => {
		resolve = done;
	});
	beforeOpenLazy?.({ args: [pending, 'EmojiDetailActionSheet'] });
	plugin.stop();
	const module = { default: () => null };
	resolve(module);
	await Promise.resolve();
	expect(sheetPatches).toBe(0);
	plugin.start();
	beforeOpenLazy?.({ args: [Promise.resolve(module), 'EmojiDetailActionSheet'] });
	await Promise.resolve();
	expect(sheetPatches).toBe(1);
	plugin.stop();
	expect(sheetPatches).toBe(0);
});
