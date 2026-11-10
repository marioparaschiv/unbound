import { describe, expect, test } from 'bun:test';

import { loadProjects, loadWorkspaces, publishOrder, workspaceDependencies } from '~/workspaces';

describe('workspaces', () => {
	test('publishes every public workspace after its workspace dependencies', () => {
		const { manifests, dirs } = loadWorkspaces();
		const order = publishOrder();

		expect(order.length).toBeGreaterThan(0);

		for (const [index, dir] of order.entries()) {
			const manifest = manifests.get(dir);

			if (!manifest) {
				throw new Error(`${dir} is not a workspace.`);
			}

			expect(manifest.private).toBeFalsy();

			for (const dependency of workspaceDependencies(manifest, dirs)) {
				if (!manifests.get(dependency)?.private) {
					expect(order.indexOf(dependency)).toBeLessThan(index);
				}
			}
		}
	});

	test('rejects a workspace specifier no workspace provides', () => {
		const manifest = {
			name: 'a',
			version: '1.0.0',
			dependencies: { missing: 'workspace:*' },
		};

		expect(() => workspaceDependencies(manifest, new Map())).toThrow(
			'No workspace package resolves missing@workspace:*.',
		);
	});

	test('marks the workspaces inside the plugins root as plugins', () => {
		const projects = new Map(loadProjects().map((project) => [project.dir, project]));

		expect(projects.get('packages/plugins/chat-bubbles')?.plugin).toBe(true);
		expect(projects.get('packages/plugins')?.plugin).toBe(false);
		expect(projects.get('packages/plugins-shared')?.plugin).toBe(false);
	});

	test('includes the tooling directories outside the workspaces', () => {
		const dirs = loadProjects().map((project) => project.dir);

		expect(dirs).toContain('scripts');
		expect(dirs).toContain('scripts/oxlint');
		expect(dirs).toContain('apps/discord-typegen');
	});
});
