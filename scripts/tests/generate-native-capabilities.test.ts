import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';

import {
	LOADER_OUTPUT,
	renderNativeCapabilities,
	staleNativeCapabilityFiles,
	TYPES_OUTPUT,
} from '~/generate-native-capabilities';

import { NATIVE_BRIDGE_METHOD_CAPABILITIES } from '../../packages/types/typings/native-methods';

function rendered(path: string): string {
	return renderNativeCapabilities().find((file) => file.path === path)?.content ?? '';
}

describe('generated native capability files', () => {
	test('match what the native method table renders; run `bun run generate-native-capabilities`', () => {
		expect(staleNativeCapabilityFiles()).toEqual([]);
	});

	test('reports a generated file edited by hand, and one that is missing', () => {
		const copy = mkdtempSync(join(tmpdir(), 'native-capabilities-'));

		mkdirSync(dirname(join(copy, TYPES_OUTPUT)), { recursive: true });
		writeFileSync(join(copy, TYPES_OUTPUT), `${rendered(TYPES_OUTPUT)}// edited\n`);

		expect(staleNativeCapabilityFiles(copy)).toEqual([TYPES_OUTPUT, LOADER_OUTPUT]);
	});

	test('carry a do-not-edit banner', () => {
		for (const { content } of renderNativeCapabilities()) {
			expect(content.split('\n')[0]).toContain('DO NOT EDIT');
		}
	});

	test('bind every method the loader installs, leaving out the ones the client implements', () => {
		const loader = rendered(LOADER_OUTPUT);

		expect(loader).toContain('{"native.java.hooks", "hooks", kJavaHooksMethods}');
		expect(loader).toContain('std::array<std::string_view, 0> kRuntimeEventsMethods = {\n};');
		expect(loader).not.toContain('"create"');
		expect(Object.keys(NATIVE_BRIDGE_METHOD_CAPABILITIES)).toContain('objc.create');
	});

	test('list each platform only the Capabilities its loader provides', () => {
		const types = rendered(TYPES_OUTPUT);
		const android = types.slice(types.indexOf('android: ['));

		expect(android).not.toContain('native.objc.');
		expect(android).not.toContain('native.fabric.mount');
		expect(types.slice(types.indexOf('ios: ['), types.indexOf('android: ['))).not.toContain(
			'native.java.',
		);
	});
});
