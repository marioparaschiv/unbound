import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { assets } from '@unbound-app/api';
import { Image, Pressable, View } from 'react-native';

import { openMemberPermissionsSheet } from '~/viewer/sheets';
import { ROW_ICON } from '~/constants';
import { GuildMemberStore } from '~/viewer/modules';

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
			accessibilityLabel={messages.VIEW_PERMISSIONS}
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
					{messages.VIEW_PERMISSIONS}
				</Discord.Text>
			</View>
		</Pressable>
	);
}

export default RolesCardButton;
