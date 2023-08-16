import { findByName, findByProps } from '@metro';
import { noop } from '@utilities';
import { React, ReactNative as RN } from '@metro/common';

const BaseSearch = findByProps('useSearchControls', { lazy: true });
const SettingSearch = findByProps('useSettingSearchQuery', { lazy: true })
const SettingSearchBar = findByName('SettingSearchBar', { interop: false, lazy: true });

interface SearchContext {
    type: string;
    [key: PropertyKey]: any;
}

interface AdvancedSearchProps {
    searchContext: SearchContext;
    controls: NonNullable<unknown>;
}

type AdvancedSearchType = {
    (props: AdvancedSearchProps): React.ReactElement;
    useAdvancedSearch: typeof useAdvancedSearch
}

export const useAdvancedSearch = (searchContext: SearchContext) => {
    const query: string = SettingSearch.useSettingSearchQuery();
    const controls: Record<string, any> = BaseSearch.useSearchControls(searchContext, false, noop);

    React.useEffect(() => {
        // Set the query back to nothing again so that it doesn't persist to the real SettingSearch
        return () => {
            SettingSearch.setSettingSearchQuery('')
            SettingSearch.setIsSettingSearchActive(false);
        }
    }, [])

    return [query, controls] as const;
}

export const AdvancedSearch = (({ searchContext, controls }: AdvancedSearchProps) => {
    // This Search component will not render unless the direct parent or one of the recent parents is a ScrollView.
    // Therefore, I'm going to get rid of this dependency by using one and setting `scrollEnabled` to false.
    return (
        <RN.ScrollView scrollEnabled={false}>
            <BaseSearch.default 
                searchContext={searchContext}
                controls={controls}
            >
                <SettingSearchBar.default />
            </BaseSearch.default>
        </RN.ScrollView>
    )
}) as AdvancedSearchType
// We can lie to TypeScript saying that `useAdvancedSearch` exists on the function
// This is fine because it is assigned on the line below.

Object.assign(AdvancedSearch, { useAdvancedSearch });
export default AdvancedSearch;