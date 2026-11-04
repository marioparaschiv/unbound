import { Discord } from '@unbound-app/api/metro/components';
import { assets } from '@unbound-app/api';
import { Image, Pressable, View } from 'react-native';

import { openMemberPermissionsSheet } from '~/sheets';
import { ROW_ICON, ROW_LABEL } from '~/constants';
import { GuildMemberStore } from '~/discord/modules';

type RolesCardButtonProps = {
	guildId: string;
	userId: string;
};

function RolesCardButton({ guildId, userId }: RolesCardButtonProps) {
	if (!GuildMemberStore.getMember(guildId, userId)) return null;

	const icon = assets.getIdByName(ROW_ICON);

	return (
		<Pressable
			accessibilityRole='button'
			accessibilityLabel={ROW_LABEL}
			onPress={() => openMemberPermissionsSheet(guildId, userId)}
			style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: 8 })}
		>
			<View
				style={{
					alignItems: 'center',
					flexDirection: 'row',
					gap: 6,
					justifyContent: 'center',
				}}
			>
				{icon != null ? (
					<Image source={icon} style={{ height: 16, tintColor: '#949ba4', width: 16 }} />
				) : null}
				<Discord.Text variant='text-sm/semibold' color='text-muted'>
					{ROW_LABEL}
				</Discord.Text>
			</View>
		</Pressable>
	);
}

export default RolesCardButton;
