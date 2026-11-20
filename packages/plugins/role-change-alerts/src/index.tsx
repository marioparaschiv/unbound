import { watchRoleChanges } from '~/flux/member-updates';

import '~/lib/types';

export function start() {
	watchRoleChanges();
}
