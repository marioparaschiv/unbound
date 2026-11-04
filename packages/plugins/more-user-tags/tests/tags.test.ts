import { flux, metro, startPlugin } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';

// The testing kit has no fake of `@unbound-app/api/native`, and the gradients draw natively.
mock.module(new URL('../src/tags/platform.ts', import.meta.url).pathname, () => ({
	createTagGradients: () => ({
		start: () => () => {},
		settled: () => Promise.resolve(),
		problems: () => Promise.resolve([]),
		drawn: () => 0,
	}),
	toRendererColor: (color: unknown) => color,
}));

// The testing kit's `react-native` has no `processColor`.
mock.module('react-native', () => ({ processColor: (color: unknown) => color }));

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

beforeAll(() => {
	metro.register({ Permissions: PERMISSIONS, ThemeTypes: {} });
	metro.register({ computePermissions: () => permissionsOf.value, canEveryoneRole: () => false });
	metro.register(getTagProperties);
});

beforeEach(async () => {
	permissionsOf.value = 0n;
	flux.seed({
		Channel: { getChannel: () => ({ id: 'c1', guild_id: 'g1' }) },
		Guild: { getGuild: () => ({ id: 'g1', ownerId: OWNER_ID }) },
		GuildMember: { getMember: () => undefined },
	});
	await startPlugin();
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
