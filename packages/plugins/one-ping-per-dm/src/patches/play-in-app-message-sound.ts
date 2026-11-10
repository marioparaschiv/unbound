import { skipFeature } from '@unbound-plugins/shared/lifecycle/features';
import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import { patcher } from '@unbound-app/api';

import { PLAY_IN_APP_MESSAGE_SOUND_PATH } from '~/constants';
import { ChannelStore, UserStore, settings } from '~/modules';
import { mayPlaySound, readPingSettings, type PingLookups } from '~/ping-rules';
import { oldestUnreadMessageId, verifyReadState } from '~/read-state';
import { findSoundTarget, type RecentMessages } from '~/sound-target';

type PlaySound = (...args: unknown[]) => unknown;

type SoundModule = { default?: PlaySound; playInAppMessageSound?: PlaySound };

type SoundExport = 'default' | 'playInAppMessageSound';

function soundExport(module: SoundModule): SoundExport | undefined {
	if (typeof module.playInAppMessageSound === 'function') return 'playInAppMessageSound';
	if (typeof module.default === 'function') return 'default';
}

const lookups: PingLookups = {
	channelType: (channelId) => ChannelStore.getChannel(channelId)?.type,
	currentUserId: () => UserStore.getCurrentUser()?.id,
	oldestUnreadMessageId,
	settings: () =>
		readPingSettings((key, fallback) => settings.get(key, fallback) as typeof fallback),
};

/**
 * @description Stops Discord's in-app message sound for a DM message unless it is the first unread one, or a mention the settings allow.
 * @param recent The messages received lately, to match a sound call that does not pass its message.
 * @returns A function that removes the patch, or stops waiting for the module.
 */
export function patchPlayInAppMessageSound(recent: RecentMessages): () => void {
	return whenLoaded<SoundModule>(PLAY_IN_APP_MESSAGE_SOUND_PATH, (module: SoundModule) => {
		const name = soundExport(module);

		if (!name) return skipFeature('playInAppMessageSound has no sound function');

		return patcher.instead(
			module as Record<SoundExport, PlaySound>,
			name,
			({ args, original, this: self }) => {
				if (!verifyReadState()) return original.apply(self, args);

				const message = recent.resolve(findSoundTarget(args), Date.now());

				if (!mayPlaySound(message, lookups)) return undefined;

				return original.apply(self, args);
			},
		);
	});
}
