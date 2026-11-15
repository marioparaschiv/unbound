import { describe, expect, test } from 'bun:test';

import {
	diagnoseScreenShare,
	isScreenShareQuestion,
	SCREEN_SHARE_DIAGNOSES,
} from '~/lib/screen-share-diagnosis';
import { readEntitlements, readTextReport } from '~/lib/notification-diagnosis';
import { renderScreenShareHelp } from '~/lib/screen-share-replies';
import { COLOURS } from '~/lib/constants';

import { messageText } from '../helpers/container-message';

const IOS = {
	unbound: '3.1.0',
	platform: 'iOS',
	install: 'Ad Hoc (BZJHJ764K7) · expires 2027-09-16',
	source: 'Sideloaded (TestFlight build)',
};

describe('isScreenShareQuestion', () => {
	test('matches the ways people say screen share, and nothing else', () => {
		expect(isScreenShareQuestion('screenshare is broken')).toBe(true);
		expect(isScreenShareQuestion('Screen sharing just stops')).toBe(true);
		expect(isScreenShareQuestion("can't share my screen in vc")).toBe(true);
		expect(isScreenShareQuestion('going live does nothing')).toBe(true);
		expect(isScreenShareQuestion('my screen is black')).toBe(false);
		expect(isScreenShareQuestion('share the plugin link')).toBe(false);
	});
});

describe('diagnoseScreenShare', () => {
	test('Android skips the extensions', () => {
		expect(diagnoseScreenShare({ ...IOS, platform: 'Android' })).toBe('android');
	});

	test('LiveContainer cannot run the extension, from the source or the App ID', () => {
		expect(diagnoseScreenShare({ ...IOS, source: '353.0 (LiveContainer (Signed))' })).toBe(
			'livecontainer',
		);
		expect(
			diagnoseScreenShare({
				...IOS,
				entitlements: { 'application-identifier': 'L5435WB698.com.kdt.livecontainer.x' },
			}),
		).toBe('livecontainer');
	});

	test('a broadcast extension without the app group is named', () => {
		expect(
			diagnoseScreenShare({ ...IOS, isolatedExtensions: ['Share', 'BroadcastUpload'] }),
		).toBe('no-app-group');
		expect(diagnoseScreenShare({ ...IOS, isolatedExtensions: ['Share'] })).toBe(
			'no-problem-found',
		);
		expect(diagnoseScreenShare(IOS)).toBe('no-problem-found');
	});

	test('an app signed without any app group cannot share its screen, from the report or Entitlements.xml', () => {
		const grouped = { 'com.apple.security.application-groups': ['group.com.example.discord'] };

		expect(diagnoseScreenShare({ ...IOS, entitlements: {} })).toBe('no-app-group');
		expect(diagnoseScreenShare(IOS, { 'aps-environment': 'production' })).toBe('no-app-group');
		expect(diagnoseScreenShare({ ...IOS, entitlements: grouped })).toBe('no-problem-found');
		expect(readEntitlements(grouped)).toEqual(grouped);
	});

	test('reads the isolated extensions from the Markdown report', () => {
		const report = readTextReport(
			[
				'### Unbound Debug Info',
				'- **Unbound:** v3.1.0',
				'- **Device:** iPhone 16e on iOS 27.3',
				'- **Extensions without the app group:** NotificationService · BroadcastUpload',
			].join('\n'),
		);

		expect(report?.isolatedExtensions).toEqual(['NotificationService', 'BroadcastUpload']);
		expect(report && diagnoseScreenShare(report)).toBe('no-app-group');
	});
});

describe('renderScreenShareHelp', () => {
	test('every diagnosis renders a heading and its fix', () => {
		for (const diagnosis of SCREEN_SHARE_DIAGNOSES) {
			const text = messageText(renderScreenShareHelp(diagnosis));

			expect(text).toStartWith('### ');
			expect(text).toContain(`\`screen share ${diagnosis}\``);
		}
	});

	test('a missing app group warns and says how to re-sign', () => {
		const message = renderScreenShareHelp('no-app-group');

		expect(message.components[0].accent_color).toBe(COLOURS.warning);
		expect(messageText(message)).toContain('**App Groups**');
	});
});
