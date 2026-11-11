import whileEnabled from '@unbound-plugins/shared/settings/while-enabled';

import { combineCleanups, forceAnimateArguments, forceProps, onPathLoaded } from '~/patches/force';
import {
	AVATAR_UTILS_PATH,
	GUILD_RECORD_ARGUMENTS,
	GUILD_RECORD_PATH,
	SERVER_ARGUMENTS,
} from '~/lib/constants';

function enable(): () => void {
	return combineCleanups([
		onPathLoaded(AVATAR_UTILS_PATH, (module) =>
			forceAnimateArguments(module, SERVER_ARGUMENTS),
		),
		onPathLoaded(GUILD_RECORD_PATH, (module) =>
			forceAnimateArguments(module, GUILD_RECORD_ARGUMENTS),
		),
		forceProps('modules/guild/native/GuildIcon.tsx', { animate: true }),
	]);
}

/**
 * @description Animates server icons and banners, not only the selected server's, while the `servers` setting is on.
 * Patches the guild icon and banner builders of `utils/AvatarUtils.tsx` and `records/GuildRecord.tsx`,
 * and sets `animate` on `GuildIcon`.
 */
export function animateServers(): void {
	whileEnabled('servers', enable);
}
