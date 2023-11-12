import type { TextInputProps } from 'react-native';

import { Search as DiscordSearch } from '@metro/components';
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
	const styles = useStyles();

	return <DiscordSearch
		{...props}
		style={mergeStyles(styles.search, props.style)}
	/>;
}

export default Search;