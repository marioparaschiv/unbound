import { z } from '@unbound-app/contracts/zod';

import { deviceScript } from './device-script';

export const cycleResultSchema = z.object({
	id: z.string(),
	installed: z.boolean(),
	wasStarted: z.boolean(),
	error: z.string(),
	restarted: z.boolean(),
	updateError: z.string(),
	updated: z.boolean(),
	hooksBefore: z.number(),
	hooksStopped: z.number(),
	hooksAfter: z.number(),
	hooksUpdated: z.number(),
	stopMs: z.optional(z.number()),
	startMs: z.optional(z.number()),
	drawnMs: z.optional(z.number()),
	selfTest: z.optional(z.object({ ok: z.boolean(), detail: z.string() })),
	bundleHash: z.optional(z.string()),
});

export type CycleResult = z.infer<typeof cycleResultSchema>;

const CYCLE_SETTLE_MS = 300;
const SELF_TEST_DELAY_MS = 1_000;
const DRAWN_POLL_MS = 200;

/** The log lines {@link pluginLogScript} and {@link toastLogScript} return. */
export const logLinesSchema = z.array(z.string());

type MatrixGlobal = typeof globalThis & {
	__matrixSettingsProbe?: SettingsProbeState;
};

type SettingsProbeState = {
	rendered: boolean;
	error: string;
	boundary: { _reactInternals?: ReactFiber } | null;
};

type ReactFiber = {
	tag: number;
	type: unknown;
	memoizedProps?: { children?: unknown };
	child?: ReactFiber | null;
	sibling?: ReactFiber | null;
};

type StoredMessages = { toArray?: () => DeviceMessage[] } | undefined;

function runCycle(id: string, settleMs: number, selfTestDelayMs: number, drawnPollMs: number) {
	const manager = unbound.plugins;
	const read = unbound.native?.getNativeResources;
	const hooks = () => read?.()?.hooks ?? 0;
	const settle = () => new Promise((resolve) => setTimeout(resolve, settleMs));
	const message = (failure: unknown) =>
		String(failure && (failure as Error).message ? (failure as Error).message : failure);
	let entity = manager.getEntity(id);
	const result: CycleResult = {
		id,
		installed: Boolean(entity),
		wasStarted: Boolean(entity?.started),
		error: '',
		restarted: false,
		updateError: '',
		updated: false,
		hooksBefore: 0,
		hooksStopped: 0,
		hooksAfter: 0,
		hooksUpdated: 0,
	};

	return (async () => {
		if (!entity) return JSON.stringify(result);

		if (typeof entity.bundle === 'string') {
			let hash = 0x811c9dc5;

			for (let index = 0; index < entity.bundle.length; index++) {
				hash = Math.imul(hash ^ entity.bundle.charCodeAt(index), 0x01000193);
			}

			result.bundleHash = `${(hash >>> 0).toString(16)}:${entity.bundle.length}`;
		}

		if (!result.wasStarted) {
			try {
				await manager.start(id);
			} catch (failure) {
				result.error = message(failure);
			}

			await settle();
		}

		const before = manager.errors.get(id);

		result.hooksBefore = hooks();

		const stopping = Date.now();

		try {
			await manager.stop(id);
		} catch (failure) {
			result.error = result.error || message(failure);
		}

		result.stopMs = Date.now() - stopping;
		result.hooksStopped = hooks();

		const starting = Date.now();

		try {
			await manager.start(id);
		} catch (failure) {
			result.error = result.error || message(failure);
		}

		result.startMs = Date.now() - starting;
		await settle();

		const after = manager.errors.get(id);

		if (!result.error && after && after !== before) result.error = message(after);

		entity = manager.getEntity(id);
		result.restarted = Boolean(entity?.started);
		result.hooksAfter = hooks();

		let watching = false;

		async function watchDrawn(since: number) {
			while (watching) {
				const instance = manager.getEntity(id)?.instance;

				try {
					const report = (await instance?.selfTest?.()) as {
						ok?: unknown;
						nothingDrawn?: unknown;
					} | null;

					if (report?.ok && !report.nothingDrawn) {
						result.drawnMs = Date.now() - since;

						return;
					}
				} catch {}

				await new Promise((resolve) => setTimeout(resolve, drawnPollMs));
			}
		}

		let drawn: Promise<void> = Promise.resolve();

		if (result.restarted && entity) {
			const reloading = Date.now();

			try {
				const update = await manager.reload(id, entity.bundle, entity.data);

				watching = true;
				drawn = watchDrawn(reloading);

				if (!update.ok) result.updateError = message(update.error);
			} catch (failure) {
				result.updateError = message(failure);
			}

			await settle();
		}

		const updated = manager.getEntity(id);

		result.updated = Boolean(updated?.started);
		result.hooksUpdated = hooks();
		await new Promise((resolve) => setTimeout(resolve, selfTestDelayMs));
		watching = false;
		await drawn;

		const instance = updated?.instance;

		if (result.updated && typeof instance?.selfTest === 'function') {
			try {
				const report = (await instance.selfTest()) as {
					ok?: unknown;
					detail?: unknown;
				} | null;

				if (report)
					result.selfTest = { ok: Boolean(report.ok), detail: String(report.detail) };
			} catch (failure) {
				result.selfTest = { ok: false, detail: message(failure) };
			}
		}

		return JSON.stringify(result);
	})();
}

