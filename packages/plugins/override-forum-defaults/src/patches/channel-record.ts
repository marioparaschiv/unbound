import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import { recordSkip } from '@unbound-plugins/shared/lifecycle/health';
import { patcher } from '@unbound-app/api';

import { defaultLayout, defaultSortOrder, type ForumChannel } from '~/defaults';
import { CHANNEL_RECORD_PATH, PLUGIN_NAME, SETTINGS } from '~/constants';
import { settings } from '~/modules';

type ChannelPrototype = ForumChannel & {
	getDefaultLayout: () => unknown;
	getDefaultSortOrder: () => unknown;
};

type ChannelRecordModule = {
	ChannelRecordBase?: { prototype?: Partial<ChannelPrototype> };
};

function hasDefaultGetters(
	prototype: Partial<ChannelPrototype> | undefined,
): prototype is ChannelPrototype {
	return (
		typeof prototype?.getDefaultLayout === 'function' &&
		typeof prototype.getDefaultSortOrder === 'function'
	);
}

function skip(reason: string) {
	console.error(`[${PLUGIN_NAME}] Skipped, ${reason}.`);
	recordSkip(reason);
}

function overrideDefaults(prototype: ChannelPrototype): () => void {
	const unpatchLayout = patcher.instead(
		prototype,
		'getDefaultLayout',
		({ args, original, this: channel }) =>
			defaultLayout(
				channel as ForumChannel,
				settings.get('defaultLayout', SETTINGS.defaultLayout),
				() => original.apply(channel, args),
			),
	);

	const unpatchSortOrder = patcher.instead(
		prototype,
		'getDefaultSortOrder',
		({ args, original, this: channel }) =>
			defaultSortOrder(
				channel as ForumChannel,
				settings.get('defaultSortOrder', SETTINGS.defaultSortOrder),
				() => original.apply(channel, args),
			),
	);

	return () => {
		unpatchSortOrder();
		unpatchLayout();
	};
}

/**
 * @description Replaces the default layout and sort order every channel record reports, once `records/ChannelRecord.tsx` loads.
 * Discord's `ForumChannelStore` reads them for a forum you have not changed yourself, and the display settings sheet resets to them.
 * @returns A function that stops waiting for the module and removes the patches.
 */
export function patchChannelRecord(): () => void {
	return whenLoaded<ChannelRecordModule>(CHANNEL_RECORD_PATH, (module: ChannelRecordModule) => {
		const prototype = module.ChannelRecordBase?.prototype;

		if (!hasDefaultGetters(prototype)) {
			skip('ChannelRecordBase has no getDefaultLayout or getDefaultSortOrder');

			return;
		}

		return overrideDefaults(prototype);
	});
}

export default patchChannelRecord;
