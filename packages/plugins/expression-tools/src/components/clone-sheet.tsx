import { BottomSheets, Discord, GorhomSheet } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';
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

	const { ActionSheet, BottomSheetTitleHeader } = BottomSheets;
	const { BottomSheetScrollView: ScrollView } = GorhomSheet;

	return (
		<ActionSheet scrollable>
			<BottomSheetTitleHeader title={messages.CLONE_TO_SERVER} subtitle={expression.name} />
			<ScrollView
				contentContainerStyle={styles.container}
				keyboardShouldPersistTaps='handled'
			>
				<Image source={{ uri: getAssetUrl(expression) }} style={styles.preview} />
				<ui.Section>
					<ui.InputRow
						label={messages.NAME}
						placeholder={messages.EXPRESSION_NAME_PLACEHOLDER}
						value={name}
						onChange={setName}
					/>
				</ui.Section>
				<Discord.SearchBar
					value={query}
					onChange={setQuery}
					placeholder={messages.SEARCH_SERVERS}
				/>
				{visibleGuilds.length ? (
					<ui.Section title={messages.YOUR_SERVERS} hasIcons>
						{visibleGuilds.map((guild) => (
							<GuildRow
								key={guild.id}
								guild={guild}
								disabled={disabled}
								onPress={() => clone(guild)}
							/>
						))}
					</ui.Section>
				) : (
					<View style={styles.empty}>
						<Discord.Text variant='body-sm/normal' color='text-muted'>
							{guilds.length ? messages.NO_SERVERS_MATCH : messages.NO_OWNED_SERVERS}
						</Discord.Text>
					</View>
				)}
			</ScrollView>
		</ActionSheet>
	);
}

export default CloneSheet;
