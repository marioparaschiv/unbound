import { afterEach, describe, expect, test } from 'bun:test';
import type { NativeUIScope } from '@unbound-app/types';

import {
	NativePluginDisposedError,
	NativePluginUnavailableError,
	bridge,
	createPluginContext,
	manifest,
	resetNativeFixtures,
} from '../helpers/native-bridge';

const { uiScopePaths } = await import('~/native/ui');

afterEach(() => {
	Reflect.deleteProperty(bridge.objc, 'createUIScope');
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
		expect(() => context.native.ui.createScope()).toThrow(NativePluginDisposedError);
	});

	test('reports a loader without UI scopes as unavailable', () => {
		const context = createPluginContext({ ...manifest, capabilities: [] });

		expect(() => context.native.ui.createScope()).toThrow(NativePluginUnavailableError);
		context.dispose();
	});
});
