import type { Navigation } from '@unbound-app/types/components';

import type { PendingUpdate } from '~/updates/addon-updates';
import { Manager } from '~/addons/manager';
import { icons } from '~/assets/api';
import { format } from '~/i18n/api';

import { openChangelog } from './open-changelog';
import UpdateButton from './update-button';

/**
 * @description Opens a pending addon update's changelog, with the button that applies it and returns.
 * @param navigation The current screen's navigation.
 * @param pending The addon update.
 */
export function openAddonChangelog(navigation: Navigation, pending: PendingUpdate): void {
	const { version } = pending.update;

	openChangelog(navigation, {
		name: pending.name,
		icon: icons[Manager.for(pending.kind).icon],
		installed: pending.from,
		offered: version,
		changelogs: pending.update.changelogs,
		action: (
			<UpdateButton
				id={pending.id}
				size='lg'
				grow
				text={format('UNBOUND_UPDATES_UPDATE_TO', { version })}
				onUpdated={() => navigation.goBack()}
			/>
		),
	});
}

export default openAddonChangelog;
