import type { EntityDisplay } from '@unbound-app/types/settings';

import { findStoreLazy } from '~/metro/wrappers';

const Users = findStoreLazy('User');
const Channels = findStoreLazy('Channel');
const Guilds = findStoreLazy('Guild');

/**
 * @description Reads the name Discord's stores hold for an id: a user's username, a channel's or server's name. Roles have no store lookup here.
 * @param entity What the id names.
 * @param id The id; empty for none.
 * @returns The name, or `undefined` when the stores do not know the id.
 */
function useEntityName(entity: EntityDisplay, id: string): string | undefined {
	if (!id) return;

	switch (entity) {
		case 'user':
			return Users?.getUser?.(id)?.username;
		case 'channel':
			return Channels?.getChannel?.(id)?.name;
		case 'guild':
			return Guilds?.getGuild?.(id)?.name;
		default:
			return;
	}
}

export default useEntityName;
