import type { SheetProps } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { Discord } from '@unbound-app/api/metro/components';
import { storage } from '@unbound-app/api';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { grantedPermissions, memberRoles, type GrantedPermission } from '~/permissions/model';
import { getPermissionBits, getSortedRoles } from '~/permissions/views';
import { normalizeSortOrder, toggleSortOrder } from '~/permissions/sort-order';
import { OWNER_TITLE, SETTINGS, SORT_ORDER_LABELS } from '~/constants';
import { createPermissionText } from '~/permissions/text';
import PermissionRow from '~/sheets/components/permission-row';
import { GuildMemberStore } from '~/discord/modules';
import RoleDot from '~/sheets/components/role-dot';
import type { Guild } from '~/types';

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
	const settings = storage.useBucket(addon.id);
	const order = normalizeSortOrder(settings.get('sortOrder', SETTINGS.sortOrder));
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
			ownerTitle: OWNER_TITLE,
			title: text.title,
		});
	}, [member, order, bits, text]);

	function openRoleDetails() {
		onClose();
		onRoleDetails();
	}

	return (
		<Discord.ActionSheet startExpanded>
			<ScrollView
				contentContainerStyle={{ gap: 12, paddingBottom: 32, paddingHorizontal: 16 }}
				style={{ maxHeight: '100%' }}
			>
				<Discord.Text variant='heading-lg/semibold'>Permissions</Discord.Text>

				<View style={{ flexDirection: 'row', gap: 8 }}>
					<View style={{ flex: 1 }}>
						<Discord.Button
							size='sm'
							variant='secondary'
							text={`Sorting by ${SORT_ORDER_LABELS[order]}`}
							onPress={() => settings.set('sortOrder', toggleSortOrder(order))}
						/>
					</View>
					<View style={{ flex: 1 }}>
						<Discord.Button
							size='sm'
							variant='secondary'
							text='Role Details'
							onPress={openRoleDetails}
						/>
					</View>
				</View>

				{granted.length ? (
					<Discord.TableRowGroup>
						{granted.map((entry) => (
							<PermissionRow
								key={entry.permission}
								title={entry.permission}
								trailing={<GrantedBy granted={entry} />}
							/>
						))}
					</Discord.TableRowGroup>
				) : (
					<Discord.Text color='text-muted'>
						No roles grant this member any permissions.
					</Discord.Text>
				)}
			</ScrollView>
		</Discord.ActionSheet>
	);
}

export default MemberPermissionsSheet;
