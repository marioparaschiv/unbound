import { afterEach, describe, expect, test } from 'bun:test';
import type { NativeUIScope } from '@unbound-app/types';

import {
	NativeBridgeDisposedError,
	NativeBridgeUnavailableError,
	bridge,
	createPluginContext,
	manifest,
	resetNativeFixtures,
} from '../helpers/native-bridge';

const { uiScopePaths } = await import('~/native/ui');

afterEach(() => {
	resetNativeFixtures();
});

describe('native UI scopes', () => {
	test('allows only the synchronous methods a plugin declares', () => {
		const paths = uiScopePaths([
			'native.objc.invoke',
			'native.objc.hooks',
			'native.objc.batch',
		]);

		expect(paths).toContain('objc.invoke');
		expect(paths).toContain('objc.hook');
		expect(paths).not.toContain('objc.invokeAsync');
		expect(paths).not.toContain('objc.batch');
		expect(paths).not.toContain('objc.getClass');
		expect(paths).not.toContain('objc.prepare');
		expect(paths).not.toContain('objc.invokePrepared');
		expect(paths).not.toContain('objc.disposePlan');
	});

	test('opens scopes through the loader and disposes them with the plugin', () => {
		const requested: (readonly string[])[] = [];
		let disposed = 0;
		const scope: NativeUIScope = {
			dispose: () => {
				disposed++;
			},
		};

		Object.assign(bridge.objc, {
			createUIScope: (paths: readonly string[]) => {
				requested.push(paths);

				return scope;
			},
		});

		const context = createPluginContext({
			...manifest,
			capabilities: ['native.objc.invoke'],
		});

		expect(context.native.ui.createScope()).toBe(scope);
		expect(requested).toEqual([
			['objc.create', 'objc.call', 'objc.callSuper', 'objc.invoke', 'objc.invokeSuper'],
		]);
		context.dispose();
		expect(disposed).toBe(1);
		expect(() => context.native.ui.createScope()).toThrow(NativeBridgeDisposedError);
	});

	test('reports a platform without a native namespace as unavailable', () => {
		Object.assign(bridge, { objc: undefined });
		const context = createPluginContext({ ...manifest, capabilities: [] });

		expect(() => context.native.ui.createScope()).toThrow(NativeBridgeUnavailableError);
		context.dispose();
	});
});
