import type { ScrollViewProps, StyleProp, ViewStyle } from 'react-native';
import { createElement, type ReactElement, type Ref } from 'react';

import { FlashList as FlashListModule } from '~/metro/components';

type ListItemInfo<T> = { item: T; index: number };

type ScrollToOffset = { offset: number; animated?: boolean };

/** The list methods our pages call. */
export type FlashListHandle = {
	scrollToOffset: (params: ScrollToOffset) => void;
};

/** The `FlashList` props our pages pass; Discord's copy ships no types of its own. */
type FlashListProps<T> = {
	ref?: Ref<FlashListHandle>;
	data: T[];
	extraData?: string;
	keyExtractor: (item: T) => string;
	renderItem: (info: ListItemInfo<T>) => ReactElement;
	estimatedItemSize: number;
	ListEmptyComponent?: ReactElement;
	ListHeaderComponent?: ReactElement;
	ListFooterComponent?: ReactElement;
	horizontal?: boolean;
	showsHorizontalScrollIndicator?: boolean;
	keyboardDismissMode?: ScrollViewProps['keyboardDismissMode'];
	refreshControl?: ScrollViewProps['refreshControl'];
	style?: StyleProp<ViewStyle>;
	contentContainerStyle?: StyleProp<ViewStyle>;
};

/**
 * @description Discord's `FlashList`, typed for the props our pages pass. React 19 hands `ref` over as a prop.
 * @template T The list's item type.
 */
function FlashList<T>(props: FlashListProps<T>) {
	return createElement(FlashListModule.FlashList, props);
}

export default FlashList;
