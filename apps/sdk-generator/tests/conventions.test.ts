import { describe, expect, test } from 'bun:test';

import { buildMetroConventions, copyConvention } from '~/conventions';

describe('copyConvention', () => {
	test('rewrites the imports it is given', () => {
		const copy = copyConvention(
			'walk-tree.ts',
			"import type { PredicateResult } from '@unbound-app/types/utils';\nexport type R = PredicateResult;\n",
			{ '@unbound-app/types/utils': '../_types' },
		);

		expect(copy).toContain("from '../_types'");
		expect(copy).not.toContain('@unbound-app/types');
	});

	test('rejects an import the published SDK cannot resolve, naming the file', () => {
		expect(() =>
			copyConvention(
				'conditions.ts',
				"import { createLogger } from '@unbound-app/logger';\n",
			),
		).toThrow("Failed to copy convention conditions.ts: it imports '@unbound-app/logger'");
	});
});

describe('buildMetroConventions', () => {
	const sources: Record<string, string> = {
		'lazy-registry.ts': "const LAZY_MARKER = '__LAZY__';",
		'common.ts': [
			'export const React = window.React;',
			"export const Theme = find(byProps('colors', 'internal'));",
			"const Hidden = find(byProps('private'));",
		].join('\n'),
		'api.ts': [
			'export const Linking = ReactNative.Linking;',
			"export const Messages = find(byProps('sendMessage', 'receiveMessage'));",
		].join('\n'),
	};
	const read = (path: string) => sources[path.split('/').at(-1) ?? ''] ?? '';

	test("reads the lazy marker and each exported lookup's props from the client", () => {
		const text = buildMetroConventions(read);

		expect(text).toContain('export const LAZY_MARKER = "__LAZY__";');
		expect(text).toContain('Theme: ["colors","internal"],');
		expect(text).toContain('Messages: ["sendMessage","receiveMessage"],');
		expect(text).not.toContain('React');
		expect(text).not.toContain('Hidden');
		expect(text).not.toContain('Linking');
	});

	test('rejects a lookup whose props are not string literals', () => {
		const dynamic = { ...sources, 'api.ts': 'export const Messages = find(byProps(name));' };

		expect(() =>
			buildMetroConventions((path) => dynamic[path.split('/').at(-1) ?? ''] ?? ''),
		).toThrow('Failed to read the props of Messages');
	});
});
