import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { transformModule } from '../../plugins/refresh';

const root = join(import.meta.dir, '..', '..', '..', '..');
const id = join(root, 'src/ui/settings/example.tsx');

const source = `
import { memo, useState } from 'react';

type RowProps = { label: string };

function Page() {
	const [search] = useState('');

	return <Row label={search} />;
}

function Row({ label }: RowProps) {
	return <Text>{label}</Text>;
}

export const MemoRow = memo(Row);

export default Page;
`;

describe('refresh transform', () => {
	test("creates elements with the global React, never bundling React's own JSX runtime", () => {
		const code = transformModule(source, id, root, '~/hot-refresh/runtime');

		expect(code).toMatch(/React\.createElement\(\s*Row\b/);
		expect(code).not.toContain('jsx-runtime');
	});

	test('rebinds each component to its stable forwarder before the module exports it', () => {
		const code = transformModule(source, id, root, '~/hot-refresh/runtime');
		const rebind = code.search(/Page = \w+\(Page, "src\/ui\/settings\/example\.tsx Page"\)/);

		expect(rebind).toBeGreaterThan(-1);
		expect(code.indexOf('export default Page', rebind)).toBeGreaterThan(rebind);
		expect(code).toMatch(/Row = \w+\(Row, "src\/ui\/settings\/example\.tsx Row"\)/);
	});

	test('binds prelude names the hot runtime exports', async () => {
		const code = transformModule(source, id, root, '~/hot-refresh/runtime');
		const prelude = code.slice(0, code.indexOf('\n'));
		const names = [...prelude.matchAll(/([\w$]+) as [\w$]+/g)].map(([, name]) => name);
		const runtime = await import('~/hot-refresh/runtime');
		const exported = new Set(
			Object.entries(runtime)
				.filter(([, value]) => typeof value === 'function')
				.map(([name]) => name),
		);

		expect(names.length).toBeGreaterThan(0);

		for (const name of names) {
			expect(exported.has(name)).toBe(true);
		}
	});
});
