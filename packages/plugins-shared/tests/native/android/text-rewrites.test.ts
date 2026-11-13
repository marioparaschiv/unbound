import type {
	NativeJavaBridge,
	NativeJavaHandle,
	NativeJavaHooksBridge,
	NativeUIArgument,
	NativeUIBridge,
} from '@unbound-app/api/native';
import {
	connectTextRewrites,
	supportsTextRewrites,
	type TextRewriteNative,
} from '@unbound-plugins/shared/native/android/text-rewrites';
import { brand, withMissingMembers } from '@unbound-app/api/testing/fakes';
import { describe, expect, test } from 'bun:test';

type Run = { worklet: string; args: NativeUIArgument[] };

class FakeHandle {
	readonly id: string;

	constructor(id: string) {
		this.id = id;
	}
}

function connect(apiVersion = '1.4.0') {
	const runs: Run[] = [];
	const native: TextRewriteNative = {
		apiVersion,
		java: withMissingMembers<NativeJavaBridge>('java', {}),
		hooks: withMissingMembers<NativeJavaHooksBridge>('hooks', {}),
		ui: withMissingMembers<NativeUIBridge>('ui', {
			createScope: () => ({ dispose() {} }),
			run(worklet, ...args) {
				runs.push({ worklet: worklet.name, args });
			},
			callback: (listener) => listener,
		}),
	};

	return { runs, rewrites: connectTextRewrites(native, 'TextView', { label: 'test' }) };
}

describe('text rewrites', () => {
	test('need native bridge API 1.4.0', () => {
		expect(supportsTextRewrites('1.3.9')).toBe(false);
		expect(supportsTextRewrites('1.4.0')).toBe(true);
		expect(supportsTextRewrites('2.0.0')).toBe(true);
		expect(connect('1.3.0').rewrites).toBeNull();
	});

	test('send JS-thread handles to the UI runtime as tagged handle values', () => {
		const { runs, rewrites } = connect();

		rewrites!.addHost('group', 'rendered', brand<NativeJavaHandle>(new FakeHandle('java-7')), {
			placeholder: 0,
			width: 1,
			height: 1,
		});
		rewrites!.reapply({ type: 'handle', value: 'java-8' });

		expect(runs.find((run) => run.worklet === 'addHost')?.args[3]).toEqual({
			type: 'handle',
			value: 'java-7',
		});
		expect(runs.find((run) => run.worklet === 'reapply')?.args[1]).toEqual({
			type: 'handle',
			value: 'java-8',
		});
	});

	test('keep one rendered text per original, as the loader did', () => {
		const { rewrites } = connect();

		expect(rewrites!.put('a', 'b', [])).toBe(true);
		expect(rewrites!.put('a', 'b', [])).toBe(true);
		expect(rewrites!.put('a', 'c', [])).toBe(false);
	});
});
