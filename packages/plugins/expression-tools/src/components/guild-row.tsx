import { Image, Pressable, Text, View } from 'react-native';

import { getGuildIconUrl, type Guild } from '~/guilds';

import styles from './guild-row.style';

type GuildIconProps = {
	guild: Guild;
};

type GuildRowProps = {
	guild: Guild;
	busy: boolean;
	disabled: boolean;
	onPress: () => void;
};

function GuildIcon({ guild }: GuildIconProps) {
	if (guild.icon) {
		return <Image source={{ uri: getGuildIconUrl(guild) }} style={styles.icon} />;
	}

	return (
		<View style={[styles.icon, styles.acronym]}>
			<Text style={styles.acronymText}>{guild.name.slice(0, 1).toUpperCase()}</Text>
		</View>
	);
}

function GuildRow({ guild, busy, disabled, onPress }: GuildRowProps) {
	return (
		<Pressable
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }) => [
				styles.row,
				pressed && styles.pressed,
				disabled && styles.disabled,
			]}
		>
			<GuildIcon guild={guild} />
			<Text numberOfLines={1} style={styles.name}>
				{guild.name}
			</Text>
			<Text style={styles.chevron}>{busy ? '…' : '›'}</Text>
		</Pressable>
	);
}

export default GuildRow;
