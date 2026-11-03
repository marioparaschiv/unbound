import { describe, expect, test } from 'bun:test';

import { sessionProps as android } from '~/players/android/overrides';
import { sessionProps as ios } from '~/players/ios/overrides';
import type { Session } from '~/types';

const session = (phase: Session<string>['phase'], restore = false): Session<string> => ({
	target: 'a',
	phase,
	restore,
});

describe('iOS sessionProps', () => {
	test('sets nothing without a session', () => {
		expect(ios(null, true)).toBeNull();
	});

	test('asks for the window and keeps the video playing while it starts or runs', () => {
		expect(ios(session('starting'), true)).toEqual({
			pictureInPicture: true,
			paused: false,
			repeat: true,
			playWhenInactive: true,
			ignoreSilentSwitch: 'ignore',
			restoreUserInterfaceForPIPStopCompletionHandler: false,
		});
		expect(ios(session('active'), false)).toMatchObject({
			pictureInPicture: true,
			repeat: false,
		});
	});

	test('closes the window while stopping and confirms a restore', () => {
		expect(ios(session('stopping', true), true)).toMatchObject({
			pictureInPicture: false,
			restoreUserInterfaceForPIPStopCompletionHandler: true,
		});
	});
});

describe('Android sessionProps', () => {
	test('sets nothing without a session', () => {
		expect(android(null, true)).toBeNull();
	});

	test('keeps ExoPlayer playing while the activity is paused in the window', () => {
		expect(android(session('active'), false)).toEqual({
			paused: false,
			repeat: false,
			playInBackground: true,
		});
	});
});
