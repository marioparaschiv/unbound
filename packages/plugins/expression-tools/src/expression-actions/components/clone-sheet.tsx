import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { Image, Text, View } from 'react-native';
import { useMemo, useState } from 'react';

import { getAssetUrl, type Expression } from '~/expression-actions/expression';
import { getOwnedGuilds, type Guild } from '~/expression-actions/guilds';
import { cloneExpression } from '~/expression-actions/clone';
import { notifyError } from '~/expression-actions/notify';

import styles from '~/expression-actions/components/clone-sheet.style';
import GuildRow from '~/expression-actions/components/guild-row';

type CloneSheetProps = {
	expression: Expression;
	onClose: () => void;
};

function CloneSheet({ expression, onClose }: CloneSheetProps) {
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
			<View style={styles.container}>
				<View style={styles.header}>
					<Image source={{ uri: getAssetUrl(expression) }} style={styles.preview} />
					<View style={styles.headerText}>
						<Text style={styles.title}>{messages.CLONE_TO_SERVER}</Text>
						<Text numberOfLines={1} style={styles.subtitle}>
							{expression.name}
						</Text>
					</View>
				</View>
				<Text style={styles.label}>{messages.NAME}</Text>
				<Discord.TextField
					value={name}
					onChange={setName}
					placeholder={messages.EXPRESSION_NAME_PLACEHOLDER}
				/>
				<Text style={[styles.label, styles.spacedLabel]}>{messages.YOUR_SERVERS}</Text>
				<Discord.TextField
					value={query}
					onChange={setQuery}
					placeholder={messages.SEARCH_SERVERS}
					isClearable
				/>
				<View style={styles.guilds}>
					{visibleGuilds.map((guild) => (
						<GuildRow
							key={guild.id}
							guild={guild}
							busy={busy}
							disabled={disabled}
							onPress={() => clone(guild)}
						/>
					))}
					{guilds.length === 0 ? (
						<Text style={styles.empty}>{messages.NO_OWNED_SERVERS}</Text>
					) : null}
					{guilds.length > 0 && visibleGuilds.length === 0 ? (
						<Text style={styles.empty}>{messages.NO_SERVERS_MATCH}</Text>
					) : null}
				</View>
			</View>
		</Discord.ActionSheet>
	);
}

export default CloneSheet;