/**
 * @description Stops, starts and reloads a plugin on the device, counting its native hooks at each step and running its self-test after.
 * @param id The plugin's id.
 * @returns A script whose result is the {@link CycleResult} as JSON.
 */
export function cycleScript(id: string): string {
	return deviceScript(runCycle, id, CYCLE_SETTLE_MS, SELF_TEST_DELAY_MS, DRAWN_POLL_MS);
}

export const FIXTURE_MESSAGES = [
	'```ts\nconst answer: number = 42;\nfunction double(value: number) {\n\treturn value * 2;\n}\n```',
	'Fixture mention <@{self}> with a link https://discord.com/channels/{guild}/{channel}',
	'Plain fixture message for bubbles and avatars.',
	'Fixture message link https://discord.com/channels/{guild}/{channel}/{message}',
];

export const LAYOUT_FIXTURES = {
	original: 'Fixture original for the reply',
	reply: 'Fixture reply to the message above',
	forwarded: 'Fixture forwarded text',
};

type BotMessages = {
	createBotMessage(fields: {
		channelId: string;
		content: string;
	}): DeviceMessage & Record<string, unknown>;
};
type MessageActions = { receiveMessage(channel: string, message: object): void };
type Dispatcher = { dispatch(action: object): void };
type StagedAuthor = { author?: { id?: string } };
type StagedMessages = { matrixStagedMessages?: { channel: string; id: string }[] };
type CurrentUser = { id: string; avatar: string };

