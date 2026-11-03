import { recordSkip } from '@unbound-plugins/shared/lifecycle/health';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import { patcher } from '@unbound-app/api';

import { PLAY_IN_APP_MESSAGE_SOUND_PATH, PLUGIN_NAME } from '~/constants';
import { ChannelStore, UserStore, settings } from '~/modules';
import { mayPlaySound, readPingSettings, type PingLookups } from '~/ping-rules';
import { oldestUnreadMessageId, verifyReadState } from '~/read-state';
import { findSoundTarget, type RecentMessages } from '~/sound-target';

type PlaySound = (...args: unknown[]) => unknown;

type SoundModule = { default?: PlaySound };

const lookups: PingLookups = {
	channelType: (channelId) => ChannelStore.getChannel(channelId)?.type,
	currentUserId: () => UserStore.getCurrentUser()?.id,
	oldestUnreadMessageId,
	settings: () =>
		readPingSettings((key, fallback) => settings.get(key, fallback) as typeof fallback),
};

function skip(reason: string): void {
	console.error(`[${PLUGIN_NAME}] Skipped, ${reason}.`);
	recordSkip(reason);
}

/**
 * @description Stops Discord's in-app message sound for a DM message unless it is the first unread one, or a mention the settings allow.
 * @param recent The messages received lately, to match a sound call that does not pass its message.
 * @returns A function that removes the patch, or stops waiting for the module.
 */
export function patchPlayInAppMessageSound(recent: RecentMessages): () => void {
	return whenLoaded<SoundModule>(PLAY_IN_APP_MESSAGE_SOUND_PATH, (module: SoundModule) => {
		if (typeof module.default !== 'function') {
			return skip('playInAppMessageSound has no default function');
		}

		return patcher.instead(
			module as { default: PlaySound },
			'default',
			({ args, original, this: self }) => {
				if (!verifyReadState()) return original.apply(self, args);

				const message = recent.resolve(findSoundTarget(args), Date.now());

				if (!mayPlaySound(message, lookups)) return undefined;

				return original.apply(self, args);
			},
		);
	});
}
