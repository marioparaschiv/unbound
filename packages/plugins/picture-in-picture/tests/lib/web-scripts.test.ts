import { describe, expect, test } from 'bun:test';

import {
	PIP_REQUEST,
	PIP_RESULT,
	frameScript,
	readPipResult,
	requestScript,
} from '~/lib/web-scripts';

describe('web player scripts', () => {
	test('scripts are valid JavaScript that end in true', () => {
		for (const script of [frameScript(), requestScript('enter'), requestScript('leave')]) {
			expect(() => new Function(script)).not.toThrow();
			expect(script.trim().endsWith('true;')).toBe(true);
		}
	});

	test('the request names the action it asks for', () => {
		expect(requestScript('enter')).toContain(`${PIP_REQUEST}: 'enter'`);
		expect(requestScript('leave')).toContain(`${PIP_REQUEST}: 'leave'`);
	});

	test('reads a frame answer and ignores other messages', () => {
		expect(readPipResult(JSON.stringify({ [PIP_RESULT]: true }))).toBe(true);
		expect(readPipResult(JSON.stringify({ [PIP_RESULT]: false }))).toBe(false);
		expect(readPipResult(JSON.stringify({ [PIP_RESULT]: 'ended' }))).toBe('ended');
		expect(readPipResult(JSON.stringify({ type: 'onReady' }))).toBeUndefined();
		expect(readPipResult('{"unboundPictureInPictureResult":')).toBeUndefined();
		expect(readPipResult(undefined)).toBeUndefined();
	});
});
