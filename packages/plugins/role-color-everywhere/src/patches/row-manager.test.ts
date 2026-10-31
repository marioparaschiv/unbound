import {
	createChatModel,
	createMessageStoreModel,
	type MessageStoreModel,
	type ModelMessage,
	type RawMessage,
} from '@unbound-plugins/shared/messages/message-store-model';
import { installAddonGlobals } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { MentionNode } from '~/chat-rows';

type Action = Parameters<MessageStoreModel['dispatch']>[0];
type RowMessage = {
	guildId: string;
	content: MentionNode[];
	embeds: { description: MentionNode[] }[];
	referencedMessage?: { message: { guildId: string; content: MentionNode[] } };
};
type Row = { message: RowMessage };

let store = createMessageStoreModel('me');
const dispatched: Action[] = [];
// Discord parses each message record once and reuses the parsed content for every row it builds.
const parsed = new WeakMap<ModelMessage, MentionNode[]>();

const GuildMemberStore = {
	getMember: (guildId: string, userId: string) =>
		guildId === 'g1' && userId === 'colored'
			? { userId, colorRoleId: 'role', colorString: '#112233' }
			: null,
};

const stores: Record<string, object> = {
	GuildMember: GuildMemberStore,
	Message: { getMessage: (channelId: string, id: string) => store.getMessage(channelId, id) },
	ReferencedMessage: { getMessage: () => ({ state: 1 }) },
};

const scope = installAddonGlobals({
	manifest: { id: 'astral.role-color-everywhere' },
	unbound: {
		flux: {
			getStore: (name: string) => stores[name],
			dispatch: (action: Action) => {
				dispatched.push(action);

				return store.dispatch(action);
			},
		},
		native: {
			definePlatform: (handlers: Record<string, object>) => handlers.ios,
		},
	},
});

function parse(text: string | undefined): MentionNode[] {
	return [...(text ?? '').matchAll(/<@(\w+)>/g)].map(([, userId]) => ({
		type: 'mention',
		userId,
	}));
}

function parseMessage(message: ModelMessage): MentionNode[] {
	let content = parsed.get(message);

	if (!content) {
		content = parse(message.content);
		parsed.set(message, content);
	}

	return content;
}

class RowManager {
	generate({ message }: { message: ModelMessage }): Row {
		const reference = message.messageReference;
		const referenced =
			reference && store.getMessage(reference.channel_id, reference.message_id);

		return {
			message: {
				guildId: 'g1',
				content: parseMessage(message),
				embeds: message.embeds.map((embed) => ({
					description: parse(embed.rawDescription),
				})),
				...(referenced
					? {
							referencedMessage: {
								message: { guildId: 'g1', content: parseMessage(referenced) },
							},
						}
					: {}),
			},
		};
	}
}

scope.metro.register(RowManager);
Object.assign(scope.metro, { findByFilePath: () => undefined });

mock.module('@unbound-app/api', () => scope.unbound);

const { patchRowManager } = await import('~/patches/row-manager');

function raw(id: string, content: string, extra: Partial<RawMessage> = {}): RawMessage {
	return {
		id,
		channel_id: 'c1',
		content,
		mentions: parse(content).map(({ userId }) => ({ id: userId ?? '' })),
		...extra,
	};
}

function chat(...ids: string[]) {
	return createChatModel(
		store,
		ids.map((id) => ['c1', id]),
		(message) => new RowManager().generate({ message }),
	);
}

function mentionColors(row: Row | undefined) {
	const message = row?.message;
	const nodes = [
		...(message?.content ?? []),
		...(message?.embeds.flatMap((embed) => embed.description) ?? []),
		...(message?.referencedMessage?.message.content ?? []),
	];

	return nodes.map((node) => node.color);
}

async function applied() {
	const remove = patchRowManager();

	await Promise.resolve();

	return remove;
}

function flush() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
	store = createMessageStoreModel('me');
	dispatched.length = 0;
	scope.patcher.unpatchAll();
});

describe('patchRowManager', () => {
	test('colors mentions in the rows Discord builds', async () => {
		await applied();
		store.add(raw('m1', '<@colored>'));

		expect(mentionColors(chat('m1').rows()[0])).toEqual([0x112233]);
	});

	test('removing it has Discord show plain mentions, and keeps the message as it was', async () => {
		const remove = await applied();
		const before = store.add(
			raw('m1', '<@me> <@colored>', {
				embeds: [{ title: 'Title', description: '<@colored>', footer: { text: 'Footer' } }],
			}),
		);
		const view = chat('m1');

		expect(mentionColors(view.rows()[0])).toEqual([undefined, 0x112233, 0x112233]);

		remove();
		await flush();

		const after = store.getMessage('c1', 'm1');

		expect(mentionColors(view.rows()[0])).toEqual([undefined, undefined, undefined]);
		expect(after).toEqual(before);
		expect(after?.mentions).toEqual(['me', 'colored']);
		expect(after?.mentioned).toBe(true);
		expect(after?.embeds).toEqual([
			{ rawTitle: 'Title', rawDescription: '<@colored>', footer: { text: 'Footer' } },
		]);
	});

	test('removing it has Discord show plain mentions in reply previews', async () => {
		const remove = await applied();

		store.add(raw('m1', '<@colored>'));
		store.add(
			raw('m2', 'reply', { message_reference: { channel_id: 'c1', message_id: 'm1' } }),
		);

		const view = chat('m2');

		expect(mentionColors(view.rows()[0])).toEqual([0x112233]);

		remove();
		await flush();

		expect(mentionColors(view.rows()[0])).toEqual([undefined]);
	});

	test('removing it leaves rows it did not color alone', async () => {
		const remove = await applied();

		store.add(raw('m2', '<@plain>'));
		chat('m2').rows();
		remove();

		expect(dispatched).toEqual([]);
	});
});
