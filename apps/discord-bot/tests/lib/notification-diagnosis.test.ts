import { packDebugAltText } from '@unbound-app/contracts/debug-card-alt-text';
import { parsePlist } from '@unbound-app/contracts/plist';
import { describe, expect, test } from 'bun:test';
import { MessageFlags } from 'discord.js';

import {
	diagnoseNotifications,
	DISCORD_APP_ID,
	DISCORD_TEAM_ID,
	isNotificationQuestion,
	readDebugPayload,
	readEntitlements,
	readTextReport,
	type NotificationFacts,
} from '~/lib/notification-diagnosis';
import { readHelpCustomId, renderNotificationHelp } from '~/lib/notification-replies';
import type { HelpView } from '~/lib/notification-instructions';
import { COLOURS } from '~/lib/constants';

import { messageButtons, messageText } from '../helpers/container-message';

const IOS = {
	unbound: '3.1.0',
	platform: 'iOS',
	install: 'Ad Hoc (BZJHJ764K7) · expires 2027-09-16',
	source: 'Sideloaded (TestFlight build)',
};

const TEXT_REPORT = [
	'### Unbound Debug Info',
	'- **Unbound:** v3.1.0 (`e7e5e90e7`), loader 1.3.0 (`Unbound.dylib`) (`ElleKit 1.1.3`)',
	'- **Discord:** 353.0 stable, build 122208 (LiveContainer (Signed))',
	'- **Device:** iPhone 16e on iOS 27.3 (24C5037i)',
	'- **Install:** Development (`L5435WB698`)',
].join('\n');

const PLIST = [
	'<?xml version="1.0" encoding="UTF-8"?>',
	'<plist version="1.0">',
	'<dict>',
	'\t<key>application-identifier</key>',
	'\t<string>L5435WB698.com.kdt.livecontainer.L5435WB698</string>',
	'\t<key>get-task-allow</key>',
	'\t<true/>',
	'</dict>',
	'</plist>',
].join('\n');

describe('isNotificationQuestion', () => {
	test('matches the ways people say notifications, and nothing else', () => {
		expect(isNotificationQuestion('my notifs are broken')).toBe(true);
		expect(isNotificationQuestion('No Notifications on iOS?')).toBe(true);
		expect(isNotificationQuestion('notified me twice')).toBe(false);
	});
});

describe('readDebugPayload', () => {
	test('unpacks the alt text with the entitlements it carries', () => {
		const entitlements = { 'application-identifier': 'BZJHJ764K7.com.skawt.*' };
		const payload = readDebugPayload(
			packDebugAltText({ ...IOS, plugins: '9/9', entitlements }),
		);

		expect(payload).toMatchObject({ ...IOS, entitlements });
	});

	test('reads plain JSON alt text from cards drawn before packing', () => {
		expect(readDebugPayload(JSON.stringify(IOS))?.install).toBe(IOS.install);
	});

	test('rejects alt text that is not a report', () => {
		expect(readDebugPayload('a cat on a keyboard')).toBeUndefined();
		expect(readDebugPayload('ubd1:not packed')).toBeUndefined();
		expect(readDebugPayload('{"platform":"iOS"}')).toBeUndefined();
	});
});

describe('readTextReport', () => {
	test('reads the Markdown report /debug sends without a card', () => {
		expect(readTextReport(TEXT_REPORT)).toMatchObject({
			platform: 'iOS',
			install: 'Development (`L5435WB698`)',
			source: '353.0 stable, build 122208 (LiveContainer (Signed))',
		});
	});

	test('ignores other messages', () => {
		expect(readTextReport('- **Unbound:** is great')).toBeUndefined();
	});
});

