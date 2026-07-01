import { ScrollView } from 'react-native';

import { SafeArea } from '~/api/metro/components';

type PageProps = {
	children: any;
};

/**
 * @description The standard settings page wrapper, mirroring Discord's own settings screens: a scroll
 * view padded to 16 with a bottom safe-area inset. Use it as the root of every settings page so spacing
 * matches the native pages.
 */
function Page({ children }: PageProps) {
	return (
		<ScrollView contentContainerStyle={{ padding: 16 }}>
			<SafeArea.SafeAreaPaddingView bottom>{children}</SafeArea.SafeAreaPaddingView>
		</ScrollView>
	);
}

export default Page;
