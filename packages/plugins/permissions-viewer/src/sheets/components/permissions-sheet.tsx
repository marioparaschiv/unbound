import { Discord } from '@unbound-app/api/metro/components';
import { flux, toasts } from '@unbound-app/api';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { entryPermissions, missingMemberIds, type Entry } from '~/permissions/model';
import { Clipboard, GuildMemberStore, UserStore } from '~/discord/modules';
import { getPermissionBits, getRole, type PermissionsView } from '~/permissions/views';
import { createPermissionText } from '~/permissions/text';
import PermissionRow from '~/sheets/components/permission-row';
import EntryLabel from '~/sheets/components/entry-label';
import { EntryType } from '~/constants';
import type { User } from '~/types';

type PermissionsSheetProps = {
	view: PermissionsView;
};

function copyId(entry: Entry) {
	if (!entry.id) return;

	const label = entry.type === EntryType.Role ? 'Role ID' : 'User ID';

	void Promise.resolve(Clipboard.setString(entry.id)).then(() =>
		toasts.show({ title: 'Permissions Viewer', content: `${label} copied to clipboard.` }),
	);
}

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

function EntryChip({
	entry,
	selected,
	view,
	onSelect,
}: {
	entry: Entry;
	selected: boolean;
	view: PermissionsView;
	onSelect: () => void;
}) {
	const role =
		entry.type === EntryType.Role && entry.id ? getRole(view.guild, entry.id) : undefined;
	const user =
		entry.type === EntryType.Member && entry.id
			? (UserStore.getUser(entry.id) as User | undefined)
			: undefined;

	return (
		<Pressable onPress={onSelect} onLongPress={() => copyId(entry)}>
			<Discord.Card
				variant={selected ? 'primary' : 'secondary'}
				border={selected ? 'strong' : 'subtle'}
				radius={16}
				style={{ paddingHorizontal: 12, paddingVertical: 8 }}
			>
				<EntryLabel entry={entry} role={role} user={user} />
			</Discord.Card>
		</Pressable>
	);
}

function PermissionsSheet({ view }: PermissionsSheetProps) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const bits = useMemo(getPermissionBits, []);
	const text = useMemo(() => createPermissionText(view.guild), [view.guild.id]);
	const selected = view.entries[selectedIndex];
	const permissions = selected ? entryPermissions(selected, bits) : [];

	useRequestedMembers(view);

	return (
		<Discord.ActionSheet startExpanded>
			<ScrollView
				contentContainerStyle={{ gap: 12, paddingBottom: 32, paddingHorizontal: 16 }}
				style={{ maxHeight: '100%' }}
			>
				<Discord.Text variant='heading-lg/semibold'>{`${view.header} Permissions`}</Discord.Text>

				{selected ? (
					<>
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={{ gap: 8 }}
						>
							{view.entries.map((entry, index) => (
								<EntryChip
									key={`${entry.type}-${entry.id ?? 'owner'}`}
									entry={entry}
									selected={index === selectedIndex}
									view={view}
									onSelect={() => setSelectedIndex(index)}
								/>
							))}
						</ScrollView>

						<Discord.TableRowGroup>
							{permissions.map(({ permission, state }) => (
								<PermissionRow
									key={String(permission.bit)}
									title={text.title(permission)}
									description={text.description(permission)}
									state={state}
								/>
							))}
						</Discord.TableRowGroup>

						{!permissions.length ? (
							<Discord.Text color='text-muted'>
								This entry changes no permissions.
							</Discord.Text>
						) : null}
					</>
				) : (
					<View style={{ alignItems: 'center', paddingVertical: 24 }}>
						<Discord.Text variant='text-lg/medium'>
							No permissions to display!
						</Discord.Text>
					</View>
				)}
			</ScrollView>
		</Discord.ActionSheet>
	);
}

export default PermissionsSheet;
