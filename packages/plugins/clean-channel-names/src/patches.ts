import { flux, patcher, storage } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { createNameCache } from '~/lib/name-cache';

type Channel = { id: string; type?: number; name?: string };

const ORIGINAL = Symbol.for('unbound.clean-channel-names.original');

const SHOWN = Symbol.for('unbound.clean-channel-names.shown');

type Shown = { generation: number; source: string; value: string };

type CleanedChannel = Channel & { [ORIGINAL]?: string; [SHOWN]?: Shown };

const cleaned = new Set<CleanedChannel>();
const cache = createNameCache();

let editing: string | null = null;
let generation = 0;

function keepsName(id: string): boolean {
	return id === editing || cache.isKept(id, settings.kept);
}

function clean(channel: CleanedChannel | undefined): void {
	if (!channel || typeof channel.name !== 'string' || ORIGINAL in channel) return;

	channel[ORIGINAL] = channel.name;
	Object.defineProperty(channel, 'name', {
		configurable: true,
		enumerable: true,
		get(this: CleanedChannel) {
			const original = this[ORIGINAL] ?? '';
			const shown = this[SHOWN];

			if (shown?.generation === generation && shown.source === original) return shown.value;

			const value = keepsName(this.id)
				? original
				: cache.clean(original, this.type, { spaces: settings.spaces });

			this[SHOWN] = { generation, source: original, value };

			return value;
		},
		set(this: CleanedChannel, value: string) {
			this[ORIGINAL] = value;
		},
	});
	cleaned.add(channel);
}

type ChannelsById = Record<string, CleanedChannel | undefined>;

type ChannelStore = {
	getChannel(id: string): CleanedChannel | undefined;
	getMutableGuildChannelsForGuild(guildId: string): ChannelsById;
	getMutableBasicGuildChannelsForGuild(guildId: string): ChannelsById;
};

// `getChannels` groups a guild's channels by kind, such as `SELECTABLE` and `VOCAL`.
type GuildChannelStore = {
	getChannels(guildId: string): Record<string, unknown>;
};

function cleanAll(channels: ChannelsById | undefined): void {
	for (const channel of Object.values(channels ?? {})) clean(channel);
}

function cleanGroups(groups: Record<string, unknown> | undefined): void {
	for (const group of Object.values(groups ?? {})) {
		if (!Array.isArray(group)) continue;

		for (const entry of group) clean((entry as { channel?: CleanedChannel })?.channel);
	}
}

/**
 * @description Shows channel names cleaned. Patches the `ChannelStore` and `GuildChannelStore` getters the chat header and
 * channel list read to give each channel record a `name` getter that cleans the name it keeps, re-cleans records a
 * channel update replaces, and shows the original while the channel's settings are open.
 * @returns A function that stops following setting changes.
 */
export function patchChannelNames(): () => void {
	const ChannelStore = flux.getStore('Channel') as unknown as ChannelStore;
	const GuildChannelStore = flux.getStore('GuildChannel') as unknown as
		| GuildChannelStore
		| undefined;

	patcher.after(ChannelStore, 'getChannel', ({ result }) => {
		clean(result as CleanedChannel | undefined);

		return result;
	});

	for (const getter of [
		'getMutableGuildChannelsForGuild',
		'getMutableBasicGuildChannelsForGuild',
	] as const) {
		if (typeof ChannelStore[getter] !== 'function') continue;

		patcher.after(ChannelStore, getter, ({ result }) => {
			cleanAll(result as ChannelsById | undefined);

			return result;
		});
	}

	if (typeof GuildChannelStore?.getChannels === 'function') {
		patcher.after(GuildChannelStore, 'getChannels', ({ result }) => {
			cleanGroups(result as Record<string, unknown> | undefined);

			return result;
		});
	}

	// An update replaces the channel's record with a new object, which no getter may have returned yet.
	for (const type of ['CHANNEL_CREATE', 'CHANNEL_UPDATES']) {
		flux.onAction(type, (action) => {
			const { channel, channels } = action as {
				channel?: { id?: string };
				channels?: { id?: string }[];
			};

			for (const each of channels ?? (channel ? [channel] : [])) {
				if (each?.id) ChannelStore.getChannel(each.id);
			}
		});
	}

	flux.onAction('CHANNEL_SETTINGS_INIT', (action) => {
		editing = (action as { channelId?: string }).channelId ?? null;
		generation++;
	});
	flux.onAction('CHANNEL_SETTINGS_CLOSE', () => {
		editing = null;
		generation++;
	});

	return storage.onChange(
		({ store }) => store === addon.id,
		() => {
			generation++;
		},
	);
}

/**
 * @description Gives every cleaned channel record back its plain `name`.
 */
export function restoreChannelNames(): void {
	for (const channel of cleaned) {
		const original = channel[ORIGINAL];

		delete channel[ORIGINAL];
		delete channel[SHOWN];
		Object.defineProperty(channel, 'name', {
			configurable: true,
			enumerable: true,
			writable: true,
			value: original,
		});
	}

	cleaned.clear();
}
