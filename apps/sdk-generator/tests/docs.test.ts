import { describe, expect, test } from 'bun:test';
import { basename, join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { generateDocs, listDocsEntryPoints } from '../src/docs';
import { API_SRC } from '../src/paths';

type Reflection = {
	id: number;
	name: string;
	kind: number;
	children?: Reflection[];
};

const FUNCTION_KIND = 64;

// UNKNOWN: walks TypeDoc's serialized JSON, whose nodes have no common shape.
function referenceNames(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.flatMap(referenceNames);
	}

	if (typeof value !== 'object' || value === null) {
		return [];
	}

	const own =
		'type' in value && value.type === 'reference' && 'name' in value
			? [String(value.name)]
			: [];

	return [...own, ...Object.values(value).flatMap(referenceNames)];
}

describe('listDocsEntryPoints', () => {
	test('documents every module, global first and the internal types last', () => {
		const names = listDocsEntryPoints(API_SRC).map((path) => path.slice(API_SRC.length + 1));

		expect(names[0]).toBe('global.d.ts');
		expect(names.at(-1)).toBe('_internal.d.ts');
		expect(names).toContain('plugins.d.ts');
		expect(names).toContain('metro/index.d.ts');
		expect(names).not.toContain('index.d.ts');
	});
});

describe('generateDocs', () => {
	test(
		'documents the real SDK with zero warnings',
		async () => {
			const outDir = mkdtempSync(join(tmpdir(), 'sdk-docs-'));
			// generateDocs throws when TypeDoc reports any warning or error.
			const { path, manifest } = await generateDocs('main', { outDir });
			const project: Reflection = await Bun.file(path).json();
			const plugins = project.children?.find((child) => child.name === 'plugins');
			const update = plugins?.children?.find((child) => child.name === 'update');

			expect(basename(path)).toBe('main.json');
			expect(manifest).toEqual({ package: 'api', versions: ['main'] });
			const modules = project.children?.map((child) => child.name);
			const types = project.children?.find((child) => child.name === 'types');

			expect(modules).toContain('global');
			expect(modules).not.toContain('_internal');
			expect(types?.children?.some((child) => child.name === 'AddonHandle')).toBe(true);
			expect(update?.kind).toBe(FUNCTION_KIND);

			const json = await Bun.file(path).text();
			const unbound = project.children
				?.find((child) => child.name === 'global')
				?.children?.find((child) => child.name === 'UnboundGlobal');
			const assets = unbound?.children?.find((child) => child.name === 'assets') as
				| { type: { name: string; target: number } }
				| undefined;

			expect(json).not.toContain('"__module"');
			expect(referenceNames(project).filter((name) => /\$\d+(\.|$)/.test(name))).toEqual([]);
			expect(json).toContain('"name":"Plugin"');
			expect(assets?.type.name).toBe('assets');
			expect(assets?.type.target).toBe(
				project.children?.find((child) => child.name === 'assets')?.id,
			);
		},
		{ timeout: 120_000 },
	);
});
