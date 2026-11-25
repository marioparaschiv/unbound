import { messages } from '@unbound-app/i18n';
import { toasts } from '@unbound-app/api';
import { Pressable } from 'react-native';

import type { Entry } from '~/lib/model';
import { Clipboard, UserStore } from '~/lib/modules';
import { getRole, type PermissionsView } from '~/lib/views';
import EntryLabel from '~/components/entry-label';
import { EntryType } from '~/lib/constants';
import type { User } from '~/lib/types';

import useStyles from '~/components/entry-chip.style';

type EntryChipProps = {
	entry: Entry;
	selected: boolean;
	view: PermissionsView;
	onSelect: () => void;
};

function copyId(entry: Entry) {
	if (!entry.id) return;

	const copied =
		entry.type === EntryType.Role ? messages.ROLE_ID_COPIED : messages.USER_ID_COPIED;

	void Promise.resolve(Clipboard.setString(entry.id)).then(() =>
		toasts.show({ title: messages.PERMISSIONS_VIEWER, content: copied }),
	);
}

function EntryChip({ entry, selected, view, onSelect }: EntryChipProps) {
	const styles = useStyles();
	const role =
		entry.type === EntryType.Role && entry.id ? getRole(view.guild, entry.id) : undefined;
	const user =
		entry.type === EntryType.Member && entry.id
			? (UserStore.getUser(entry.id) as User | undefined)
			: undefined;

	return (
		<Pressable
			accessibilityRole='button'
			accessibilityState={{ selected }}
			style={[styles.chip, selected && styles.selected]}
			onPress={onSelect}
			onLongPress={() => copyId(entry)}
		>
			<EntryLabel entry={entry} role={role} user={user} />
		</Pressable>
	);
}

export default EntryChip;
