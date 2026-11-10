import { flux, metro, native, render, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { beforeEach, describe, expect, test } from 'bun:test';

import { createElement, memo, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { selfTest } from '~/index';

const RED = '#ff0000';

const members: Record<string, object> = {
	red: { userId: 'red', colorString: RED, hoistRoleId: 'role' },
	plain: { userId: 'plain' },
};

function colorsOf(view: { findAll: (name: 'Text') => { props: { style?: unknown } }[] }) {
	return view.findAll('Text').map(({ props }) => {
		const style = ([] as unknown[]).concat(props.style ?? []);

		return style.find((entry) => (entry as { color?: string } | undefined)?.color) as
			| { color: string }
			| undefined;
	});
}

function call<T extends unknown[]>(render: (...args: T) => ReactNode, ...args: T) {
	return render(...args);
}

beforeEach(() => {
	flux.seed({
		GuildMember: { getMember: (_guildId: string, userId: string) => members[userId] },
		GuildRole: { getRole: () => ({ name: 'Admins', colorString: RED }) },
		Channel: { getChannel: () => ({ id: 'channel', guild_id: 'guild' }) },
		User: { getUser: (id: string) => ({ id, username: id }) },
		SelectedChannel: { getChannelId: () => 'channel' },
		Typing: { getTypingUsers: () => ({ red: 1, plain: 1 }) },
		Relationship: {},
	});
});

describe('typing names', () => {
	const TypingUser = ({ name }: { name: string }) => createElement(Text, null, name);
	// The list Discord drew keeps the `renderItem` it was given.
	const drawn: { renderItem?: () => ReactNode } = {};
	const Rows = ({ renderItem }: { renderItem: () => ReactNode }) => {
		drawn.renderItem = renderItem;

		return createElement(View, null, call(renderItem));
	};
	const TypingIndicator = memo(function TypingIndicator() {
		return createElement(Rows, {
			renderItem: () => createElement(TypingUser, { key: 'name', name: 'red' }),
		});
	});

	beforeEach(() => {
		metro.register({ default: TypingIndicator }, 'modules/chat/native/TypingIndicator.tsx');
	});

	test('paints the name of a typing member with their role color', async () => {
		await startPlugin();

		expect(colorsOf(render(createElement(TypingIndicator)))).toEqual([{ color: RED }]);
	});

	test('draws plain names in a list drawn before the plugin stopped', async () => {
		await startPlugin();
		render(createElement(TypingIndicator));
		await stopPlugin();

		expect(colorsOf(render(call(drawn.renderItem as () => ReactNode) as never))).toEqual([
			undefined,
		]);
	});

	test('leaves names plain while Typing Names is off', async () => {
		settings.typingUsers = false;
		await startPlugin();

		expect(colorsOf(render(createElement(TypingIndicator)))).toEqual([undefined]);
	});
});

describe('member list role headers', () => {
	const Header = ({ title }: { title: ReactNode }) => createElement(Text, null, title);
	// The list Discord drew keeps the `renderSectionHeader` it was given.
	const drawn: { renderSectionHeader?: (section: number) => ReactNode } = {};
	const Headers = ({
		renderSectionHeader,
	}: {
		renderSectionHeader: (section: number) => ReactNode;
	}) => {
		drawn.renderSectionHeader = renderSectionHeader;

		return call(renderSectionHeader, 0);
	};
	const module = {
		UsersFastList: () =>
			createElement(Headers, {
				renderSectionHeader: () => createElement(Header, { title: 'Admins — 1' }),
			}),
	};
	const props = {
		getSectionProps: () => ({ props: { title: 'Admins — 1' } }),
		getItemProps: () => ({ props: { guildId: 'guild', user: { id: 'red' } } }),
	};

	beforeEach(() => {
		metro.register(
			module,
			'modules/main_tabs_v2/native/shared_components/user_list/UsersFastList.tsx',
		);
	});

	test('paints a role section title with the role color', async () => {
		await startPlugin();

		expect(
			colorsOf(
				render(createElement(module.UsersFastList as (p: object) => ReactNode, props)),
			),
		).toEqual([undefined, { color: RED }]);
	});

	test('draws a plain title in a list drawn before the plugin stopped', async () => {
		await startPlugin();
		render(createElement(module.UsersFastList as (p: object) => ReactNode, props));
		await stopPlugin();

		expect(
			colorsOf(
				render(
					call(drawn.renderSectionHeader as (section: number) => ReactNode, 0) as never,
				),
			),
		).toEqual([undefined]);
	});
});

describe('reaction users', () => {
	const Name = ({ user }: { user: { id: string; username: string } }) =>
		createElement(Text, null, user.username);
	const Item = ({ label }: { label: ReactNode }) => createElement(View, null, label);
	// The list Discord drew keeps the `renderItem` it was given.
	const drawn: { renderItem?: (section: number, index: number) => ReactNode } = {};
	const List = ({
		renderItem,
	}: {
		renderItem: (section: number, index: number) => ReactNode;
	}) => {
		drawn.renderItem = renderItem;

		return call(renderItem, 0, 0);
	};
	const module = {
		MessageReactionsContent: (_props: { channelId: string }) =>
			createElement(
				View,
				null,
				createElement(List, {
					renderItem: () =>
						createElement(
							View,
							null,
							createElement(Item, {
								label: createElement(Name, {
									user: { id: 'red', username: 'red' },
								}),
							}),
							createElement(Text, null, '+1'),
						),
				}),
			),
	};

	test('paints a reactor’s name with their role color', async () => {
		metro.register(module, 'modules/reactions/native/MessageReactionsContent.tsx');
		await startPlugin();

		const view = render(
			createElement(module.MessageReactionsContent, { channelId: 'channel' }),
		);

		expect(colorsOf(view)).toEqual([{ color: RED }, undefined]);
	});

	test('draws plain names in a list drawn before the plugin stopped', async () => {
		metro.register(module, 'modules/reactions/native/MessageReactionsContent.tsx');
		await startPlugin();
		render(createElement(module.MessageReactionsContent, { channelId: 'channel' }));
		await stopPlugin();

		const row = call(drawn.renderItem as (section: number, index: number) => ReactNode, 0, 0);

		expect(colorsOf(render(row as never))).toEqual([undefined, undefined]);
	});
});

describe('poll voters', () => {
	const Row = ({ label }: { label: ReactNode }) => createElement(Text, null, label);
	// The list Discord drew keeps the `renderItem` it was given.
	const drawn: { renderItem?: (voter: { item: { id: string } }) => ReactNode } = {};
	const Rows = ({
		renderItem,
	}: {
		renderItem: (voter: { item: { id: string } }) => ReactNode;
	}) => {
		drawn.renderItem = renderItem;

		return call(renderItem, { item: { id: 'red' } });
	};
	const VotersList = () =>
		createElement(
			View,
			null,
			createElement(Rows, { renderItem: () => createElement(Row, { label: 'red' }) }),
		);
	const module = {
		default: (_props: { channelId: string }) =>
			createElement(
				View,
				null,
				createElement(
					View,
					null,
					createElement(Text, null, 'Votes'),
					createElement(VotersList),
				),
			),
	};

	test('paints a voter’s name with their role color', async () => {
		metro.register(module, 'modules/polls/native/PollVotesActionSheet.tsx');
		await startPlugin();

		const view = render(createElement(module.default, { channelId: 'channel' }));

		expect(colorsOf(view)).toEqual([undefined, undefined, { color: RED }]);
	});

	test('draws plain names in a list drawn before the plugin stopped', async () => {
		metro.register(module, 'modules/polls/native/PollVotesActionSheet.tsx');
		await startPlugin();
		render(createElement(module.default, { channelId: 'channel' }));
		await stopPlugin();

		const row = call(drawn.renderItem as (voter: { item: { id: string } }) => ReactNode, {
			item: { id: 'red' },
		});

		expect(colorsOf(render(row as never))).toEqual([undefined]);
	});
});

describe('voice users', () => {
	const module = {
		default: (props: { guildId: string; user: { id: string } }) =>
			createElement(
				View,
				null,
				createElement(Text, null, props.user.id),
				createElement(Text, null, 'muted'),
			),
	};

	test('paints a voice member’s name with their role color', async () => {
		metro.register(module, 'modules/guild_sidebar/native/VoiceUserNameItem.tsx');
		await startPlugin();

		const view = render(
			createElement(module.default, { guildId: 'guild', user: { id: 'red' } }),
		);

		expect(colorsOf(view)).toEqual([undefined, { color: RED }, undefined]);
	});

	test('leaves a member with no role color plain', async () => {
		metro.register(module, 'modules/guild_sidebar/native/VoiceUserNameItem.tsx');
		await startPlugin();

		const view = render(
			createElement(module.default, { guildId: 'guild', user: { id: 'plain' } }),
		);

		expect(colorsOf(view)).toEqual([undefined, undefined]);
	});

	test('draws a plain name once the plugin stopped', async () => {
		metro.register(module, 'modules/guild_sidebar/native/VoiceUserNameItem.tsx');
		await startPlugin();
		await stopPlugin();

		const view = render(
			createElement(module.default, { guildId: 'guild', user: { id: 'red' } }),
		);

		expect(colorsOf(view)).toEqual([undefined, undefined, undefined]);
	});
});

describe('self test', () => {
	test('reports ok once the native painters find their Discord classes', async () => {
		native.objc.registerClass('DCDMessageTableViewCell');
		native.objc.registerClass('DCDChatInputComponentView');
		await startPlugin();

		expect(await selfTest()).toMatchObject({ ok: true });
	});

	test('names only the native painters as skipped when Discord lacks their classes', async () => {
		await startPlugin();

		const { ok, detail } = await selfTest();

		expect(ok).toBe(false);
		expect(detail).toBe(
			'skipped: chat mentions: native classes not found: DCDMessageTableViewCell; composer mentions: native classes not found: DCDChatInputComponentView',
		);
	});

	test('keeps the other features when one throws on start', async () => {
		const voice = {
			default: (props: { guildId: string; user: { id: string } }) =>
				createElement(
					View,
					null,
					createElement(Text, null, props.user.id),
					createElement(Text, null, 'muted'),
				),
		};

		// Patching a render function that is not there throws; the typing feature fails alone.
		metro.register({ default: 'not a component' }, 'modules/chat/native/TypingIndicator.tsx');
		metro.register(voice, 'modules/guild_sidebar/native/VoiceUserNameItem.tsx');
		await startPlugin();

		const view = render(
			createElement(voice.default, { guildId: 'guild', user: { id: 'red' } }),
		);

		expect(colorsOf(view)).toEqual([undefined, { color: RED }, undefined]);
		expect((await selfTest()).detail).toContain('start failed');
	});
});
