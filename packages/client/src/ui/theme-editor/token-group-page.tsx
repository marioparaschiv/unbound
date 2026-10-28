import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Discord, FlashList } from '~/api/metro/components';
import type { TokenWrite } from '~/lib/theme-draft';
import { Messages, format } from '~/api/i18n';
import { Icons } from '~/api/assets';

import useEditorScreen from './use-editor-screen';
import useStyles from './token-group-page.style';
import ColorRow from './color-row';

type TokenGroupPageProps = {
	tokens: readonly string[];
};

type TokenRowInfo = {
	item: string;
	index: number;
};

/**
 * @description Every token of one advanced group as colour rows, filtered by a search field.
 */
function TokenGroupPage({ tokens }: TokenGroupPageProps) {
	const styles = useStyles();
	const [search, setSearch] = useState('');

	useEditorScreen();

	// One stable write list per token, so the memoised rows skip re-renders on each keystroke.
	const writes = useMemo(
		() => new Map(tokens.map((token): [string, readonly [TokenWrite]] => [token, [{ token }]])),
		[tokens],
	);

	const filtered = useMemo(() => {
		const query = search.trim().toUpperCase().replaceAll(' ', '_');

		return query ? tokens.filter((token) => token.includes(query)) : tokens;
	}, [tokens, search]);

	const total = filtered.length;

	return (
		<View style={styles.container}>
			<View style={styles.search}>
				<Discord.TextField
					size='md'
					value={search}
					onChange={setSearch}
					isClearable
					isRound
					placeholder={format('UNBOUND_SEARCH', { type: Messages.UNBOUND_THEME_COLORS })}
					leadingIcon={() => <Discord.TableRowIcon source={Icons.MagnifyingGlassIcon} />}
				/>
			</View>
			<FlashList.FlashList
				data={filtered}
				keyExtractor={(token: string) => token}
				estimatedItemSize={64}
				renderItem={({ item, index }: TokenRowInfo) => (
					<ColorRow
						label={item}
						tokens={writes.get(item) ?? [{ token: item }]}
						start={index === 0}
						end={index === total - 1}
					/>
				)}
			/>
		</View>
	);
}

export default TokenGroupPage;
