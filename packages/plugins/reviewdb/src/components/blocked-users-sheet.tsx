import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import EntityRow from '@unbound-plugins/shared/entities/entity-row';
import { BottomSheets, Discord, GorhomSheet } from '@unbound-app/api/metro/components';
import { ActivityIndicator } from 'react-native';
import { messages } from '@unbound-app/i18n';
import { useEffect, useState } from 'react';

import useStyles from '~/components/blocked-users-sheet.style';
import { getBlockedUsers, setUserBlocked } from '~/lib/api';
import type { ReviewDBUser } from '~/lib/entities';

function BlockedUsersSheet() {
	const styles = useStyles();
	const { ActionSheet, BottomSheetTitleHeader } = BottomSheets;
	const { BottomSheetScrollView: ScrollView } = GorhomSheet;
	const [users, setUsers] = useState<ReviewDBUser[] | null>(null);
	const [busyId, setBusyId] = useState<string | null>(null);

	useEffect(() => {
		void getBlockedUsers().then(setUsers);
	}, []);

	async function unblock(userId: string) {
		if (busyId) return;

		setBusyId(userId);

		try {
			await setUserBlocked(userId, false);
			setUsers((current) => current?.filter((user) => user.discordID !== userId) ?? null);
		} finally {
			setBusyId(null);
		}
	}

	return (
		<ActionSheet scrollable>
			<BottomSheetTitleHeader title={messages.BLOCKED_USERS} />
			<ScrollView contentContainerStyle={styles.body}>
				{users === null ? <ActivityIndicator style={styles.note} /> : null}

				{users?.length ? (
					<Discord.TableRowGroup hasIcons>
						{users.map((user) => (
							<EntityRow
								key={user.discordID}
								entity={{
									kind: 'user',
									id: user.discordID,
									name: user.username,
									image: user.profilePhoto,
								}}
								id={user.discordID}
								unknownLabel={user.discordID}
								trailing={
									<Discord.Button
										text={messages.UNBLOCK}
										variant='destructive'
										size='sm'
										loading={busyId === user.discordID}
										disabled={Boolean(busyId)}
										onPress={() => void unblock(user.discordID)}
									/>
								}
							/>
						))}
					</Discord.TableRowGroup>
				) : null}

				{users?.length === 0 ? (
					<Discord.Text variant='body-sm/medium' color='text-muted' style={styles.note}>
						{messages.NO_BLOCKED_USERS}
					</Discord.Text>
				) : null}
			</ScrollView>
		</ActionSheet>
	);
}

/**
 * @description Opens the sheet listing users blocked from reviewing the viewer's profile.
 */
export function openBlockedUsersSheet(): void {
	openSheet(`unbound-reviewdb-blocked-${Date.now()}`, BlockedUsersSheet, {});
}

export default BlockedUsersSheet;
