import { useEffect, useState } from 'react';

import { metro } from '@unbound-app/api';

import { fetchBlocks, unblockUser } from '@reviewdb/api';
import type { ReviewDBUser } from '@reviewdb/entities';
import { showToast } from '@reviewdb/utils';

function getDesignModule(): { ActionSheet?: any; Text?: any; Card?: any } | null {
	const discord = (metro as { components?: { Discord?: unknown } } | undefined)?.components
		?.Discord as { ActionSheet?: any; Text?: any; Card?: any } | undefined;
	if (discord?.ActionSheet && discord?.Text) return discord;

	if (typeof metro?.findByProps === 'function') {
		const found = metro.findByProps('ActionSheet', 'Text') as {
			ActionSheet?: any;
			Text?: any;
			Card?: any;
		} | null;
		if (found?.ActionSheet && found?.Text) return found;
	}

	return null;
}

function BlockedUsersSheet() {
	const ReactNative = metro.common.ReactNative;
	const Discord = getDesignModule();
	const [users, setUsers] = useState<ReviewDBUser[] | null>(null);
	const [busyId, setBusyId] = useState<string | null>(null);

	useEffect(() => {
		void fetchBlocks()
			.then(setUsers)
			.catch(() => setUsers([]));
	}, []);

	async function handleUnblock(userId: string) {
		if (busyId) return;
		setBusyId(userId);
		try {
			await unblockUser(userId);
			setUsers((current) => current?.filter((user) => user.discordID !== userId) ?? current);
		} finally {
			setBusyId(null);
		}
	}

	if (!Discord?.ActionSheet) {
		return (
			<ReactNative.View style={{ padding: 16 }}>
				<ReactNative.Text>
					Blocked users are unavailable on this client build.
				</ReactNative.Text>
			</ReactNative.View>
		);
	}

	return (
		<Discord.ActionSheet>
			<Discord.Text
				variant='heading-lg/semibold'
				style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}
			>
				Blocked Users
			</Discord.Text>

			<ReactNative.View>
				{users == null && (
					<ReactNative.View style={{ padding: 12, alignItems: 'center' }}>
						<ReactNative.ActivityIndicator />
					</ReactNative.View>
				)}

				{users?.length === 0 && (
					<Discord.Text style={{ padding: 12 }} color='text-muted'>
						No blocked users.
					</Discord.Text>
				)}

				{users?.map((user) => {
					const Row = Discord.Card ?? ReactNative.View;
					const rowProps = Discord.Card
						? { variant: 'secondary', border: 'subtle', radius: 8 }
						: {};

					return (
						<Row
							key={user.discordID}
							{...rowProps}
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
							<ReactNative.Image
								source={{ uri: user.profilePhoto }}
								style={{ width: 28, height: 28, borderRadius: 14 }}
							/>
							<Discord.Text style={{ flex: 1 }}>{user.username}</Discord.Text>
							<ReactNative.Pressable
								disabled={busyId === user.discordID}
								onPress={() => handleUnblock(user.discordID)}
							>
								<Discord.Text variant='text-sm/semibold' color='text-danger'>
									Unblock
								</Discord.Text>
							</ReactNative.Pressable>
						</Row>
					);
				})}
			</ReactNative.View>
		</Discord.ActionSheet>
	);
}

export function openBlockedUsersSheet(): void {
	if (typeof metro?.findByProps !== 'function') return;

	const sheets = metro.findByProps('openLazy', 'hideActionSheet') as {
		openLazy?: (...args: unknown[]) => unknown;
		hideActionSheet?: (key: string) => void;
	} | null;
	if (!sheets?.openLazy) {
		showToast('Blocked users are unavailable on this client build.');
		return;
	}

	const key = `unbound-reviewdb-blocked-${Date.now()}`;

	sheets.openLazy(Promise.resolve({ default: BlockedUsersSheet }), key, {
		onClose: () => sheets.hideActionSheet?.(key),
	});
}

export default BlockedUsersSheet;
