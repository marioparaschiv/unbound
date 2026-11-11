import { deviceScript } from './device-script';

const FIXTURE_MESSAGES = [
	'```ts\nconst answer: number = 42;\nfunction double(value: number) {\n\treturn value * 2;\n}\n```',
	'Fixture mention <@{self}> with a link https://discord.com/channels/{guild}/{channel}',
	'Plain fixture message for bubbles and avatars.',
	'Fixture message link https://discord.com/channels/{guild}/{channel}/{message}',
];

const LAYOUT_FIXTURES = {
	original: 'Fixture original for the reply',
	reply: 'Fixture reply to the message above',
	forwarded: 'Fixture forwarded text',
};

const SCROLL_FILLER = 30;

type StagedAuthor = { author?: { id?: string } };
type StagedMessages = { matrixStagedMessages?: { channel: string; id: string }[] };

function stageFixtures(
	guild: string,
	channel: string,
	fixtures: typeof LAYOUT_FIXTURES,
	messages: string[],
) {
	const { metro, flux } = unbound;

	metro.findByProps('transitionToGuild').transitionToGuild(guild, channel);

	return (async () => {
		await new Promise((resolve) => setTimeout(resolve, 1500));

		const actions = metro.findByProps('sendMessage', 'receiveMessage');
		const bot = metro.findByProps('createBotMessage');
		const me = flux.getStore('User').getCurrentUser()!;
		const loaded = flux.getStore('Message').getMessages(channel);
		const linked = (loaded?.toArray ? loaded.toArray() : [])
			.filter((message) => message.author && !message.author.bot && /^\d+$/.test(message.id))
			.pop();
		const dispatcher = metro.findByProps('dispatch', 'subscribe');
		const holder = globalThis as StagedMessages;
		const staged = holder.matrixStagedMessages ?? [];

		holder.matrixStagedMessages = staged;

		for (const message of staged.splice(0)) {
			dispatcher.dispatch({
				type: 'MESSAGE_DELETE',
				id: message.id,
				channelId: message.channel,
			});
		}

		const receive = (message: DeviceMessage) => {
			staged.push({ channel, id: message.id });
			actions.receiveMessage(channel, message);
		};
		const make = (fields: object) =>
			Object.assign(
				bot.createBotMessage({ channelId: channel, content: '' }),
				{ flags: 0 },
				fields,
			);
		const reference = (message: DeviceMessage, type: number) => ({
			type,
			channel_id: channel,
			guild_id: guild,
			message_id: message.id,
		});
		const original = make({ content: fixtures.original });
		const image = `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=128`;

		receive(original);

		for (const message of [
			make({
				type: 19,
				content: fixtures.reply,
				message_reference: reference(original, 0),
				referenced_message: original,
			}),
			make({
				attachments: [
					{
						id: String(Date.now()),
						filename: 'fixture.png',
						url: image,
						proxy_url: image,
						width: 128,
						height: 128,
						content_type: 'image/png',
						size: 4096,
					},
				],
			}),
			make({
				message_reference: reference(original, 1),
				message_snapshots: [
					{
						message: {
							content: fixtures.forwarded,
							timestamp: new Date().toISOString(),
							type: 0,
							embeds: [],
							attachments: [],
							flags: 0,
						},
					},
				],
			}),
		]) {
			receive(message);
		}

		for (const template of messages.filter(
			(content) => linked || !content.includes('{message}'),
		)) {
			const content = template
				.replace('{self}', me.id)
				.replace('{guild}', guild)
				.replace('{channel}', channel)
				.replace('{message}', linked ? linked.id : '');

			receive(bot.createBotMessage({ channelId: channel, content }));
		}

		await new Promise((resolve) => setTimeout(resolve, 1500));

		return 'staged';
	})();
}

export function fixtureScript(guild: string, channel: string): string {
	return deviceScript(stageFixtures, guild, channel, LAYOUT_FIXTURES, FIXTURE_MESSAGES);
}

function checkFixtures(channel: string, marker: string) {
	const { flux } = unbound;
	const selected = flux.getStore('SelectedChannel').getChannelId();
	const loaded = flux.getStore('Message').getMessages(channel);
	const messages = loaded?.toArray ? loaded.toArray() : [];
	const staged = messages.some((message) => message.content === marker);

	return selected === channel && staged ? 'present' : 'missing';
}

export function fixturesPresentScript(channel: string): string {
	return deviceScript(checkFixtures, channel, FIXTURE_MESSAGES[2]!);
}

function stageScrollFiller(channel: string, count: number) {
	const { metro, flux } = unbound;
	const actions = metro.findByProps('sendMessage', 'receiveMessage');
	const bot = metro.findByProps('createBotMessage');
	const self = flux.getStore('User').getCurrentUser()!.id;
	const holder = globalThis as StagedMessages;
	const staged = holder.matrixStagedMessages ?? [];

	holder.matrixStagedMessages = staged;

	for (let index = 0; index < count; index++) {
		const content =
			index % 3 === 0 ? `Scroll filler ${index} for <@${self}>` : `Scroll filler ${index}`;
		const message = bot.createBotMessage({ channelId: channel, content });

		staged.push({ channel, id: message.id });
		actions.receiveMessage(channel, message);
	}

	return new Promise((resolve) => setTimeout(resolve, 1500)).then(() => 'staged');
}

export function scrollFillerScript(channel: string): string {
	return deviceScript(stageScrollFiller, channel, SCROLL_FILLER);
}

function clearStaged(channel: string) {
	const { metro, flux } = unbound;
	const bot = metro.findByProps('createBotMessage');
	const dispatcher = metro.findByProps('dispatch', 'subscribe');
	const author = (bot.createBotMessage({ channelId: channel, content: '' }) as StagedAuthor)
		.author?.id;
	const loaded = flux.getStore('Message').getMessages(channel);
	const staged = (loaded?.toArray ? loaded.toArray() : []).filter(
		(message) => author !== undefined && (message as StagedAuthor).author?.id === author,
	);

	for (const message of staged) {
		dispatcher.dispatch({ type: 'MESSAGE_DELETE', id: message.id, channelId: channel });
	}

	(globalThis as StagedMessages).matrixStagedMessages = [];

	return String(staged.length);
}

export function clearStagedScript(channel: string): string {
	return deviceScript(clearStaged, channel);
}
