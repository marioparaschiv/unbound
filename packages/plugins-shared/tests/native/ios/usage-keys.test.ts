import type { NativeObjCBridge } from '@unbound-app/api/native';
import { describe, expect, test } from 'bun:test';

import { declaredUsageKeys, declaresUsage } from '~/native/ios/usage-keys';

function bridgeWith(info: Record<string, unknown> | undefined): NativeObjCBridge {
	const handle = Object.create(null);

	return {
		getClass: () => handle,
		call: () => handle,
		invoke: () => info,
	} as unknown as NativeObjCBridge;
}

describe('declaredUsageKeys', () => {
	test('lists only usage keys with a description, sorted', () => {
		const objc = bridgeWith({
			NSMicrophoneUsageDescription: 'Voice',
			NSCameraUsageDescription: 'Photos',
			NSLocationUsageDescription: 1,
			CFBundleName: 'Discord',
		});

		expect(declaredUsageKeys(objc)).toEqual([
			'NSCameraUsageDescription',
			'NSMicrophoneUsageDescription',
		]);
	});

	test('is empty when the bundle has no info dictionary', () => {
		expect(declaredUsageKeys(bridgeWith(undefined))).toEqual([]);
	});
});

describe('declaresUsage', () => {
	test('answers for one key', () => {
		const objc = bridgeWith({ NSSpeechRecognitionUsageDescription: 'Transcripts' });

		expect(declaresUsage(objc, 'NSSpeechRecognitionUsageDescription')).toBe(true);
		expect(declaresUsage(objc, 'NSCameraUsageDescription')).toBe(false);
	});
});
