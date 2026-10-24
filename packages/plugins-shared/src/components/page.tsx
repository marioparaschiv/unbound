import { SafeArea } from '@unbound-app/api/metro/components';
import { ScrollView, View } from 'react-native';
import type { ReactNode } from 'react';

type PageProps = {
	children: ReactNode;
};

/**
 * @description The root of a plugin settings panel, laid out like Unbound's own settings pages.
 * @param props The page's children, usually `Discord.TableRowGroup`s.
 * @returns A padded scroll view with a 24px gap between groups.
 */
function Page({ children }: PageProps) {
	return (
		<ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps='handled'>
			<SafeArea.SafeAreaPaddingView bottom>
				<View style={{ gap: 24 }}>{children}</View>
			</SafeArea.SafeAreaPaddingView>
		</ScrollView>
	);
}

export default Page;
