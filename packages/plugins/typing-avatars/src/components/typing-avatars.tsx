import type { FluxUser } from '@unbound-app/api/flux';
import type { MetroModuleWithProps } from '@unbound-app/api/metro';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { flux } from '@unbound-app/api';

import { Avatar } from '~/lib/constants';

/** Discord's avatar components, which draw each typing user's avatar. */
export type AvatarsModule = MetroModuleWithProps<'SummarizedIconRow' | 'Avatar' | 'AvatarSizes'>;

type User = { id: string };

type TypingAvatarsProps = {
	Avatars: AvatarsModule;
	users: User[];
	guildId?: string;
};

const UserStore = flux.getStore('User');

function TypingAvatars({ Avatars, users, guildId }: TypingAvatarsProps) {
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
 * @param Avatars Discord's avatar components.
 * @param row The row Discord rendered.
 * @param userIds The IDs of the users typing.
 * @param guildId The channel's guild, so avatars use guild profiles.
 * @returns The row with avatars, or the row unchanged when none of the users are cached.
 */
export function withTypingAvatars(
	Avatars: AvatarsModule,
	row: ReactNode,
	userIds: string[],
	guildId?: string,
): ReactNode {
	const users = userIds
		.map((id) => UserStore.getUser(id))
		.filter((user): user is FluxUser => Boolean(user));

	if (!users.length) return row;

	return (
		<View style={{ alignItems: 'center', flexDirection: 'row', paddingLeft: Avatar.gutter }}>
			<TypingAvatars Avatars={Avatars} users={users} guildId={guildId} />
			<View style={{ flex: 1, marginLeft: -(Avatar.gutter + Avatar.lift) }}>{row}</View>
		</View>
	);
}
