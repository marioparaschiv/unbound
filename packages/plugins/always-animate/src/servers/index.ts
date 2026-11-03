import { whenLoaded } from '@unbound-plugins/shared/metro/when-loaded';
import type { AnyProps } from '@unbound-app/api/metro';

import { combineCleanups, forceAnimateArguments, forceProps } from '~/force/patches';
import {
	AVATAR_UTILS_PATH,
	GUILD_ICON_PATH,
	GUILD_RECORD_ARGUMENTS,
	GUILD_RECORD_PATH,
	SERVER_ARGUMENTS,
} from '~/constants';

/**
 * @description Animates server icons and banners, not only the selected server's.
 * Patches the guild icon and banner builders of `utils/AvatarUtils.tsx` and `records/GuildRecord.tsx`,
 * and sets `animate` on `GuildIcon`.
 * @returns A function that removes the patches.
 */
export function animateServers(): () => void {
	return combineCleanups([
		whenLoaded<AnyProps>(AVATAR_UTILS_PATH, (module) =>
			forceAnimateArguments(module, SERVER_ARGUMENTS),
		),
		whenLoaded<AnyProps>(GUILD_RECORD_PATH, (module) =>
			forceAnimateArguments(module, GUILD_RECORD_ARGUMENTS),
		),
		forceProps(GUILD_ICON_PATH, { animate: true }),
	]);
}
