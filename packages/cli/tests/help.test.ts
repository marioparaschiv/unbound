import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import { groupCommands, groups, mcpTools, rootCommands } from '../src/registry';

function ubd(...args: string[]) {
	return spawnSync(process.execPath, [join(import.meta.dir, '../src/index.ts'), ...args], {
		encoding: 'utf8',
		env: { ...process.env, NO_COLOR: '1' },
	});
}

describe('the ubd layout', () => {
	test('--help lists the root commands and every group, not the grouped commands', () => {
		const result = ubd('--help');

		expect(result.status).toBe(0);
		expect(result.stdout).toContain('debug <command>');
		expect(result.stdout).toContain('device <command>');
		expect(result.stdout).toMatch(/^\s+mcp\s/m);
		expect(result.stdout).not.toMatch(/^\s+eval\s/m);
	});

	test('a bare group lists its commands', () => {
		const result = ubd('debug');

		expect(result.status).toBe(0);
		expect(result.stdout).toMatch(/^\s+eval\s/m);
		expect(result.stdout).toContain('ubd debug start');
	});

	test('a grouped command prints help under its full name', () => {
		const result = ubd('debug', 'eval', '--help');

		expect(result.status).toBe(0);
		expect(result.stdout).toContain('ubd debug eval');
	});

	test('a command that moved into a group names its new place', () => {
		const result = ubd('eval', '1');

		expect(result.status).toBe(2);
		expect(result.stderr).toContain('Did you mean ubd debug eval?');
	});

	test('an unknown command in a group exits 2', () => {
		const result = ubd('device', 'nope');

		expect(result.status).toBe(2);
		expect(result.stderr).toContain('Unknown command: ubd device nope.');
	});

	test('names are unique within the root, each group and the MCP tools', () => {
		const names = [rootCommands, ...groups.map(groupCommands)].map((list) =>
			list.map((definition) => definition.name),
		);
		const tools = mcpTools().map((tool) => tool.name);

		for (const list of [...names, tools]) {
			expect(new Set(list).size).toBe(list.length);
		}

		expect(tools).toContain('eval');
		expect(tools).toContain('device_install');
	});
});
