import type { TransformPluginContext, TransformResult } from 'rollup';
import { describe, expect, test } from 'bun:test';

import { declaresWorklet, worklets } from '../src/rollup/worklets';

type Transform = (
	this: TransformPluginContext,
	code: string,
	id: string,
) => Promise<TransformResult>;

async function transform(code: string, id = '/plugin/src/index.js') {
	const hook = worklets().transform as Transform;
	const context = Object.create(null) as TransformPluginContext;
	const result = await hook.call(context, code, id);

	return typeof result === 'object' && result ? result.code : result;
}

describe('worklets', () => {
	test('finds the worklet directive in either quote style', () => {
		expect(declaresWorklet("function f() { 'worklet'; }")).toBe(true);
		expect(declaresWorklet('function f() { "worklet"; }')).toBe(true);
		expect(declaresWorklet('const worklet = 1;')).toBe(false);
	});

	test('leaves modules without worklets alone', async () => {
		expect(await transform('export const value = 1;')).toBeNull();
	});

	test('compiles worklets for the Reanimated version Discord ships', async () => {
		const code = await transform(
			"const scope = open(); export function run(a) { 'worklet'; return scope.objc.invoke(a, 'layer', []); }",
		);

		expect(code).toContain('__workletHash');
		expect(code).toContain('version: "3.19.4"');
		expect(code).toContain('const{scope}=this.__closure');
	});

	test('compiles TypeScript worklets before swc can add helpers they cannot call', async () => {
		const code = await transform(
			"export function kind(value: unknown): string { 'worklet'; const [first] = [value]; return typeof first; }",
			'/plugin/src/index.ts',
		);

		expect(code).toContain('typeof first');
		expect(code).not.toContain('this.__closure');
		expect(code).not.toContain(': unknown');
	});
});
