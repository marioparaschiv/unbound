import type { ReactElement, ReactNode, Ref } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

import { Discord, SafeArea } from '~/metro/components';

import useStyles from './page.style';

/** The props of {@link Page}. */
type PageProps = Pick<
	ScrollViewProps,
	'onScrollEndDrag' | 'onMomentumScrollEnd' | 'onContentSizeChange'
> & {
	/** The page's form groups, laid out top to bottom with a 24px gap. */
	children: ReactNode;
	/** The page's scroll view, for a page that restores its scroll offset. */
	ref?: Ref<ScrollView>;
};

/**
 * @description The standard settings page wrapper. A scroll view padded to 16 with a bottom safe-area
 * inset and a 24px gap between form groups, matching how Discord lays out its own settings screens. Use
 * it as the root of every settings page.
 */
function Page({ children, ...scroll }: PageProps): ReactElement {
	const styles = useStyles();

	return (
		<ScrollView
			{...scroll}
			contentContainerStyle={styles.scroll}
			keyboardShouldPersistTaps='handled'
		>
			<SafeArea.SafeAreaPaddingView bottom>
				<Discord.Stack spacing={24}>{children}</Discord.Stack>
			</SafeArea.SafeAreaPaddingView>
		</ScrollView>
	);
}

export default Page;
