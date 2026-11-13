import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { assets } from '@unbound-app/api';
import { Image, Pressable, View } from 'react-native';

import { openMemberPermissionsSheet } from '~/lib/sheets';
import { ROW_ICON } from '~/lib/constants';
import { GuildMemberStore } from '~/lib/modules';

import useStyles from '~/components/permission-icons.style';

type RolesCardButtonProps = {
	guildId: string;
	userId: string;
};

function RolesCardButton({ guildId, userId }: RolesCardButtonProps) {
	const styles = useStyles();
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
				{icon != null ? <Image source={icon} style={[styles.small, styles.muted]} /> : null}
				<Discord.Text variant='text-sm/semibold' color='text-muted'>
					{messages.VIEW_PERMISSIONS}
				</Discord.Text>
			</View>
		</Pressable>
	);
}

export default RolesCardButton;
