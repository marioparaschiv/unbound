import { settings } from '@unbound-app/settings';
import { flux, metro, patcher } from '@unbound-app/api';

import { PLAY_IN_APP_MESSAGE_SOUND_PATH } from '~/lib/constants';
import { mayPlaySound, type PingLookups } from '~/lib/ping-rules';
import { oldestUnreadMessageId, resetReadStateReport, verifyReadState } from '~/lib/read-state';
import { findSoundTarget, recentMessages } from '~/lib/sound-target';

type PlaySound = (...args: unknown[]) => unknown;

type SoundModule = { default?: PlaySound; playInAppMessageSound?: PlaySound };

type SoundExport = 'default' | 'playInAppMessageSound';

const ChannelStore = flux.getStore('Channel', { lazy: true });
const UserStore = flux.getStore('User', { lazy: true });

const lookups: PingLookups = {
	channelType: (channelId) => ChannelStore.getChannel(channelId)?.type,
	currentUserId: () => UserStore.getCurrentUser()?.id,
	oldestUnreadMessageId,
	settings: () => settings,
};

function soundExport(module: SoundModule): SoundExport | undefined {
	if (typeof module.playInAppMessageSound === 'function') return 'playInAppMessageSound';
	if (typeof module.default === 'function') return 'default';
}

/**
 * @description Stops Discord's in-app message sound for a DM message unless it is the first unread one, or a mention the
 * settings allow, by patching Discord's `playInAppMessageSound` once it loads.
 */
export function patchPlayInAppMessageSound(): void {
	// A later start may report a missing read state again.
	resetReadStateReport();

	metro.onModuleLoaded(
		metro.filters.byFilePath(PLAY_IN_APP_MESSAGE_SOUND_PATH),
		(module: SoundModule) => {
			const name = soundExport(module);

			if (!name) {
				logger.warn('Ping limiting skipped: playInAppMessageSound has no sound function.');

				return;
			}

			patcher.instead(
				module as Record<SoundExport, PlaySound>,
				name,
				({ args, original, this: self }) => {
					if (!verifyReadState()) return original.apply(self, args);

					const message = recentMessages.resolve(findSoundTarget(args), Date.now());

					if (!mayPlaySound(message, lookups)) return undefined;

					return original.apply(self, args);
				},
			);
		},
	);
}
