import { expect, mock, test } from 'bun:test';

type Handler = (context: { args: unknown[]; result?: unknown }) => unknown;

const installed = new Set<string>();
let openLazyHandler: Handler | undefined;

function patch(kind: string) {
	return (target: object, method: string, handler: Handler) => {
		const key = `${kind}:${method}`;

		installed.add(key);
		if (method === 'openLazy') openLazyHandler = handler;

		return () => installed.delete(key);
	};
}

class ErrorBoundary {
	render() {
		return null;
	}
}

mock.module('@unbound-app/api', () => ({
	metro: {
		findByName: (name: string) => (name === 'ErrorBoundary' ? ErrorBoundary : undefined),
		findByProps: (...props: unknown[]) =>
			props.includes('openLazy')
				? { openLazy() {}, hideActionSheet() {} }
				: { useNavigationBuilder() {} },
	},
	patcher: { after: patch('after'), before: patch('before') },
}));
mock.module('@unbound-plugins/shared/metro/when-loaded', () => ({
	whenLoaded: (file: string) => {
		installed.add(`waiting:${file}`);

		return () => installed.delete(`waiting:${file}`);
	},
}));
mock.module('react-native', () => ({ NativeModules: {}, View: 'View' }));

const { startRotation } = await import('~/rotation');

test('removes every rotation it applied when it stops', () => {
	const stop = startRotation();

	expect([...installed].sort()).toEqual([
		'after:render',
		'before:openLazy',
		'before:useNavigationBuilder',
		'waiting:modules/main_tabs_v2/native/tabs/settings/Settings.tsx',
		'waiting:modules/main_tabs_v2/native/tabs/you/YouAccountActionSheet.tsx',
		'waiting:modules/main_tabs_v2/native/tabs/you/YouScreen.tsx',
	]);

	stop();

	expect(installed.size).toBe(0);
});

test('leaves an action sheet that resolves after it stops unrotated', async () => {
	const stop = startRotation();
	let resolve!: (module: { default: () => null }) => void;
	const args: unknown[] = [new Promise((done) => (resolve = done))];

	openLazyHandler?.({ args });
	stop();

	const module = { default: () => null };

	resolve(module);

	expect(await args[0]).toBe(module);
});
