import { expect, test } from 'bun:test';

import findToastContainers from './find-toast-containers';

const component = () => null;

type ContainerModule = { default?: typeof component; ToastContainer?: typeof component };

function byPaths(modules: Record<string, ContainerModule>) {
	return (path: string) => modules[path];
}

test('replaces both the app container and the design system container', () => {
	const app = { default: component };
	const mana = { ToastContainer: component };
	const targets = findToastContainers(
		byPaths({
			'modules/toast/native/AppToastContainer.tsx': app,
			'design/mana/components/Toast/ToastContainer.native.tsx': mana,
		}),
		() => {
			throw new Error('The export fallback should not run.');
		},
	);

	expect(targets).toEqual([
		[app, 'default'],
		[mana, 'ToastContainer'],
	]);
});

test('replaces the design system container when the app container is missing', () => {
	const mana = { ToastContainer: component };
	const targets = findToastContainers(
		byPaths({ 'design/mana/components/Toast/ToastContainer.native.tsx': mana }),
		() => undefined,
	);

	expect(targets).toEqual([[mana, 'ToastContainer']]);
});

test('falls back to a memoized ToastContainer export', () => {
	const memo = { type: component };
	const targets = findToastContainers(
		() => undefined,
		(name) => (name === 'ToastContainer' ? { ToastContainer: memo } : undefined),
	);

	expect(targets).toEqual([[memo, 'type']]);
});

test('finds nothing when Discord has no toast container', () => {
	expect(
		findToastContainers(
			() => undefined,
			() => undefined,
		),
	).toEqual([]);
});
