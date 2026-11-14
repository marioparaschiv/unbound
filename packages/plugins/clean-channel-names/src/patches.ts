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

/**
 * @description Shows channel names cleaned. Patches `getChannel` on Discord's `ChannelStore` to give each channel record a
 * `name` getter that cleans the name it keeps, and shows the original while the channel's settings are open.
 * @returns A function that stops following setting changes.
 */
export function patchChannelNames(): () => void {
	const ChannelStore = flux.getStore('Channel') as unknown as {
		getChannel(id: string): CleanedChannel | undefined;
		emitChange(): void;
	};

	patcher.after(ChannelStore, 'getChannel', ({ result }) => {
		clean(result as CleanedChannel | undefined);

		return result;
	});

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
