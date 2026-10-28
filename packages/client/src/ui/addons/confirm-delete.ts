import type { Addon } from '@unbound-app/types';
import { Alert } from 'react-native';

import { dependentsOf } from '~/lib/addon-dependencies';
import { Messages, format } from '~/api/i18n';
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
		Alert.alert(format('UNBOUND_DELETE_TITLE', { name }), Messages.UNBOUND_DELETE_BODY, [
			{ text: Messages.UNBOUND_CANCEL, style: 'cancel' },
			{
				text: Messages.UNBOUND_DELETE,
				style: 'destructive',
				onPress: () => void manager.delete(addon.id),
			},
		]);

		return;
	}

	const names = dependents.map((dependent) => dependent.data.name).join(', ');

	Alert.alert(
		format('UNBOUND_DELETE_TITLE', { name }),
		format('UNBOUND_DELETE_LIBRARY_BODY', { count: dependents.length, names }),
		[
			{ text: Messages.UNBOUND_CANCEL, style: 'cancel' },
			{
				text: Messages.UNBOUND_DELETE_LIBRARY_ONLY,
				style: 'destructive',
				onPress: () => void manager.delete(addon.id),
			},
			{
				text: format('UNBOUND_DELETE_LIBRARY_AND_DEPENDENTS', { count: dependents.length }),
				style: 'destructive',
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
		],
	);
}

export default confirmDelete;
