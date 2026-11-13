import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { Image, View } from 'react-native';
import { useMemo, useState } from 'react';

import { getAssetUrl, type Expression } from '~/lib/expression';
import { getOwnedGuilds, type Guild } from '~/lib/guilds';
import { cloneExpression } from '~/lib/clone';
import { notifyError } from '~/lib/notify';

import useStyles from '~/components/clone-sheet.style';
import GuildRow from '~/components/guild-row';

type CloneSheetProps = {
	expression: Expression;
	onClose: () => void;
};

function CloneSheet({ expression, onClose }: CloneSheetProps) {
	const styles = useStyles();
	const [name, setName] = useState(expression.name);
	const [query, setQuery] = useState('');
	const [busy, setBusy] = useState(false);
	const guilds = useMemo(() => getOwnedGuilds(), []);
	const visibleGuilds = useMemo(() => {
		const search = query.trim().toLowerCase();

		return guilds.filter((guild) => guild.name.toLowerCase().includes(search));
	}, [guilds, query]);

	const trimmedName = name.trim();
	const disabled = busy || !trimmedName;

	function clone(guild: Guild) {
		if (disabled) return;

		setBusy(true);
		onClose();
		void cloneExpression(expression, guild, trimmedName)
			.catch(notifyError)
			.finally(() => setBusy(false));
	}

	return (
		<Discord.ActionSheet>
			<Discord.BottomSheetTitleHeader
				title={messages.CLONE_TO_SERVER}
				subtitle={expression.name}
			/>
			<View style={styles.container}>
				<Image source={{ uri: getAssetUrl(expression) }} style={styles.preview} />
				<Discord.TextField
					label={messages.NAME}
					value={name}
					onChange={setName}
					placeholder={messages.EXPRESSION_NAME_PLACEHOLDER}
				/>
				<Discord.TextField
					label={messages.YOUR_SERVERS}
					value={query}
					onChange={setQuery}
					placeholder={messages.SEARCH_SERVERS}
					isClearable
				/>
				{visibleGuilds.length ? (
					<View>
						{visibleGuilds.map((guild, index) => (
							<GuildRow
								key={guild.id}
								guild={guild}
								disabled={disabled}
								start={index === 0}
								end={index === visibleGuilds.length - 1}
								onPress={() => clone(guild)}
							/>
						))}
					</View>
				) : (
					<View style={styles.empty}>
						<Discord.Text variant='text-sm/normal' color='text-muted'>
							{guilds.length ? messages.NO_SERVERS_MATCH : messages.NO_OWNED_SERVERS}
						</Discord.Text>
					</View>
				)}
			</View>
		</Discord.ActionSheet>
	);
}

export default CloneSheet;
