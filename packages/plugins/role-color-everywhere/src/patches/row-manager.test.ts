import { installAddonGlobals } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { MentionNode } from '~/chat-rows';

type Message = { id: string; channel_id: string; content: string };
type Row = { message: { guildId: string; content: MentionNode[] } };
type Action = { type: string; message?: Message };

const stored = new Map<string, Message>();
const dispatched: Action[] = [];
// Discord parses each message once and reuses the parsed content for every row it builds.
const parsed = new Map<Message, MentionNode[]>();

const GuildMemberStore = {
	getMember: (guildId: string, userId: string) =>
		guildId === 'g1' && userId === 'colored'
			? { userId, colorRoleId: 'role', colorString: '#112233' }
			: null,
};

const scope = installAddonGlobals({
	manifest: { id: 'astral.role-color-everywhere' },
	unbound: {
		flux: {
			getStore: (name: string) =>
				name === 'Message'
					? { getMessage: (_channelId: string, id: string) => stored.get(id) }
					: GuildMemberStore,
			dispatch: async (action: Action) => void dispatched.push(action),
		},
		native: {
			definePlatform: (handlers: Record<string, object>) => handlers.ios,
		},
	},
});

class RowManager {
	generate({ message }: { message: Message }): Row {
		const userId = /<@(\w+)>/.exec(message.content)?.[1];
		let content = parsed.get(message);

		if (!content) {
			content = [{ type: 'mention', userId }];
			parsed.set(message, content);
		}

		return { message: { guildId: 'g1', content } };
	}
}

scope.metro.register(RowManager);
Object.assign(scope.metro, { findByFilePath: () => undefined });

mock.module('@unbound-app/api', () => scope.unbound);

const { patchRowManager } = await import('~/patches/row-manager');

function message(id: string, userId: string): Message {
	return { id, channel_id: 'c1', content: `<@${userId}>` };
}

async function applied() {
	const remove = patchRowManager();

	await Promise.resolve();

	return remove;
}

beforeEach(() => {
	stored.clear();
	parsed.clear();
	dispatched.length = 0;
	scope.patcher.unpatchAll();
});

describe('patchRowManager', () => {
	test('colors mentions in the rows Discord builds', async () => {
		await applied();

		const [mention] = new RowManager().generate({ message: message('m1', 'colored') }).message
			.content;

		expect(mention.color).toBe(0x112233);
	});

	test('removing it has Discord rebuild each colored row from the stored message', async () => {
		const remove = await applied();
		const edited = { ...message('m1', 'colored'), content: '<@colored> hi' };

		new RowManager().generate({ message: message('m1', 'colored') });
		stored.set('m1', edited);
		remove();

		expect(dispatched).toMatchObject([{ type: 'MESSAGE_UPDATE', message: edited }]);

		const [mention] = new RowManager().generate({ message: edited }).message.content;

		expect(mention).toEqual({ type: 'mention', userId: 'colored' });
	});

	test('removing it leaves rows it did not color alone', async () => {
		const remove = await applied();
		const plain = message('m2', 'plain');

		stored.set('m2', plain);
		new RowManager().generate({ message: plain });
		remove();

		expect(dispatched).toEqual([]);
	});
});