function stageFixtures(
	guild: string,
	channel: string,
	fixtures: typeof LAYOUT_FIXTURES,
	messages: string[],
) {
	const { metro } = unbound;

	metro
		.findByProps<{ transitionToGuild(guild: string, channel: string): void }>(
			'transitionToGuild',
		)
		.transitionToGuild(guild, channel);

	return (async () => {
		await new Promise((resolve) => setTimeout(resolve, 1500));

		const actions = metro.findByProps<MessageActions>('sendMessage', 'receiveMessage');
		const bot = metro.findByProps<BotMessages>('createBotMessage');
		const me = metro.findStore<{ getCurrentUser(): CurrentUser }>('User').getCurrentUser();
		const loaded = metro
			.findStore<{ getMessages(channel: string): StoredMessages }>('Message')
			.getMessages(channel);
		const linked = (loaded?.toArray ? loaded.toArray() : [])
			.filter((message) => message.author && !message.author.bot && /^\d+$/.test(message.id))
			.pop();
		const dispatcher = metro.findByProps<Dispatcher>('dispatch', 'subscribe');
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

function setDeveloperMode(enabled: boolean) {
	const store = unbound.storage.getStore('unbound');
	const previous = store.get('developer-mode', false);

	store.set('developer-mode', enabled);

	return String(previous);
}

export function developerModeScript(enabled: boolean): string {
	return deviceScript(setDeveloperMode, enabled);
}

export const settingsProbeSchema = z.object({
	rendered: z.boolean(),
	texts: z.number(),
	error: z.string(),
});

export type SettingsProbe = z.infer<typeof settingsProbeSchema>;

function openSettingsScreen(id: string) {
	const entity = unbound.plugins.getEntity(id);
	const instance = entity?.instance;

	if (!entity || !instance || typeof instance.getSettingsPanel !== 'function') return 'none';

	const { React } = unbound.metro.common;
	const probe: SettingsProbeState = { rendered: false, error: '', boundary: null };
	type BoundaryInstance = {
		props: { children?: unknown };
		state: { failed: boolean };
	};
	const Boundary = function (this: BoundaryInstance, props: BoundaryInstance['props']) {
		React.Component.call(this, props);
		this.state = { failed: false };
	} as unknown as { prototype: Record<string, unknown>; getDerivedStateFromError?: () => object };

	(globalThis as MatrixGlobal).__matrixSettingsProbe = probe;
	Boundary.getDerivedStateFromError = () => ({ failed: true });
	Boundary.prototype = Object.assign(Object.create(React.Component.prototype) as object, {
		constructor: Boundary,
		componentDidCatch(error: unknown) {
			probe.error = String(
				error && (error as Error).message ? (error as Error).message : error,
			);
		},
		componentDidMount(this: SettingsProbeState['boundary']) {
			probe.boundary = this;
		},
		render(this: BoundaryInstance) {
			return this.state.failed ? null : this.props.children;
		},
	});

	const Panel = () => {
		probe.rendered = true;

		return instance.getSettingsPanel?.();
	};

	unbound.metro
		.findByProps<{ getRootNavigationRef(): { navigate(name: string, params: object): void } }>(
			'getRootNavigationRef',
		)
		.getRootNavigationRef()
		.navigate('settings', {
			screen: 'UNBOUND_CUSTOM',
			params: {
				title: entity.data.name,
				render: () => React.createElement(Boundary, null, React.createElement(Panel)),
			},
		});

	return 'opened';
}

/**
 * @description Opens a plugin's settings panel in Unbound's custom settings screen, the way its card's cog does, inside a probe that records whether the panel rendered and the error it threw.
 * @param id The plugin's id.
 * @returns A script whose result is `opened`, or `none` when the plugin is not running or has no panel.
 */
export function settingsScreenScript(id: string): string {
	return deviceScript(openSettingsScreen, id);
}

/**
 * @description Reads what the settings probe recorded for the panel on screen, counting the text the panel rendered by walking React's tree below the probe.
 * @returns A script whose result is the probe as JSON.
 */
function readSettingsProbe() {
	const probe = (globalThis as MatrixGlobal).__matrixSettingsProbe;

	if (!probe)
		return JSON.stringify({
			rendered: false,
			texts: 0,
			error: 'the settings screen did not open',
		});

	let texts = 0;
	const root = probe.boundary?._reactInternals;
	const stack = root?.child ? [root.child] : [];

	while (stack.length) {
		const fiber = stack.pop()!;
		const children = fiber.memoizedProps?.children;

		if (
			fiber.tag === 6 ||
			(typeof fiber.type === 'string' &&
				(typeof children === 'string' || typeof children === 'number'))
		) {
			texts++;
		}

		if (fiber.sibling) stack.push(fiber.sibling);
		if (fiber.child) stack.push(fiber.child);
	}

	return JSON.stringify({ rendered: probe.rendered, texts, error: probe.error });
}

export function settingsProbeScript(): string {
	return deviceScript(readSettingsProbe);
}

/**
 * @description Leaves the screen the matrix opened, back to the chat.
 * @returns A script whose result is `closed`.
 */
function closeScreen() {
	const navigation = unbound.metro
		.findByProps<{ getRootNavigationRef(): { canGoBack(): boolean; goBack(): void } }>(
			'getRootNavigationRef',
		)
		.getRootNavigationRef();

	if (navigation.canGoBack()) navigation.goBack();

	return 'closed';
}

export function closeScreenScript(): string {
	return deviceScript(closeScreen);
}

export const selfTestReportsSchema = z.record(
	z.string(),
	z.object({ ok: z.boolean(), detail: z.string(), nothingDrawn: z.boolean() }),
);

type SelfTestReport = { ok: boolean; detail: string; nothingDrawn: boolean };

function runSelfTests() {
	const reports: Record<string, SelfTestReport> = {};
	const message = (failure: unknown) =>
		String(failure && (failure as Error).message ? (failure as Error).message : failure);

	return (async () => {
		for (const entity of unbound.plugins.entities.values()) {
			const instance = entity.started ? entity.instance : undefined;

			if (typeof instance?.selfTest !== 'function') continue;

			try {
				const report = (await instance.selfTest()) as Partial<
					Record<keyof SelfTestReport, unknown>
				> | null;

				if (report) {
					reports[entity.id] = {
						ok: Boolean(report.ok),
						detail: String(report.detail),
						nothingDrawn: Boolean(report.nothingDrawn),
					};
				}
			} catch (failure) {
				reports[entity.id] = { ok: false, detail: message(failure), nothingDrawn: false };
			}
		}

		return JSON.stringify(reports);
	})();
}

/**
 * @description Runs the self-test of every running plugin, such as after the matrix scrolled the chat, where cells are reused and stale drawing shows up.
 * @returns A script whose result is each plugin's report by id, as JSON.
 */
export function selfTestsScript(): string {
	return deviceScript(runSelfTests);
}

export const MATRIX_TOAST_MS = 300;

/**
 * @description Sets how long Unbound's toasts stay on screen, so the matrix's screenshots are not covered by the toast each plugin reload shows.
 * @param milliseconds The duration to set, or `null` to remove the setting.
 * @returns A script whose result is the previous value as JSON, `null` when unset.
 */
function setToastDuration(milliseconds: number | null) {
	const store = unbound.storage.getStore('unbound');
	const previous = store.get('toasts.duration', null);

	if (milliseconds === null) store.remove('toasts.duration');
	else store.set('toasts.duration', milliseconds);

	return JSON.stringify(previous);
}

export function toastDurationScript(milliseconds: number | null): string {
	return deviceScript(setToastDuration, milliseconds);
}

function logLines(path: string, needles: string[]) {
	return Promise.resolve(unbound.fs.read(path)).then(
		(text) =>
			JSON.stringify(
				String(text)
					.split('\n')
					.filter((line) => needles.some((needle) => line.includes(needle))),
			),
		() => '[]',
	);
}

const LOG_PATH = 'Unbound/Logs/unbound.log';

export function pluginLogScript(): string {
	return deviceScript(logLines, LOG_PATH, [
		'off the main thread',
		' E [',
		'Native plugin hook skipped in',
	]);
}

function checkFixtures(channel: string, marker: string) {
	const { metro } = unbound;
	const selected = metro.findStore<{ getChannelId(): string }>('SelectedChannel').getChannelId();
	const loaded = metro
		.findStore<{ getMessages(channel: string): StoredMessages }>('Message')
		.getMessages(channel);
	const messages = loaded?.toArray ? loaded.toArray() : [];
	const staged = messages.some((message) => message.content === marker);

	return selected === channel && staged ? 'present' : 'missing';
}

export function fixturesPresentScript(channel: string): string {
	return deviceScript(checkFixtures, channel, FIXTURE_MESSAGES[2]!);
}

function stopPlugin(id: string) {
	return Promise.resolve(unbound.plugins.stop(id)).then(() => 'stopped');
}

export function restoreScript(id: string): string {
	return deviceScript(stopPlugin, id);
}

export const SCROLL_FILLER = 30;

function stageScrollFiller(channel: string, count: number) {
	const { metro } = unbound;
	const actions = metro.findByProps<MessageActions>('sendMessage', 'receiveMessage');
	const bot = metro.findByProps<BotMessages>('createBotMessage');
	const self = metro.findStore<{ getCurrentUser(): CurrentUser }>('User').getCurrentUser().id;
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

function clearStaged(channel: string) {
	const { metro } = unbound;
	const bot = metro.findByProps<BotMessages>('createBotMessage');
	const dispatcher = metro.findByProps<Dispatcher>('dispatch', 'subscribe');
	const author = (bot.createBotMessage({ channelId: channel, content: '' }) as StagedAuthor)
		.author?.id;
	const loaded = metro
		.findStore<{ getMessages(channel: string): StoredMessages }>('Message')
		.getMessages(channel);
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

export function scrollFillerScript(channel: string): string {
	return deviceScript(stageScrollFiller, channel, SCROLL_FILLER);
}

export function toastLogScript(): string {
	return deviceScript(logLines, LOG_PATH, ['[Toasts]']);
}
