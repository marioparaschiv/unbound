import { describe, expect, test } from 'bun:test';

import { checksFor } from './pre-push';

const present = new Set([
	'packages/plugins/chat-bubbles/package.json',
	'packages/plugins/chat-bubbles/tsconfig.json',
	'packages/plugin-scripts/package.json',
	'packages/client/package.json',
	'apps/web/package.json',
]);
const exists = (path: string) => present.has(path);
const labels = (files: string[]) => checksFor(files, exists).map((check) => check.label);

describe('pre-push checks', () => {
	test('tests and type-checks a changed plugin', () => {
		expect(labels(['packages/plugins/chat-bubbles/src/ios.ts'])).toEqual([
			'packages/plugins/chat-bubbles tests',
			'packages/plugins/chat-bubbles type-check',
		]);
	});

	test('checks every plugin when shared plugin code changes', () => {
		expect(labels(['packages/plugins-shared/src/native/app-surface.ts'])).toEqual([
			'plugin tests',
			'plugin type-check',
			'packages/plugins-shared type-check',
		]);
	});

	test('runs a workspace package once however many files changed', () => {
		expect(
			labels(['packages/plugin-scripts/src/a.ts', 'packages/plugin-scripts/src/b.ts']),
		).toEqual(['packages/plugin-scripts tests', 'packages/plugin-scripts type-check']);
	});

	test('runs the client tests in isolation', () => {
		const [check] = checksFor(['packages/client/src/index.ts'], exists);

		expect(check?.command).toEqual(['bun', 'test', '--isolate']);
	});

	test('only type-checks apps and skips the loader', () => {
		expect(labels(['apps/web/app/root.tsx', 'packages/loader/core/src/a.cpp'])).toEqual([
			'apps/web type-check',
		]);
	});
});
