import type { ReactElement, ReactNode } from 'react';
import { View, ScrollView } from 'react-native';

import { SafeArea } from '~/metro/components';

/** The props of {@link Page}. */
type PageProps = {
	/** The page's form groups, laid out top to bottom with a 24px gap. */
	children: ReactNode;
};

/**
 * @description The standard settings page wrapper. A scroll view padded to 16 with a bottom safe-area
 * inset and a 24px gap between form groups, matching how Discord lays out its own settings screens. Use
 * it as the root of every settings page.
 */
function Page({ children }: PageProps): ReactElement {
	return (
		<ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps='handled'>
			<SafeArea.SafeAreaPaddingView bottom>
				<View style={{ gap: 24 }}>{children}</View>
			</SafeArea.SafeAreaPaddingView>
		</ScrollView>
	);
}

export default Page;
