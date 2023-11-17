import { Search as DiscordSearch, Redesign } from '@metro/components';
import { TabsUIState } from '@ui/components/form';
import type { TextInputProps, ViewProps } from 'react-native';
import { StyleSheet } from '@metro/common';
import { mergeStyles } from '@utilities';

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

function Search(props: SearchProps) {
	const isTabsV2 = TabsUIState.useInMainTabsExperiment();
	const styles = useStyles();

	return isTabsV2 ?
		<Redesign.TextInput size='md' {...props} /> :
		<DiscordSearch {...props} style={mergeStyles(styles.search, props.style)} />;
}

export default Search;