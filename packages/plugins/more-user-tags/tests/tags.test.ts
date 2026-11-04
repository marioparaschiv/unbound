import {
	createFakeReactNative,
	flux,
	metro,
	startPlugin,
	stopPlugin,
} from '@unbound-app/api/testing';
import { resetHealth } from '@unbound-plugins/shared/lifecycle/health';
import { storage } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

// The testing kit's `react-native` has no `AccessibilityInfo`, which the iOS gradient renderer reads at import.
mock.module('react-native', () => ({
	...createFakeReactNative(),
	AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false) },
}));

type TagProperties = { opTagText: string | null; tagText: string | null };

const OWNER_ID = '1';
const PERMISSIONS = { ADMINISTRATOR: 1n, MANAGE_MESSAGES: 2n };

const getTagProperties = {
	name: 'getTagProperties',
	default: (_props: object): TagProperties => ({ opTagText: null, tagText: null }),
};

const permissionsOf = { value: 0n };

function tagFor(message: object) {
	return getTagProperties.default({ message });
}

function webhookMessage() {
	return { id: 'm1', channel_id: 'c1', webhookId: 'w1', author: { id: '9', bot: true } };
}

function memberMessage(id: string) {
	return { id: 'm2', channel_id: 'c1', author: { id } };
}

beforeEach(async () => {
	resetHealth();
	permissionsOf.value = 0n;
	metro.register({ Permissions: PERMISSIONS, ThemeTypes: {} });
	metro.register({ computePermissions: () => permissionsOf.value, canEveryoneRole: () => false });
	metro.register(getTagProperties);

	flux.seed({
		Channel: { getChannel: () => ({ id: 'c1', guild_id: 'g1' }) },
		Guild: { getGuild: () => ({ id: 'g1', ownerId: OWNER_ID }) },
		GuildMember: { getMember: () => undefined },
	});
	// The gradients draw natively; these tests read tag text only, so the bridge runs nothing.
	await startPlugin({
		native: {
			ui: {
				createScope: () => ({ dispose() {} }),
				call: ((fn: { name: string }, ..._args: unknown[]) =>
					Object.assign(
						Promise.resolve(
							(fn.name === 'inspectTagGradients'
								? { problems: [], painted: 2 }
								: true) as never,
						),
						{ cancel() {} },
					)) as never,
				run() {},
				callback: () => () => {},
			},
		},
	});
});

describe('tags', () => {
	test('mark webhook messages', () => {
		expect(tagFor(webhookMessage()).tagText).toBe('Webhook');
	});

	test('mark the server owner', () => {
		expect(tagFor(memberMessage(OWNER_ID)).tagText).toBe('Owner');
	});

	test('mark members with a moderator permission', () => {
		permissionsOf.value = PERMISSIONS.MANAGE_MESSAGES;

		expect(tagFor(memberMessage('5')).tagText).toBe('Mod');
	});

	test('give the strongest tag to a member who qualifies for several', () => {
		permissionsOf.value = PERMISSIONS.ADMINISTRATOR | PERMISSIONS.MANAGE_MESSAGES;

		expect(tagFor(memberMessage('5')).tagText).toBe('Admin');
	});

	test('leave ordinary members untagged', () => {
		expect(tagFor(memberMessage('5')).tagText).toBeNull();
	});

	test('skip a tag the user switched off', () => {
		settings.tag.WEBHOOK = false;

		expect(tagFor(webhookMessage()).tagText).toBeNull();
	});

	test('show the tag in the original poster style when asked', () => {
		settings.useOpTagStyle = true;

		expect(tagFor(webhookMessage())).toMatchObject({ opTagText: 'Webhook', tagText: null });
	});
});

describe('the cached tag colors', () => {
	const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

	test('are saved a moment after a tag appears', async () => {
		tagFor(webhookMessage());
		await wait(1100);

		expect(storage.getBucket().get('appearanceCache', undefined)).toBeDefined();
	});

	test('are not written once the plugin stops', async () => {
		tagFor(webhookMessage());
		await stopPlugin();
		await wait(1100);

		expect(storage.getBucket().get('appearanceCache', undefined)).toBeUndefined();
	});
});

describe('health', () => {
	test('the self test passes once started', async () => {
		// Imported here so the mocked `react-native` above is in place first.
		const { selfTest } = await import('~/index');

		expect((await selfTest()).ok).toBe(true);
	});
});
