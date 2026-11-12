import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { assets } from '@unbound-app/api';
import { Image, View } from 'react-native';

import { EntryType } from '~/lib/constants';
import { avatarUrl, roleIcon } from '~/lib/images';
import RoleDot from '~/components/role-dot';
import type { Entry } from '~/lib/model';
import type { GuildRole, User } from '~/lib/types';

type EntryLabelProps = {
	entry: Entry;
	role: GuildRole | undefined;
	user: User | undefined;
};

function userName(user: User | undefined): string {
	if (!user) return messages.UNKNOWN_USER;

	return user.discriminator && user.discriminator !== '0'
		? `${user.username}#${user.discriminator}`
		: user.username;
}

function RoleIconView({ role }: { role: GuildRole }) {
	const icon = roleIcon(role, 40);

	if (!icon) return null;

	if (icon.kind === 'emoji')
		return <Discord.Text variant='text-sm/medium'>{icon.emoji}</Discord.Text>;

	return <Image source={{ uri: icon.uri }} style={{ height: 18, width: 18 }} />;
}

function OwnerLabel() {
	const crown = assets.getIdByName('CrownIcon');

	return (
		<View style={{ alignItems: 'center', flexDirection: 'row', gap: 4 }}>
			<Discord.Text variant='text-sm/medium'>{messages.OWNER_LABEL}</Discord.Text>
			{crown != null ? (
				<Image source={crown} style={{ height: 16, tintColor: '#f0b232', width: 16 }} />
			) : null}
		</View>
	);
}

function EntryLabel({ entry, role, user }: EntryLabelProps) {
	if (entry.type === EntryType.Owner) {
		return (
			<View style={{ alignItems: 'center', flexDirection: 'row', gap: 6 }}>
				<RoleDot />
				<OwnerLabel />
			</View>
		);
	}

	if (entry.type === EntryType.Member) {
		return (
			<View style={{ alignItems: 'center', flexDirection: 'row', gap: 6 }}>
				{user ? (
					<Image
						source={{
							uri: user.getAvatarURL?.(undefined, 40, false) ?? avatarUrl(user, 40),
						}}
						style={{ borderRadius: 9, height: 18, width: 18 }}
					/>
				) : null}
				<Discord.Text variant='text-sm/medium'>{userName(user)}</Discord.Text>
			</View>
		);
	}

	return (
		<View style={{ alignItems: 'center', flexDirection: 'row', gap: 6 }}>
			<RoleDot color={role?.colorString} />
			{role ? <RoleIconView role={role} /> : null}
			<Discord.Text variant='text-sm/medium'>
				{role?.name ?? messages.UNKNOWN_ROLE}
			</Discord.Text>
		</View>
	);
}

export default EntryLabel;
