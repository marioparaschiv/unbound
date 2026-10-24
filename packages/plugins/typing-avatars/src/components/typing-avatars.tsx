import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Avatars, UserStore } from '~/modules';
import { Avatar } from '~/constants';

type User = { id: string };

type TypingAvatarsProps = {
	users: User[];
	guildId?: string;
};

function TypingAvatars({ users, guildId }: TypingAvatarsProps) {
	const visible = users.slice(0, Avatar.max);

	return (
		<View
			style={{
				flexDirection: 'row',
				height: Avatar.size,
				transform: [{ translateY: -Avatar.lift }],
				width: Avatar.size + (visible.length - 1) * (Avatar.size + Avatar.overlap),
			}}
		>
			{visible.map((user, index) => (
				<View
					key={user.id}
					style={{
						marginLeft: index ? Avatar.overlap : 0,
						zIndex: visible.length - index,
					}}
				>
					<Avatars.Avatar
						user={user}
						size={Avatars.AvatarSizes.SIZE_16}
						guildId={guildId}
					/>
				</View>
			))}
		</View>
	);
}

/**
 * @description Puts the avatars of the typing users in front of a typing indicator row.
 * @param row The row Discord rendered.
 * @param userIds The IDs of the users typing.
 * @param guildId The channel's guild, so avatars use guild profiles.
 * @returns The row with avatars, or the row unchanged when none of the users are cached.
 */
export function withTypingAvatars(row: ReactNode, userIds: string[], guildId?: string): ReactNode {
	const users: User[] = userIds.map((id) => UserStore.getUser(id)).filter(Boolean);

	if (!users.length) return row;

	return (
		<View style={{ alignItems: 'center', flexDirection: 'row', paddingLeft: Avatar.gutter }}>
			<TypingAvatars users={users} guildId={guildId} />
			<View style={{ flex: 1, marginLeft: -(Avatar.gutter + Avatar.lift) }}>{row}</View>
		</View>
	);
}
