import { Search as DiscordSearch, Redesign } from '@metro/components';
import type { TextInputProps } from 'react-native';
import { StyleSheet, ReactNative as RN, Theme } from '@metro/common';
import { mergeStyles } from '@utilities';
import { TabsUIState } from '@ui/components/form';
import type { Dispatch, SetStateAction } from 'react';
import { getIDByName } from '@api/assets';
import { Strings } from '@api/i18n';

const useStyles = StyleSheet.createStyles({
	search: {
		margin: 0,
		marginTop: 5,
		padding: 10,
		borderBottomWidth: 0,
		background: 'none',
		backgroundColor: 'none',
	},

	icon: {
		tintColor: Theme.colors.INTERACTIVE_NORMAL,
		width: 16,
		height: 16
	}
});

interface SearchProps extends TextInputProps {
	onClear: Fn;
	isRound?: boolean;
	isClearable?: boolean;
	leadingIcon?: any;
}

interface GeneralSearchProps {
	type: string;
	search: string;
	setSearch: Dispatch<SetStateAction<string>>
}

function Search(props: SearchProps) {
	const tabsEnabled = TabsUIState.useInMainTabsExperiment();
	const styles = useStyles();

	return tabsEnabled ? <Redesign.TextInput size='md' {...props} /> : <DiscordSearch
		{...props}
		style={mergeStyles(styles.search, props.style)}
	/>;
}

export function GeneralSearch({ type, search, setSearch }: GeneralSearchProps) {
	const styles = useStyles();

	return <Search
		placeholder={Strings.UNBOUND_SEARCH.format({ type })}
		value={search}
		onChange={(e: any) => setSearch(e)}
		onClear={() => setSearch('')}
		isRound
		isClearable
		leadingIcon={() => {
			return <RN.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
				<RN.Image
					source={getIDByName('Search')}
					style={styles.icon}
				/>
			</RN.View>;
		}}
	/>;
}

export default Search;