describe('diagnoseNotifications', () => {
	test('Android skips the entitlements', () => {
		expect(diagnoseNotifications({ ...IOS, platform: 'Android' }).diagnosis).toBe('android');
	});

	test("Discord's identity without production push is a TrollStore install missing it", () => {
		const stripped = { 'application-identifier': DISCORD_APP_ID };
		const sandbox = { ...stripped, 'aps-environment': 'development' };

		expect(diagnoseNotifications(IOS, stripped).diagnosis).toBe('discord-no-push');
		expect(diagnoseNotifications(IOS, sandbox).diagnosis).toBe('discord-no-push');
	});

	test("Discord's team on another bundle ID is not Discord's identity", () => {
		const other = { 'application-identifier': `${DISCORD_TEAM_ID}.com.example.discord` };

		expect(diagnoseNotifications(IOS, other).diagnosis).toBe('distribution-no-push');
	});

	test("Discord's identity with production push means notifications can arrive", () => {
		const facts = diagnoseNotifications(IOS, {
			'application-identifier': DISCORD_APP_ID,
			'aps-environment': 'production',
		});

		expect(facts).toEqual({
			diagnosis: 'discord-signed',
			team: DISCORD_TEAM_ID,
			push: 'production',
		});
	});

	test('a distribution certificate pushes only with production aps-environment', () => {
		const signed = {
			'application-identifier': '57RZ3XN9V9.app.example',
			'aps-environment': 'production',
		};

		expect(diagnoseNotifications(IOS, signed)).toEqual({
			diagnosis: 'distribution-push',
			team: '57RZ3XN9V9',
			push: 'production',
		});
		expect(
			diagnoseNotifications({
				...IOS,
				entitlements: { 'application-identifier': 'BZJHJ764K7.x' },
			}),
		).toEqual({
			diagnosis: 'distribution-no-push',
			team: 'BZJHJ764K7',
			push: 'none',
		});
	});

	test('get-task-allow or development push means a development certificate', () => {
		const debuggable = {
			'application-identifier': '57RZ3XN9V9.app.example',
			'aps-environment': 'production',
			'get-task-allow': true,
		};
		const sandbox = {
			'application-identifier': '57RZ3XN9V9.app.example',
			'aps-environment': 'development',
		};

		expect(diagnoseNotifications(IOS, debuggable).diagnosis).toBe('development');
		expect(diagnoseNotifications(IOS, sandbox).diagnosis).toBe('development');
		expect(
			diagnoseNotifications({ ...IOS, install: 'Development (ABCDE12345)' }).diagnosis,
		).toBe('development');
	});

	test('a text report with the attached plist diagnoses LiveContainer', () => {
		const report = readTextReport(TEXT_REPORT);

		expect(
			report && diagnoseNotifications(report, readEntitlements(parsePlist(PLIST))),
		).toEqual({
			diagnosis: 'livecontainer',
			team: 'L5435WB698',
			push: 'none',
		});
	});

	test('a wildcard App ID is kept without its team prefix', () => {
		const wildcard = { 'application-identifier': 'BZJHJ764K7.com.skawt.*' };

		expect(diagnoseNotifications(IOS, wildcard)).toEqual({
			diagnosis: 'distribution-no-push',
			team: 'BZJHJ764K7',
			push: 'none',
			appId: 'com.skawt.*',
		});
	});

	test('without entitlements the team comes from the install field', () => {
		expect(diagnoseNotifications(IOS)).toEqual({ diagnosis: 'unreadable', team: 'BZJHJ764K7' });
		expect(diagnoseNotifications({ ...IOS, install: '' }).diagnosis).toBe('unreadable');
	});
});

describe('renderNotificationHelp', () => {
	const facts: NotificationFacts = {
		diagnosis: 'distribution-no-push',
		team: 'ABCDE12345',
		push: 'none',
	};
	const render = (view: HelpView, target = facts) =>
		renderNotificationHelp({ view, askerId: '1', facts: target });

	test('the button switches to the other view and round-trips the facts', () => {
		const wildcard = { ...facts, appId: 'com.skawt.*' };
		const [button] = messageButtons(
			renderNotificationHelp({ view: 'simple', askerId: '123', facts: wildcard }),
		);
		const customId = button && 'custom_id' in button ? button.custom_id : '';

		expect(button && 'label' in button ? button.label : '').toBe('Advanced instructions');
		expect(customId.length).toBeLessThanOrEqual(100);
		expect(readHelpCustomId(customId)).toEqual({
			view: 'advanced',
			askerId: '123',
			facts: wildcard,
		});
	});

	test('both views share the heading and accent; only the body changes', () => {
		const simple = render('simple');
		const advanced = render('advanced');

		expect(simple.flags).toBe(MessageFlags.IsComponentsV2);
		expect(simple.components[0].accent_color).toBe(COLOURS.danger);
		expect(advanced.components[0].accent_color).toBe(COLOURS.danger);
		expect(messageText(simple)).toStartWith('### Push is off in your certificate');
		expect(messageText(advanced)).toStartWith('### Push is off in your certificate');
		expect(messageText(advanced)).toContain('`aps-environment`');
		expect(messageText(simple)).not.toContain('aps-environment');
	});

	test('working installs are positive, and the facts line names the cert, team and push', () => {
		const works = render('simple', {
			diagnosis: 'distribution-push',
			team: 'X',
			push: 'production',
		});

		expect(works.components[0].accent_color).toBe(COLOURS.positive);
		expect(messageText(works)).toContain('-# `cert distribution` `team X` `push production`');
		expect(messageText(render('simple', { ...facts, appId: 'com.skawt.*' }))).toContain(
			'`app id com.skawt.*`',
		);
	});

	test('the distribution advanced view explains PPQ', () => {
		expect(messageText(render('advanced'))).toContain('PPQ');
	});

	test("ignores other buttons' custom ids", () => {
		expect(readHelpCustomId('@sapphire/paginated-messages.stop')).toBeUndefined();
	});
});
