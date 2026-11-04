import { createFakeReactNative, flux, metro, render } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { createElement, memo, type ReactNode } from 'react';

const typing: { ids: Record<string, number> } = { ids: {} };
const users: Record<string, { id: string; username: string }> = {
	me: { id: 'me', username: 'me' },
	alice: { id: 'alice', username: 'alice' },
	bob: { id: 'bob', username: 'bob' },
};

// The design components are not in the kit's fakes; styles only need their factories called.
mock.module('@unbound-app/api/metro/components', () => ({
	Discord: {
		createStyles: (styles: object | (() => object)) => () =>
			typeof styles === 'function' ? styles() : styles,
	},
}));

// The kit's `react-native` has no `Animated`; the dots only import it, and these tests draw avatars.
mock.module('react-native', () => ({
	...createFakeReactNative(),
	Animated: {},
	Easing: {},
}));

// The kit's renderer draws function components only, and the error boundary is a class.
mock.module(
	new URL('../src/typing-indicator/components/indicator-boundary.tsx', import.meta.url).pathname,
	() => ({ default: (props: { children: ReactNode }) => props.children }),
);

const { Pressable, Text, View } = await import('react-native');
const { startTypingIndicators } = await import('~/typing-indicator');

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

beforeAll(() => {
	metro.register({ colors: { TEXT_DEFAULT: '#fff' }, internal: {} });
});

beforeEach(() => {
	typing.ids = {};
	metro.register(
		{ default: TextChannel },
		'modules/channel_list_v2/native/items/TextChannel.tsx',
	);
	metro.register(threadModule, 'modules/channel_list_v2/native/items/ThreadChannel.tsx');
	metro.register({ default: UserSummaryItem }, 'components_native/common/UserSummaryItem.tsx');
	seedStores();
	settings.indicatorMode = 2;
	startTypingIndicators();
});

describe('typing indicators on channel rows', () => {
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
});
