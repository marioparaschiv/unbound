import type { Dispatch, SetStateAction } from 'react';
import type { TextInputProps } from 'react-native';
import { ReactNative as RN } from '@metro/common';
import { TintedIcon } from '@ui/components/misc';
import { Redesign } from '@metro/components';
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
	setSearch: Dispatch<SetStateAction<string>>
}

function Search(props: SearchProps) {
	return <Redesign.TextInput size='md' {...props} />;
}

export function GeneralSearch({ type, search, setSearch }: GeneralSearchProps) {
	return <Search
		placeholder={Strings.UNBOUND_SEARCH.format({ type })}
		value={search}
		onChange={(e: any) => setSearch(e)}
		onClear={() => setSearch('')}
		isClearable
		leadingIcon={() => {
			return <RN.View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
				<TintedIcon source={getIDByName('ic_search')} size={16} />
			</RN.View>;
		}}
	/>;
}

export default Search;
