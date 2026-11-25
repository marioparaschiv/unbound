import type { SheetProps } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { getActionSheetRow } from '@unbound-plugins/shared/action-sheets/action-sheet-row';
import { BottomSheets, Discord, GorhomSheet } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { settings, useSetting } from '@unbound-app/settings';
import { useMemo } from 'react';
import { View } from 'react-native';

import { grantedPermissions, memberRoles, type GrantedPermission } from '~/lib/model';
import { getPermissionBits, getSortedRoles } from '~/lib/views';
import { toggleSortOrder } from '~/lib/sort-order';
import { createPermissionText } from '~/lib/text';
import PermissionRow from '~/components/permission-row';
import { GuildMemberStore } from '~/lib/modules';
import RoleDot from '~/components/role-dot';
import type { Guild } from '~/lib/types';

import useStyles from '~/components/permissions-sheet.style';

type MemberPermissionsSheetProps = SheetProps & {
	guild: Guild;
	userId: string;
	onRoleDetails: () => void;
};

function GrantedBy({ granted }: { granted: GrantedPermission }) {
	return (
		<View style={{ alignItems: 'center', flexDirection: 'row', gap: 6, maxWidth: 140 }}>
			<RoleDot color={granted.roleColor} size={10} />
			<Discord.Text variant='text-xs/medium' color='text-muted' lineClamp={1}>
				{granted.roleName}
			</Discord.Text>
		</View>
	);
}

function MemberPermissionsSheet({
	guild,
	userId,
	onClose,
	onRoleDetails,
}: MemberPermissionsSheetProps) {
	const styles = useStyles();
	const order = useSetting('sortOrder');
	const bits = useMemo(getPermissionBits, []);
	const text = useMemo(() => createPermissionText(guild), [guild.id]);
	const member = GuildMemberStore.getMember(guild.id, userId);

	const granted = useMemo(() => {
		if (!member) return [];

		return grantedPermissions({
			roles: memberRoles(getSortedRoles(guild), guild.id, member),
			bits,
			order,
			isOwner: guild.ownerId === userId,
			ownerTitle: messages.OWNER_TITLE,
			title: text.title,
		});
	}, [member, order, bits, text]);

	const ActionSheetRow = getActionSheetRow();
	const { ActionSheet, BottomSheetTitleHeader } = BottomSheets;
	const { BottomSheetScrollView: ScrollView } = GorhomSheet;

	function openRoleDetails() {
		onClose();
		onRoleDetails();
	}

	return (
		<ActionSheet scrollable startExpanded>
			<BottomSheetTitleHeader title={messages.PERMISSIONS} />
			<ScrollView contentContainerStyle={styles.body}>
				<View style={styles.buttons}>
					<View style={styles.button}>
						<Discord.Button
							size='sm'
							variant='secondary'
							text={
								order === 'lowest'
									? messages.SORTING_BY_LOWEST
									: messages.SORTING_BY_HIGHEST
							}
							onPress={() => {
								settings.sortOrder = toggleSortOrder(order);
							}}
						/>
					</View>
					<View style={styles.button}>
						<Discord.Button
							size='sm'
							variant='secondary'
							text={messages.ROLE_DETAILS}
							onPress={openRoleDetails}
						/>
					</View>
				</View>

				{granted.length ? (
					<ActionSheetRow.Group>
						{granted.map((entry) => (
							<PermissionRow
								key={entry.permission}
								title={entry.permission}
								trailing={<GrantedBy granted={entry} />}
							/>
						))}
					</ActionSheetRow.Group>
				) : (
					<View style={styles.section}>
						<Discord.Text color='text-muted'>{messages.NO_ROLES_GRANT}</Discord.Text>
					</View>
				)}
			</ScrollView>
		</ActionSheet>
	);
}

export default MemberPermissionsSheet;
