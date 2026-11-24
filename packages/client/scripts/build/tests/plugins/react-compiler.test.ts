import { describe, expect, test } from 'bun:test';

import reactCompiler, { compileModule } from '../../plugins/react-compiler';

const id = '/client/src/ui/example.tsx';

const component = `
function Row({ label }: { label: string }) {
	return <Text>{label}</Text>;
}

export default Row;
`;

describe('react compiler', () => {
	test("memoises a component through React 19's compiler runtime", async () => {
		const stats = { compiled: 0, skipped: 0 };
		const result = await compileModule(component, id, false, stats);

		expect(result?.code).toContain('from "react/compiler-runtime"');
		expect(result?.code).toMatch(/\$\[0\] !== label/);
		expect(stats).toEqual({ compiled: 1, skipped: 0 });
	});

	test("leaves a module that opts out with 'use no memo' as written", async () => {
		const result = await compileModule(`'use no memo';\n${component}`, id, false);

		expect(result?.code).not.toContain('compiler-runtime');
	});

	test("compiles before other transforms, so a dev prelude cannot bury a module's directive", () => {
		const { transform } = reactCompiler(true);

		expect(typeof transform === 'object' && transform.order).toBe('pre');
	});

	test('resets each cache when its file changes only in a dev build', async () => {
		const release = await compileModule(component, id, false);
		const dev = await compileModule(component, id, true);

		expect(release?.code).not.toMatch(/\$\[0\] !== "[0-9a-f]{64}"/);
		expect(dev?.code).toMatch(/\$\[0\] !== "[0-9a-f]{64}"/);
	});
});
