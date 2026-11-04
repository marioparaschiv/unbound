import { flux, metro, render, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { beforeEach, describe, expect, test } from 'bun:test';
import { createElement, memo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { selfTest } from '~/index';

const typing: { ids: Record<string, number> } = { ids: {} };
const users: Record<string, { id: string; username: string }> = {
	me: { id: 'me', username: 'me' },
	alice: { id: 'alice', username: 'alice' },
	bob: { id: 'bob', username: 'bob' },
};

function ChannelInfo(_props: { channel: { id: string } }) {
	return createElement(Text, null, 'general');
}

const TextChannel = memo(function TextChannel(props: { channel: { id: string }; muted?: boolean }) {
	return createElement(
		View,
		null,
		null,
		createElement(
			Pressable,
			{ accessibilityRole: 'button' },
			false,
			createElement(
				View,
				null,
				createElement(Text, null, '#'),
				createElement(ChannelInfo, { channel: props.channel }),
			),
		),
	);
});

function ThreadButton(props: {
	channelInfo?: ReactNode;
	accessibilityRole?: string;
	channel?: unknown;
}) {
	return createElement(View, null, createElement(Text, null, 'thread'), props.channelInfo);
}

function ThreadRow(props: { channel: { id: string } }) {
	return createElement(
		View,
		null,
		null,
		createElement(
			View,
			null,
			false,
			createElement(ThreadButton, {
				accessibilityRole: 'button',
				channel: props.channel,
				channelInfo: createElement(Text, null, '3 messages'),
			}),
		),
	);
}

function ThreadChannel(props: { channel: { id: string } }) {
	return createElement(ThreadRow, props);
}

function UserSummaryItem({ users: shown }: { users: { username: string }[] }): ReactNode {
	return createElement(Text, null, `avatar:${shown[0]?.username}`);
}

function seedStores(options: { blocked?: string[] } = {}) {
	flux.seed({
		Typing: { getTypingUsers: () => typing.ids },
		User: { getCurrentUser: () => users.me, getUser: (id: string) => users[id] },
		Relationship: {
			isBlocked: (id: string) => options.blocked?.includes(id) ?? false,
			isIgnored: () => false,
		},
		SelectedChannel: { getChannelId: () => 'selected' },
		UserGuildSettings: { isChannelMuted: () => false },
		GuildMember: { getNick: () => undefined },
	});
}

// A plain function component is patched where its module exports it, so it renders from the module.
const threadModule = { default: ThreadChannel };

function renderThread(channelId = 'thread') {
	return render(createElement(threadModule.default, { channel: { id: channelId } }));
}

function renderRow(channelId = 'general', muted = false) {
	return render(createElement(TextChannel, { channel: { id: channelId }, muted }));
}

// The preset forgets registered modules before each test, so each test registers them again.
function registerModules(thread: object) {
	typing.ids = {};
	metro.register({ colors: { TEXT_DEFAULT: '#fff' }, internal: {} });
	metro.register(
		{ default: TextChannel },
		'modules/channel_list_v2/native/items/TextChannel.tsx',
	);
	metro.register(thread, 'modules/channel_list_v2/native/items/ThreadChannel.tsx');
	metro.register({ default: UserSummaryItem }, 'components_native/common/UserSummaryItem.tsx');
	seedStores();
	settings.indicatorMode = 2;
}

describe('typing indicators on channel rows', () => {
	beforeEach(async () => {
		registerModules(threadModule);
		await startPlugin();
	});

	test('shows an avatar for each user typing in the channel', () => {
		typing.ids = { alice: 1, bob: 1 };

		const row = renderRow();

		expect(row.findAll('Text').map((text) => text.text())).toEqual([
			'#',
			'avatar:alice',
			'avatar:bob',
			'general',
		]);
	});

	test('shows nothing while nobody is typing', () => {
		expect(
			renderRow()
				.findAll('Text')
				.map((text) => text.text()),
		).toEqual(['#', 'general']);
	});

	test('never shows you, and hides blocked users unless included', () => {
		typing.ids = { me: 1, alice: 1, bob: 1 };
		seedStores({ blocked: ['bob'] });

		expect(
			renderRow()
				.findAll('Text')
				.map((text) => text.text()),
		).toEqual(['#', 'avatar:alice', 'general']);

		settings.includeBlockedUsers = true;

		expect(
			renderRow()
				.findAll('Text')
				.map((text) => text.text()),
		).toEqual(['#', 'avatar:alice', 'avatar:bob', 'general']);
	});

	test('hides the channel you have open when Include current channel is off', () => {
		typing.ids = { alice: 1 };
		settings.includeCurrentChannel = false;

		expect(
			renderRow('selected')
				.findAll('Text')
				.map((text) => text.text()),
		).toEqual(['#', 'general']);
	});

	test('shows the users typing in a thread after its channel info', () => {
		typing.ids = { alice: 1 };

		expect(
			renderThread()
				.findAll('Text')
				.map((text) => text.text()),
		).toEqual(['thread', '3 messages', 'avatar:alice']);
	});

	test('draws channel and thread rows without the indicator after the plugin stops', async () => {
		typing.ids = { alice: 1 };

		await stopPlugin();

		expect(
			renderRow()
				.findAll('Text')
				.map((text) => text.text()),
		).toEqual(['#', 'general']);
		expect(
			renderThread()
				.findAll('Text')
				.map((text) => text.text()),
		).toEqual(['thread', '3 messages']);
	});
});

describe('a thread row with an unexpected shape', () => {
	beforeEach(async () => {
		registerModules({ default: 'not a component' });
		await startPlugin();
	});

	test('still shows the indicator on channel rows', () => {
		typing.ids = { alice: 1 };

		expect(
			renderRow()
				.findAll('Text')
				.map((text) => text.text()),
		).toEqual(['#', 'avatar:alice', 'general']);
	});

	test('fails the self test', async () => {
		expect((await selfTest()).detail).toContain('start failed');
	});
});
