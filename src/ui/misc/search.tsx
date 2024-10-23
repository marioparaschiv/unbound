import { View, type TextInputProps } from 'react-native';
import type { Dispatch, SetStateAction } from 'react';
import { Discord } from '@api/metro/components';
import { TintedIcon } from '@ui/misc/forms';
import { getIDByName } from '@api/assets';
import { Strings } from '@api/i18n';


interface SearchProps extends TextInputProps {
	onClear: Fn;
	isRound?: boolean;
	isClearable?: boolean;
	leadingIcon?: any;
}

interface GeneralSearchProps {
	type: string;
	search: string;
	setSearch: Dispatch<SetStateAction<string>>;
}

function Search(props: SearchProps) {
	return <Discord.TextInput size='md' {...props} />;
}

export function GeneralSearch({ type, search, setSearch }: GeneralSearchProps) {
	return <Search
		placeholder={Strings.UNBOUND_SEARCH.format({ type })}
		value={search}
		onChange={(e: any) => setSearch(e)}
		onClear={() => setSearch('')}
		isClearable
		leadingIcon={() => {
			return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
				<TintedIcon source={getIDByName('ic_search')} size={16} />
			</View>;
		}}
	/>;
}

export default Search;
