import { Discord } from '@unbound-app/api/metro/components';
import { Image, View } from 'react-native';

import { getGuildIconUrl, type Guild } from '~/lib/guilds';
import useStyles from '~/components/guild-row.style';

type GuildIconProps = {
	guild: Guild;
};

type GuildRowProps = {
	guild: Guild;
	disabled: boolean;
	start: boolean;
	end: boolean;
	onPress: () => void;
};

function GuildIcon({ guild }: GuildIconProps) {
	const styles = useStyles();

	if (guild.icon) {
		return <Image source={{ uri: getGuildIconUrl(guild) }} style={styles.icon} />;
	}

	return (
		<View style={styles.icon}>
			<Discord.Text variant='text-sm/semibold' color='text-default'>
				{guild.name.slice(0, 1).toUpperCase()}
			</Discord.Text>
		</View>
	);
}

function GuildRow({ guild, disabled, start, end, onPress }: GuildRowProps) {
	return (
		<Discord.TableRow
			label={guild.name}
			icon={<GuildIcon guild={guild} />}
			arrow
			disabled={disabled}
			start={start}
			end={end}
			onPress={onPress}
		/>
	);
}

export default GuildRow;
