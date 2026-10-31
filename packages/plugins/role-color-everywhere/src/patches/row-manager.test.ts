import { installAddonGlobals } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { MentionNode } from '~/chat-rows';

type MessageRecord = { id: string; content: string; embed?: string; repliedTo?: MessageRecord };
type RowMessage = {
	guildId: string;
	content: MentionNode[];
	embeds: { description: MentionNode[] }[];
	referencedMessage?: { message: { guildId: string; content: MentionNode[] } };
};
type Row = { message: RowMessage };

// Discord caches parsed content per message record and per embed description, and builds every row from it.
const parsedMessages = new WeakMap<MessageRecord, MentionNode[]>();
const parsedEmbeds = new Map<string, MentionNode[]>();

const GuildMemberStore = {
	getMember: (guildId: string, userId: string) =>
		guildId === 'g1' && userId === 'colored'
			? { userId, colorRoleId: 'role', colorString: '#112233' }
			: null,
};

const scope = installAddonGlobals({
	manifest: { id: 'astral.role-color-everywhere' },
	unbound: {
		flux: { getStore: (name: string) => (name === 'GuildMember' ? GuildMemberStore : {}) },
		native: { definePlatform: (handlers: { ios: object }) => handlers.ios },
	},
});

function parse(text: string): MentionNode[] {
	return [
		{
			type: 'paragraph',
			content: [...text.matchAll(/<@(\w+)>/g)].map(([, userId]) => ({
				type: 'mention',
				userId,
			})),
		},
	];
}

function parseMessage(record: MessageRecord): MentionNode[] {
	let content = parsedMessages.get(record);

	if (!content) {
		content = parse(record.content);
		parsedMessages.set(record, content);
	}

	return content;
}

function parseEmbed(description: string): MentionNode[] {
	let content = parsedEmbeds.get(description);

	if (!content) {
		content = parse(description);
		parsedEmbeds.set(description, content);
	}

	return content;
}

class RowManager {
	generate({ message }: { message: MessageRecord }): Row {
		return {
			message: {
				guildId: 'g1',
				content: parseMessage(message),
				embeds: message.embed ? [{ description: parseEmbed(message.embed) }] : [],
				...(message.repliedTo
					? {
							referencedMessage: {
								message: {
									guildId: 'g1',
									content: parseMessage(message.repliedTo),
								},
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

function mentionColors(row: Row) {
	const { message } = row;
	const paragraphs = [
		...message.content,
		...message.embeds.flatMap((embed) => embed.description),
		...(message.referencedMessage?.message.content ?? []),
	];

	return paragraphs.flatMap((paragraph) =>
		Array.isArray(paragraph.content)
			? paragraph.content.map((node: MentionNode) => node.color)
			: [],
	);
}

function render(message: MessageRecord) {
	return new RowManager().generate({ message });
}

async function applied() {
	const remove = patchRowManager();

	await Promise.resolve();

	return remove;
}

beforeEach(() => {
	parsedEmbeds.clear();
	scope.patcher.unpatchAll();
});

describe('patchRowManager', () => {
	test('colors mentions in message text, embeds and reply previews', async () => {
		await applied();

		const replied = { id: 'm1', content: '<@colored>' };
		const row = render({
			id: 'm2',
			content: '<@me> <@colored>',
			embed: '<@colored>',
			repliedTo: replied,
		});

		expect(mentionColors(row)).toEqual([undefined, 0x112233, 0x112233, 0x112233]);
	});

	test("leaves Discord's cached parsed content unchanged", async () => {
		await applied();

		const replied = { id: 'm1', content: '<@colored>' };
		const message = {
			id: 'm2',
			content: '<@colored>',
			embed: '<@colored>',
			repliedTo: replied,
		};
		const before = structuredClone([parse(message.content), parse(message.embed)]);

		render(message);

		expect([parsedMessages.get(message), parsedEmbeds.get(message.embed)]).toEqual(before);
		expect(parsedMessages.get(replied)).toEqual(parse(replied.content));
	});

	test('rows built after removing it show plain mentions, with no relaunch', async () => {
		const remove = await applied();
		const replied = { id: 'm1', content: '<@colored>' };
		const message = {
			id: 'm2',
			content: '<@colored>',
			embed: '<@colored>',
			repliedTo: replied,
		};

		render(message);
		remove();

		expect(mentionColors(render(message))).toEqual([undefined, undefined, undefined]);
	});
});
