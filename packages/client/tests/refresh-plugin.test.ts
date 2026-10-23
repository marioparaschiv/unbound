import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { transformModule } from '../scripts/build/plugins/refresh';

const root = join(import.meta.dir, '..');
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
		const code = transformModule(source, id, root, '~/lib/hot/runtime');

		expect(code).toContain('React.createElement(Row');
		expect(code).not.toContain('jsx-runtime');
	});

	test('rebinds each component to its stable forwarder before the module exports it', () => {
		const code = transformModule(source, id, root, '~/lib/hot/runtime');
		const rebind = code.indexOf(
			'Page = __hotCanonical(Page, "src/ui/settings/example.tsx Page")',
		);

		expect(rebind).toBeGreaterThan(-1);
		expect(code.indexOf('export default Page', rebind)).toBeGreaterThan(rebind);
		expect(code).toContain('Row = __hotCanonical(Row, "src/ui/settings/example.tsx Row")');
	});
});
