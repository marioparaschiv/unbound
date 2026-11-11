import { skipFeature } from '@unbound-plugins/shared/lifecycle/features';
import { patcher, metro } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { defaultLayout, defaultSortOrder, type ForumChannel } from '~/forum-defaults/defaults';
import { ChannelRecord } from '~/forum-defaults/modules';

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

function overrideDefaults(prototype: ChannelPrototype) {
	patcher.instead(prototype, 'getDefaultLayout', ({ args, original, this: channel }) =>
		defaultLayout(channel as ForumChannel, settings.defaultLayout, () =>
			original.apply(channel, args),
		),
	);

	patcher.instead(prototype, 'getDefaultSortOrder', ({ args, original, this: channel }) =>
		defaultSortOrder(channel as ForumChannel, settings.defaultSortOrder, () =>
			original.apply(channel, args),
		),
	);
}

/**
 * @description Replaces the default layout and sort order every channel record reports, once `records/ChannelRecord.tsx` loads.
 * Patches `getDefaultLayout` and `getDefaultSortOrder` on `ChannelRecordBase`, which Discord's `ForumChannelStore`
 * reads for a forum you have not changed yourself and the display settings sheet resets to.
 * The Addon scope ends the wait and removes the patches when the plugin stops.
 */
export function startForumDefaults(): void {
	metro.onModuleLoaded(ChannelRecord, (module: ChannelRecordModule) => {
		const prototype = module.ChannelRecordBase?.prototype;

		if (!hasDefaultGetters(prototype)) {
			skipFeature('ChannelRecordBase has no getDefaultLayout or getDefaultSortOrder');

			return;
		}

		overrideDefaults(prototype);
	});
}
