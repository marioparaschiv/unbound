import { BottomSheets, Discord, GorhomSheet } from '@unbound-app/api/metro/components';
import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { flux } from '@unbound-app/api';
import { format } from '@unbound-app/i18n';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { entryPermissions, missingMemberIds } from '~/lib/model';
import { GuildMemberStore, UserStore } from '~/lib/modules';
import { getPermissionBits, type PermissionsView } from '~/lib/views';
import { createPermissionText } from '~/lib/text';
import PermissionRow from '~/components/permission-row';
import EntryChips from '~/components/entry-chips';
import { EntryType } from '~/lib/constants';

import useStyles from '~/components/permissions-sheet.style';

type PermissionsSheetProps = {
	view: PermissionsView;
};

function useRequestedMembers(view: PermissionsView): void {
	const guildId = view.guild.id;

	useEffect(() => {
		const userIds = missingMemberIds(view.entries, (userId) =>
			GuildMemberStore.isMember(guildId, userId),
		);

		if (!userIds.length) return;

		void flux.dispatch({ type: 'GUILD_MEMBERS_REQUEST', guildIds: [guildId], userIds });
	}, [view]);

	flux.useStore([GuildMemberStore, UserStore], () =>
		view.entries
			.filter((entry) => entry.type === EntryType.Member && entry.id)
			.map((entry) => (UserStore.getUser(entry.id!) ? '1' : '0'))
			.join(''),
	);
}

function PermissionsSheet({ view }: PermissionsSheetProps) {
	const styles = useStyles();
	const [selectedIndex, setSelectedIndex] = useState(0);
	const bits = useMemo(getPermissionBits, []);
	const text = useMemo(() => createPermissionText(view.guild), [view.guild.id]);
	const selected = view.entries[selectedIndex];
	const permissions = selected ? entryPermissions(selected, bits) : [];
	const ActionSheetRow = getActionSheetRow();
	const { ActionSheet, BottomSheetTitleHeader } = BottomSheets;
	const { BottomSheetScrollView: ScrollView } = GorhomSheet;

	useRequestedMembers(view);

	return (
		<ActionSheet scrollable startExpanded>
			<BottomSheetTitleHeader title={format('PERMISSIONS_HEADER', { name: view.header })} />
			<ScrollView contentContainerStyle={styles.body}>
				{selected ? (
					<>
						<EntryChips
							view={view}
							selectedIndex={selectedIndex}
							onSelect={setSelectedIndex}
						/>

						{permissions.length ? (
							<ActionSheetRow.Group>
								{permissions.map(({ permission, state }) => (
									<PermissionRow
										key={String(permission.bit)}
										title={text.title(permission)}
										description={text.description(permission)}
										state={state}
									/>
								))}
							</ActionSheetRow.Group>
						) : (
							<View style={styles.section}>
								<Discord.Text variant='body-sm/medium' color='text-muted'>
									This entry changes no permissions.
								</Discord.Text>
							</View>
						)}
					</>
				) : (
					<View style={styles.empty}>
						<Discord.Text variant='body-lg/medium'>
							No permissions to display!
						</Discord.Text>
					</View>
				)}
			</ScrollView>
		</ActionSheet>
	);
}

export default PermissionsSheet;
