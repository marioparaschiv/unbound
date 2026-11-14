import { parseIdList } from '@unbound-plugins/shared/entities/id-list';
import { flux, patcher } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { cleanChannelName } from '~/lib/clean';

type Channel = { id: string; type?: number; name?: string };

const ORIGINAL = Symbol.for('unbound.clean-channel-names.original');

type CleanedChannel = Channel & { [ORIGINAL]?: string };

const cleaned = new Set<CleanedChannel>();

let editing: string | null = null;

function keepsName(id: string): boolean {
	return id === editing || parseIdList(settings.kept).includes(id);
}

function clean(channel: CleanedChannel | undefined): void {
	if (!channel || typeof channel.name !== 'string' || ORIGINAL in channel) return;

	channel[ORIGINAL] = channel.name;
	Object.defineProperty(channel, 'name', {
		configurable: true,
		enumerable: true,
		get(this: CleanedChannel) {
			const original = this[ORIGINAL] ?? '';

			return keepsName(this.id)
				? original
				: cleanChannelName(original, this.type, { spaces: settings.spaces });
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
 */
export function patchChannelNames(): void {
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
	});
	flux.onAction('CHANNEL_SETTINGS_CLOSE', () => {
		editing = null;
	});
}

/**
 * @description Gives every cleaned channel record back its plain `name`.
 */
export function restoreChannelNames(): void {
	for (const channel of cleaned) {
		const original = channel[ORIGINAL];

		delete channel[ORIGINAL];
		Object.defineProperty(channel, 'name', {
			configurable: true,
			enumerable: true,
			writable: true,
			value: original,
		});
	}

	cleaned.clear();
}
