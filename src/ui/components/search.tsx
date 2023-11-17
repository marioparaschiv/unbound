import { Search as DiscordSearch, Redesign } from '@metro/components';
import type { TextInputProps } from 'react-native';
import { StyleSheet } from '@metro/common';
import { mergeStyles } from '@utilities';
import { TabsUIState } from '@ui/components/form';
import { findByName } from '@metro';

const useStyles = StyleSheet.createStyles({
	search: {
		margin: 0,
		marginTop: 5,
		padding: 10,
		borderBottomWidth: 0,
		background: 'none',
		backgroundColor: 'none',
	}
});

interface SearchProps extends TextInputProps {
	onClear: Fn;
}

const Test = findByName('Input');

function Search(props: SearchProps) {
	const tabsEnabled = TabsUIState.useInMainTabsExperiment();
	const styles = useStyles();

	return tabsEnabled ? <Redesign.TextInput size='md' {...props} /> : <DiscordSearch
		{...props}
		style={mergeStyles(styles.search, props.style)}
	/>;
}

export default Search;