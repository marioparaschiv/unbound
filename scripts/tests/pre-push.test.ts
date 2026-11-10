import { describe, expect, test } from 'bun:test';

import { loadProjects } from '~/workspaces';
import { checksFor } from '~/pre-push';

const projects = loadProjects();
const labels = (files: string[]) => checksFor(files, projects).map((check) => check.label);

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
			'packages/plugins-shared tests',
			'packages/plugins-shared type-check',
		]);
	});

	test('checks every plugin, isolated, when the plugins root changes', () => {
		expect(labels(['packages/plugins/package.json'])).toEqual([
			'plugin tests',
			'plugin type-check',
		]);
	});

	test('runs a workspace package once however many files changed', () => {
		expect(
			labels(['packages/plugin-scripts/src/a.ts', 'packages/plugin-scripts/src/b.ts']),
		).toEqual(['packages/plugin-scripts tests', 'packages/plugin-scripts type-check']);
	});

	test('runs the client tests in isolation', () => {
		const [check] = checksFor(['packages/client/src/core/index.ts'], projects);

		expect(check?.command).toEqual(['bun', 'test', '--parallel']);
	});

	test('checks a client script with the client and its own config', () => {
		expect(labels(['packages/client/scripts/build/index.ts'])).toEqual([
			'packages/client tests',
			'packages/client type-check',
			'packages/client/scripts/build type-check',
		]);
	});

	test('only type-checks apps and lints the loader', () => {
		expect(labels(['apps/web/app/root.tsx', 'packages/loader/core/src/a.cpp'])).toEqual([
			'apps/web type-check',
			'loader lint',
		]);
	});

	// Its Postgres suites skip without a database, as they do outside CI.
	test('tests and type-checks the Discord bot', () => {
		expect(labels(['apps/discord-bot/src/index.ts'])).toEqual([
			'apps/discord-bot tests',
			'apps/discord-bot type-check',
		]);
	});

	test('type-checks the repo scripts and their lint rules', () => {
		expect(labels(['scripts/oxlint/plugin.ts'])).toEqual([
			'scripts type-check',
			'scripts/oxlint type-check',
		]);
	});

	test('checks nothing for files outside every project', () => {
		expect(labels(['README.md', 'packages/missing/src/a.ts'])).toEqual([]);
	});

	test('lints the loader for workflow changes but not for its docs', () => {
		expect(labels(['.github/workflows/loader-ci.yml'])).toEqual(['loader lint']);
		expect(labels(['packages/loader/README.md'])).toEqual([]);
	});
});
