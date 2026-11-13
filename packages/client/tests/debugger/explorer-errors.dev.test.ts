import { describe, expect, test } from 'bun:test';

import { explorerError, explorerFailure } from '~/debugger/explorer-errors.dev';

const coded = (code: string, message: string) => Object.assign(new Error(message), { code });

describe('explorerFailure', () => {
	test('keeps an explorer code', () => {
		expect(explorerFailure(explorerError('stale', 'Object a:1 is gone.'))).toEqual({
			error: 'Object a:1 is gone.',
			code: 'stale',
		});
	});

	test('maps the inspector codes, from the code or the message prefix', () => {
		expect(explorerFailure(coded('INSPECTOR_DISABLED', 'Turn on developer mode.'))).toEqual({
			error: 'Turn on developer mode.',
			code: 'disabled',
		});
		expect(explorerFailure(new Error('INSPECTOR_UNAVAILABLE: image not found'))).toEqual({
			error: 'image not found',
			code: 'unavailable',
		});
		expect(explorerFailure(coded('INSPECTOR_UNKNOWN_CLASS', 'No class Foo'))).toEqual({
			error: 'No class Foo',
			code: 'unknown-class',
		});
	});

	test('reads anything else as failed', () => {
		expect(explorerFailure(coded('NATIVE_BRIDGE_ERROR', 'boom'))).toEqual({
			error: 'boom',
			code: 'failed',
		});
		expect(explorerFailure('plain')).toEqual({ error: 'plain', code: 'failed' });
	});
});
