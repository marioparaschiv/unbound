import type { TransformPluginContext, TransformResult } from 'rollup';
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { needsWorklets } from '~/rollup/needs-worklets';
import { worklets } from '~/rollup/worklets';

import { createTempDir } from '../helpers/ubd';

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
	test('workletizes a useAnimatedStyle callback that has no directive', async () => {
		const code = await transform(
			"import { useAnimatedStyle } from 'react-native-reanimated'; export const useStyle = (offset) => useAnimatedStyle(() => ({ opacity: offset.value }));",
		);

		expect(code).toContain('__workletHash');
		expect(code).toContain('__initData');
		expect(code).toContain('const{offset}=this.__closure');
	});

	test('parenthesizes worklet code, which react-native-worklets evals as is', async () => {
		const code = await transform("export function f(a) { 'worklet'; return a + 1; }");

		expect(code).toContain('code: "(function f_indexJs1(a){return a+1;})"');
		expect(code).not.toContain('code: "function');
	});

	test('still compiles modules with a worklet directive in either quote style', async () => {
		expect(await transform("export function f() { 'worklet'; return 1; }")).toContain(
			'__workletHash',
		);
		expect(needsWorklets('function f() { "worklet"; }', '/a.js')).toBe(true);
		expect(needsWorklets("'worklet'; export const f = () => 1;", '/a.js')).toBe(true);
	});

	test('leaves modules without worklets alone', async () => {
		expect(await transform('export const value = 1;')).toBeNull();
		expect(
			await transform("const worklet = 'worklet'; export const s = useState(() => 1);"),
		).toBeNull();
		expect(await transform('export const t = withTiming(1, { duration: 200 });')).toBeNull();
	});

	test('matches hooks by name wherever they come from, as the Reanimated plugin does', async () => {
		const code = await transform(
			"import { useAnimatedStyle } from './my-hooks'; export const s = useAnimatedStyle(() => ({ opacity: 1 }));",
		);

		expect(code).toContain('__workletHash');
		expect(needsWorklets('lib.useDerivedValue(() => 1);', '/a.js')).toBe(true);
		expect(needsWorklets('(0, r.runOnUI)(() => {})();', '/a.js')).toBe(true);
		expect(needsWorklets('useAnimatedStyleish(() => ({}));', '/a.js')).toBe(false);
		expect(needsWorklets('lib.useAnimated(() => ({}));', '/a.js')).toBe(false);
	});

	test('checks the argument positions each hook workletizes', () => {
		expect(needsWorklets('withTiming(1, {}, (done) => {});', '/a.js')).toBe(true);
		expect(needsWorklets('withTiming(() => 1);', '/a.js')).toBe(false);
		expect(needsWorklets('useAnimatedReaction(() => 1, (v) => {});', '/a.js')).toBe(true);
		expect(needsWorklets('useAnimatedScrollHandler({ onScroll: (e) => {} });', '/a.js')).toBe(
			true,
		);
		expect(needsWorklets('useAnimatedStyle({ opacity: 1 });', '/a.js')).toBe(false);
		expect(needsWorklets('const f = () => ({}); useAnimatedStyle(f);', '/a.js')).toBe(true);
		expect(needsWorklets('useAnimatedStyle((() => ({})) as never);', '/a.ts')).toBe(true);
	});

	test('catches gesture builder callbacks', async () => {
		const code = await transform(
			"import { Gesture } from 'react-native-gesture-handler'; export const pan = Gesture.Pan().minDistance(1).onUpdate((e) => { e.translationX; });",
		);

		expect(code).toContain('__workletHash');
		expect(needsWorklets('Gesture.Tap().onEnd(function () {});', '/a.js')).toBe(true);
		expect(needsWorklets('emitter.onUpdate(() => {});', '/a.js')).toBe(false);
		expect(needsWorklets('Gesture.Swipe().onUpdate(() => {});', '/a.js')).toBe(false);
	});

	test('catches layout animation callbacks, worklet classes and context objects', () => {
		expect(needsWorklets('FadeIn.duration(300).withCallback((done) => {});', '/a.js')).toBe(
			true,
		);
		expect(needsWorklets('new ZoomIn().withCallback(() => {});', '/a.js')).toBe(true);
		expect(needsWorklets('Toast.withCallback(() => {});', '/a.js')).toBe(false);
		expect(needsWorklets('class A { __workletClass = true; }', '/a.js')).toBe(true);
		expect(needsWorklets('const o = { __workletContextObject: true };', '/a.js')).toBe(true);
		expect(needsWorklets('const { __workletContextObject } = o;', '/a.js')).toBe(false);
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

	test('compiles worklet classes from a plugin that does not install the Babel plugins they need', async () => {
		const plugin = createTempDir();
		const cwd = process.cwd();

		process.chdir(plugin.path);

		try {
			const code = await transform(
				'export class Counter { __workletClass = true; count = 0; increment() { return ++this.count; } }',
				join(plugin.path, 'src', 'index.js'),
			);

			expect(code).toContain('Counter__classFactory');
		} finally {
			process.chdir(cwd);
			plugin.remove();
		}
	});
});
