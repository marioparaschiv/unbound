import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { Discord } from '@unbound-app/api/metro/components';
import { useEffect, useState } from 'react';

import { getBlockedUsers, setUserBlocked } from '~/api';
import type { ReviewDBUser } from '~/entities';

function BlockedUsersSheet() {
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
		<Discord.ActionSheet>
			<Discord.Text
				variant='heading-lg/semibold'
				style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}
			>
				Blocked Users
			</Discord.Text>

			<View>
				{users === null ? (
					<View style={{ padding: 12, alignItems: 'center' }}>
						<ActivityIndicator />
					</View>
				) : null}

				{users?.length === 0 ? (
					<Discord.Text style={{ padding: 12 }} color='text-muted'>
						No blocked users.
					</Discord.Text>
				) : null}

				{users?.map((user) => (
					<Discord.Card
						key={user.discordID}
						variant='secondary'
						border='subtle'
						radius={8}
						style={{
							flexDirection: 'row',
							alignItems: 'center',
							gap: 10,
							paddingVertical: 8,
							paddingHorizontal: 12,
							marginBottom: 8,
							marginHorizontal: 12,
						}}
					>
						<Image
							source={{ uri: user.profilePhoto }}
							style={{ width: 28, height: 28, borderRadius: 14 }}
						/>
						<Discord.Text style={{ flex: 1 }}>{user.username}</Discord.Text>
						<Pressable
							disabled={busyId === user.discordID}
							onPress={() => void unblock(user.discordID)}
						>
							<Discord.Text variant='text-sm/semibold' color='text-danger'>
								Unblock
							</Discord.Text>
						</Pressable>
					</Discord.Card>
				))}
			</View>
		</Discord.ActionSheet>
	);
}

/**
 * @description Opens the sheet listing users blocked from reviewing the viewer's profile.
 */
export function openBlockedUsersSheet(): void {
	openSheet(`unbound-reviewdb-blocked-${Date.now()}`, BlockedUsersSheet, {});
}

export default BlockedUsersSheet;
