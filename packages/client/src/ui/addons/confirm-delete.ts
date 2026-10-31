import type { Addon } from '@unbound-app/types';

import { dependentsOf } from '~/lib/addon-dependencies';
import { Messages, format } from '~/api/i18n';
import { showDialog } from '~/api/dialogs';
import { showToast } from '~/api/toasts';

type DeletingManager = {
	getEntities: () => Addon[];
	delete: (id: string) => void | Promise<void>;
};

async function deleteInOrder(manager: DeletingManager, addons: Addon[]) {
	for (const addon of addons) {
		await manager.delete(addon.id);
	}
}

/**
 * @description Asks before deleting an addon. When other plugins depend on it, the prompt names them and
 * offers deleting the library alone or together with every plugin that needs it, dependents first.
 * @param manager The addon's manager.
 * @param addon The addon to delete.
 */
export function confirmDelete(manager: DeletingManager, addon: Addon) {
	const dependents = dependentsOf(addon.id, manager.getEntities()) as Addon[];
	const name = addon.data.name;

	if (dependents.length === 0) {
		showDialog({
			title: format('UNBOUND_DELETE_TITLE', { name }),
			body: Messages.UNBOUND_DELETE_BODY,
			buttons: [
				{
					label: Messages.UNBOUND_DELETE,
					variant: 'destructive',
					onPress: () => void manager.delete(addon.id),
				},
			],
			cancel: Messages.UNBOUND_CANCEL,
		});

		return;
	}

	const names = dependents.map((dependent) => dependent.data.name).join(', ');

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
					void deleteInOrder(manager, [...dependents, addon]).then(() =>
						showToast({
							title: Messages.UNBOUND_DELETE,
							content: format('UNBOUND_DELETED_WITH_DEPENDENTS', {
								name,
								count: dependents.length,
							}),
							icon: 'TrashIcon',
						}),
					),
			},
			{
				label: Messages.UNBOUND_DELETE_LIBRARY_ONLY,
				variant: 'secondary',
				onPress: () => void manager.delete(addon.id),
			},
		],
		cancel: Messages.UNBOUND_CANCEL,
	});
}

export default confirmDelete;
