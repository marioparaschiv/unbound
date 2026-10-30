import { z } from '@unbound-app/contracts/zod';

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
	selfTest: z.optional(z.object({ ok: z.boolean(), detail: z.string() })),
});

export type CycleResult = z.infer<typeof cycleResultSchema>;

/** The log lines {@link pluginLogScript} and {@link toastLogScript} return. */
export const logLinesSchema = z.array(z.string());

export function cycleScript(id: string): string {
	return `(async function () {
	var manager = unbound.plugins;
	var read = unbound.native && unbound.native.getNativeResources;
	var hooks = function () { var counts = read ? read() : null; return counts ? counts.hooks : 0; };
	var settle = function () { return new Promise(function (resolve) { setTimeout(resolve, 300); }); };
	var message = function (failure) { return String(failure && failure.message ? failure.message : failure); };
	var id = ${JSON.stringify(id)};
	var entity = manager.getEntity(id);
	var result = { id: id, installed: Boolean(entity), wasStarted: Boolean(entity && entity.started), error: '', restarted: false, updateError: '', updated: false, hooksBefore: 0, hooksStopped: 0, hooksAfter: 0, hooksUpdated: 0 };
	if (!entity) return JSON.stringify(result);
	if (!result.wasStarted) {
		try { await manager.start(id); } catch (failure) { result.error = message(failure); }
		await settle();
	}
	var before = manager.errors.get(id);
	result.hooksBefore = hooks();
	var stopping = Date.now();
	try { await manager.stop(id); } catch (failure) { result.error = result.error || message(failure); }
	result.stopMs = Date.now() - stopping;
	result.hooksStopped = hooks();
	var starting = Date.now();
	try { await manager.start(id); } catch (failure) { result.error = result.error || message(failure); }
	result.startMs = Date.now() - starting;
	await settle();
	var after = manager.errors.get(id);
	if (!result.error && after && after !== before) result.error = message(after);
	entity = manager.getEntity(id);
	result.restarted = Boolean(entity && entity.started);
	result.hooksAfter = hooks();
	if (result.restarted) {
		try {
			var update = await manager.reload(id, entity.bundle, entity.data);
			if (!update.ok) result.updateError = message(update.error);
		} catch (failure) { result.updateError = message(failure); }
		await settle();
	}
	var updated = manager.getEntity(id);
	result.updated = Boolean(updated && updated.started);
	result.hooksUpdated = hooks();
	await new Promise(function (resolve) { setTimeout(resolve, 1000); });
	var instance = updated && updated.instance;
	if (result.updated && instance && typeof instance.selfTest === 'function') {
		try {
			var report = await instance.selfTest();
			if (report) result.selfTest = { ok: Boolean(report.ok), detail: String(report.detail) };
		} catch (failure) { result.selfTest = { ok: false, detail: message(failure) }; }
	}
	return JSON.stringify(result);
})()`;
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

export function fixtureScript(guild: string, channel: string): string {
	return `(async function () {
	var metro = unbound.metro;
	metro.findByProps('transitionToGuild').transitionToGuild(${JSON.stringify(guild)}, ${JSON.stringify(channel)});
	await new Promise(function (resolve) { setTimeout(resolve, 1500); });
	var actions = metro.findByProps('sendMessage', 'receiveMessage');
	var bot = metro.findByProps('createBotMessage');
	var self = metro.findStore('User').getCurrentUser().id;
	var loaded = metro.findStore('Message').getMessages(${JSON.stringify(channel)});
	var linked = (loaded && loaded.toArray ? loaded.toArray() : []).filter(function (message) { return message.author && !message.author.bot && /^\\d+$/.test(message.id); }).pop();
	var make = function (fields) { return Object.assign(bot.createBotMessage({ channelId: ${JSON.stringify(channel)}, content: '' }), { flags: 0 }, fields); };
	var reference = function (message, type) { return { type: type, channel_id: ${JSON.stringify(channel)}, guild_id: ${JSON.stringify(guild)}, message_id: message.id }; };
	var original = make({ content: ${JSON.stringify(LAYOUT_FIXTURES.original)} });
	var me = metro.findStore('User').getCurrentUser();
	var image = 'https://cdn.discordapp.com/avatars/' + me.id + '/' + me.avatar + '.png?size=128';
	actions.receiveMessage(${JSON.stringify(channel)}, original);
	[
		make({ type: 19, content: ${JSON.stringify(LAYOUT_FIXTURES.reply)}, message_reference: reference(original, 0), referenced_message: original }),
		make({ attachments: [{ id: String(Date.now()), filename: 'fixture.png', url: image, proxy_url: image, width: 128, height: 128, content_type: 'image/png', size: 4096 }] }),
		make({ message_reference: reference(original, 1), message_snapshots: [{ message: { content: ${JSON.stringify(LAYOUT_FIXTURES.forwarded)}, timestamp: new Date().toISOString(), type: 0, embeds: [], attachments: [], flags: 0 } }] }),
	].forEach(function (message) { actions.receiveMessage(${JSON.stringify(channel)}, message); });
	var contents = ${JSON.stringify(FIXTURE_MESSAGES)}.filter(function (content) { return linked || content.indexOf('{message}') === -1; });
	for (var index = 0; index < contents.length; index++) {
		var content = contents[index].replace('{self}', self).replace('{guild}', ${JSON.stringify(guild)}).replace('{channel}', ${JSON.stringify(channel)}).replace('{message}', linked ? linked.id : '');
		actions.receiveMessage(${JSON.stringify(channel)}, bot.createBotMessage({ channelId: ${JSON.stringify(channel)}, content: content }));
	}
	await new Promise(function (resolve) { setTimeout(resolve, 1500); });
	return 'staged';
})()`;
}

export function developerModeScript(enabled: boolean): string {
	return `(function () {
	var store = unbound.storage.getStore('unbound');
	var previous = store.get('developer-mode', false);
	store.set('developer-mode', ${enabled});
	return String(previous);
})()`;
}

export const MATRIX_TOAST_MS = 300;

/**
 * @description Sets how long Unbound's toasts stay on screen, so the matrix's screenshots are not covered by the toast each plugin reload shows.
 * @param milliseconds The duration to set, or `null` to remove the setting.
 * @returns A script whose result is the previous value as JSON, `null` when unset.
 */
export function toastDurationScript(milliseconds: number | null): string {
	return `(function () {
	var store = unbound.storage.getStore('unbound');
	var previous = store.get('toasts.duration', null);
	${milliseconds === null ? "store.remove('toasts.duration');" : `store.set('toasts.duration', ${milliseconds});`}
	return JSON.stringify(previous);
})()`;
}

export function pluginLogScript(): string {
	return `Promise.resolve(unbound.fs.read('Unbound/Logs/unbound.log')).then(function (text) {
	return JSON.stringify(String(text).split('\\n').filter(function (line) { return line.indexOf('off the main thread') !== -1 || line.indexOf(' E [') !== -1 || line.indexOf('Native plugin hook skipped in') !== -1; }));
}, function () { return '[]'; })`;
}

export function fixturesPresentScript(channel: string): string {
	return `(function () {
	var metro = unbound.metro;
	var selected = metro.findStore('SelectedChannel').getChannelId();
	var loaded = metro.findStore('Message').getMessages(${JSON.stringify(channel)});
	var messages = loaded && loaded.toArray ? loaded.toArray() : [];
	var staged = messages.some(function (message) { return message.content === ${JSON.stringify(FIXTURE_MESSAGES[2])}; });
	return selected === ${JSON.stringify(channel)} && staged ? 'present' : 'missing';
})()`;
}

export function restoreScript(id: string): string {
	return `Promise.resolve(unbound.plugins.stop(${JSON.stringify(id)})).then(function () { return "stopped"; })`;
}

export const SCROLL_FILLER = 30;

export function scrollFillerScript(channel: string): string {
	return `(async function () {
	var metro = unbound.metro;
	var actions = metro.findByProps('sendMessage', 'receiveMessage');
	var bot = metro.findByProps('createBotMessage');
	var self = metro.findStore('User').getCurrentUser().id;
	for (var index = 0; index < ${SCROLL_FILLER}; index++) {
		var content = index % 3 === 0 ? 'Scroll filler ' + index + ' for <@' + self + '>' : 'Scroll filler ' + index;
		actions.receiveMessage(${JSON.stringify(channel)}, bot.createBotMessage({ channelId: ${JSON.stringify(channel)}, content: content }));
	}
	await new Promise(function (resolve) { setTimeout(resolve, 1500); });
	return 'staged';
})()`;
}

export function toastLogScript(): string {
	return `Promise.resolve(unbound.fs.read('Unbound/Logs/unbound.log')).then(function (text) {
	return JSON.stringify(String(text).split('\\n').filter(function (line) { return line.indexOf('[Toasts]') !== -1; }));
}, function () { return '[]'; })`;
}
