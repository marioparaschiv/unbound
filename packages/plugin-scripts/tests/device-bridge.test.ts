import { expect, test } from 'bun:test';

import type { EvalResult, RequestFailureCode } from '@unbound-app/debugger-protocol';

import { connectBridge, isDisconnect, readEvalResult } from '~/device-bridge';

const answered = (value: string): EvalResult => ({ type: 'eval-result', id: '1', ok: true, value });

const failed = (code?: RequestFailureCode): EvalResult => ({
	type: 'eval-result',
	id: '1',
	ok: false,
	error: 'gone',
	...(code ? { code } : {}),
});

function thrownBy(run: () => unknown): unknown {
	try {
		run();
	} catch (error) {
		return error;
	}
}

function fakeClient(results: EvalResult[]) {
	const evaluated: string[] = [];
	const client = {
		isDeviceConnected: true,
		connect: () => {},
		close: () => {},
		evaluate: async (code: string) => {
			evaluated.push(code);

			return results.shift()!;
		},
	};

	return { client, evaluated };
}

test('reads a successful evaluation as its value', () => {
	expect(readEvalResult(answered('42'))).toBe('42');
});

test('reads a dropped device as DeviceDropped with its code', () => {
	for (const code of ['no-device', 'device-disconnected', 'bridge-unreachable'] as const) {
		const error = thrownBy(() => readEvalResult(failed(code)));

		expect(isDisconnect(error)).toBe(true);
		expect(error).toMatchObject({ code, message: 'Device disconnected: gone' });
	}
});

test('reads a timeout or a script error as an evaluation failure, not a drop', () => {
	for (const result of [failed('timeout'), failed()]) {
		const error = thrownBy(() => readEvalResult(result));

		expect(isDisconnect(error)).toBe(false);
		expect(error).toMatchObject({ message: 'Evaluation failed: "gone"' });
	}
});

test('evaluates the script lowered for Hermes and retries one the device dropped', async () => {
	const { client, evaluated } = fakeClient([failed('device-disconnected'), answered('ok')]);

	expect(await connectBridge(0, client).evaluate('const value = 1; value')).toBe('ok');
	expect(evaluated).toEqual(['var value = 1;value;', 'var value = 1;value;']);
});

test('gives up after three reconnects', async () => {
	const { client, evaluated } = fakeClient(Array.from({ length: 5 }, () => failed('no-device')));

	await expect(connectBridge(0, client).evaluate('1')).rejects.toThrow(
		'Device disconnected: gone',
	);
	expect(evaluated.length).toBe(4);
});

test('does not retry a script error', async () => {
	const { client, evaluated } = fakeClient([failed(), answered('ok')]);

	await expect(connectBridge(0, client).evaluate('1')).rejects.toThrow('Evaluation failed');
	expect(evaluated.length).toBe(1);
});
