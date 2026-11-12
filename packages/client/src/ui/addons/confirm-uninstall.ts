import { dependentsOf } from '~/addons/dependencies';
import { confirm, showDialog } from '~/dialogs/api';
import { messages, format } from '~/i18n/api';
import type { Addon } from '~/addons/addon';
import { show } from '~/toasts/api';

type UninstallingManager = {
	getAddons: () => Addon[];
	uninstall: (id: string) => void | Promise<void>;
};

async function uninstallInOrder(manager: UninstallingManager, addons: Addon[]) {
	for (const addon of addons) {
		await manager.uninstall(addon.id);
	}
}

/**
 * @description Asks before uninstalling an addon. When other plugins depend on it, the prompt names them and
 * offers uninstalling the library alone or together with every plugin that needs it, dependents first.
 * @param manager The addon's manager.
 * @param addon The addon to uninstall.
 */
export function confirmUninstall(manager: UninstallingManager, addon: Addon) {
	const dependents = dependentsOf(addon.id, manager.getAddons()) as Addon[];
	const name = addon.name;

	if (dependents.length === 0) {
		void confirm('UNBOUND_DELETE_TITLE', {
			titleVars: { name },
			body: 'UNBOUND_DELETE_BODY',
			confirm: 'UNBOUND_DELETE',
			destructive: true,
		}).then((confirmed) => confirmed && manager.uninstall(addon.id));

		return;
	}

	const names = dependents.map((dependent) => dependent.name).join(', ');

	showDialog({
		title: format('UNBOUND_DELETE_TITLE', { name }),
		body: format('UNBOUND_DELETE_LIBRARY_BODY', { count: dependents.length, names }),
		buttons: [
			{
				label: format('UNBOUND_DELETE_LIBRARY_AND_DEPENDENTS', {
					count: dependents.length,
				}),
				variant: 'destructive',
				onPress: () =>
					void uninstallInOrder(manager, [...dependents, addon]).then(() =>
						show({
							title: messages.UNBOUND_DELETE,
							content: format('UNBOUND_DELETED_WITH_DEPENDENTS', {
								name,
								count: dependents.length,
							}),
							icon: 'TrashIcon',
						}),
					),
			},
			{
				label: messages.UNBOUND_DELETE_LIBRARY_ONLY,
				variant: 'secondary',
				onPress: () => void manager.uninstall(addon.id),
			},
		],
		cancel: messages.UNBOUND_CANCEL,
	});
}

export default confirmUninstall;
