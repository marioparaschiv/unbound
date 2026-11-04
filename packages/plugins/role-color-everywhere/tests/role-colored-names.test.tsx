import { flux, render, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { beforeEach, describe, expect, test } from 'bun:test';
import { createElement, memo, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { NO_NATIVE_CLASSES, registerFeatureModules } from './feature-modules';

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
		registerFeatureModules(
			{ default: TypingIndicator },
			'modules/chat/native/TypingIndicator.tsx',
		);
	});

	test('paints the name of a typing member with their role color', async () => {
		await startPlugin(NO_NATIVE_CLASSES);

		expect(colorsOf(render(createElement(TypingIndicator)))).toEqual([{ color: RED }]);
	});

	test('draws plain names in a list drawn before the plugin stopped', async () => {
		await startPlugin(NO_NATIVE_CLASSES);
		render(createElement(TypingIndicator));
		await stopPlugin();

		expect(colorsOf(render(call(drawn.renderItem as () => ReactNode) as never))).toEqual([
			undefined,
		]);
	});

	test('leaves names plain while Typing Names is off', async () => {
		settings.typingUsers = false;
		await startPlugin(NO_NATIVE_CLASSES);

		expect(colorsOf(render(createElement(TypingIndicator)))).toEqual([undefined]);
	});
});

describe('member list role headers', () => {
	const Header = ({ title }: { title: ReactNode }) => createElement(Text, null, title);
	const Headers = ({
		renderSectionHeader,
	}: {
		renderSectionHeader: (section: number) => ReactNode;
	}) => call(renderSectionHeader, 0);
	const module = {
		UsersFastList: () =>
			createElement(Headers, {
				renderSectionHeader: () => createElement(Header, { title: 'Admins — 1' }),
			}),
	};

	test('paints a role section title with the role color', async () => {
		registerFeatureModules(
			module,
			'modules/main_tabs_v2/native/shared_components/user_list/UsersFastList.tsx',
		);
		await startPlugin(NO_NATIVE_CLASSES);

		const props = {
			getSectionProps: () => ({ props: { title: 'Admins — 1' } }),
			getItemProps: () => ({ props: { guildId: 'guild', user: { id: 'red' } } }),
		};

		expect(
			colorsOf(
				render(createElement(module.UsersFastList as (p: object) => ReactNode, props)),
			),
		).toEqual([undefined, { color: RED }]);
	});
});

describe('reaction users', () => {
	const Name = ({ user }: { user: { id: string; username: string } }) =>
		createElement(Text, null, user.username);
	const Item = ({ label }: { label: ReactNode }) => createElement(View, null, label);
	const List = ({ renderItem }: { renderItem: (section: number, index: number) => ReactNode }) =>
		call(renderItem, 0, 0);
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
		registerFeatureModules(module, 'modules/reactions/native/MessageReactionsContent.tsx');
		await startPlugin(NO_NATIVE_CLASSES);

		const view = render(
			createElement(module.MessageReactionsContent, { channelId: 'channel' }),
		);

		expect(colorsOf(view)).toEqual([{ color: RED }, undefined]);
	});
});

describe('poll voters', () => {
	const Row = ({ label }: { label: ReactNode }) => createElement(Text, null, label);
	const Rows = ({ renderItem }: { renderItem: (voter: { item: { id: string } }) => ReactNode }) =>
		call(renderItem, { item: { id: 'red' } });
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
		registerFeatureModules(module, 'modules/polls/native/PollVotesActionSheet.tsx');
		await startPlugin(NO_NATIVE_CLASSES);

		const view = render(createElement(module.default, { channelId: 'channel' }));

		expect(colorsOf(view)).toEqual([undefined, undefined, { color: RED }]);
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
		registerFeatureModules(module, 'modules/guild_sidebar/native/VoiceUserNameItem.tsx');
		await startPlugin(NO_NATIVE_CLASSES);

		const view = render(
			createElement(module.default, { guildId: 'guild', user: { id: 'red' } }),
		);

		expect(colorsOf(view)).toEqual([undefined, { color: RED }, undefined]);
	});

	test('leaves a member with no role color plain', async () => {
		registerFeatureModules(module, 'modules/guild_sidebar/native/VoiceUserNameItem.tsx');
		await startPlugin(NO_NATIVE_CLASSES);

		const view = render(
			createElement(module.default, { guildId: 'guild', user: { id: 'plain' } }),
		);

		expect(colorsOf(view)).toEqual([undefined, undefined]);
	});
});
