import { ScrollView, View } from 'react-native';
import type { ReactNode } from 'react';

import { Discord, SafeArea } from '~/metro/components';

import useStyles from './sync-focus-page.style';

type SyncFocusPageProps = {
	/** Centred in the space above the footer. */
	hero: ReactNode;
	/** Pinned to the bottom of the screen, within thumb reach. */
	footer?: ReactNode;
};

/**
 * @description The Sync page while one step blocks the rest, such as signing in or the first-sync choice: the
 * hero in the middle of the screen and the step's actions at the bottom. Scrolls when the screen is too short.
 */
function SyncFocusPage({ hero, footer }: SyncFocusPageProps) {
	const styles = useStyles();

	return (
		<ScrollView contentContainerStyle={styles.scroll}>
			<SafeArea.SafeAreaPaddingView bottom style={styles.fill}>
				<View style={styles.middle}>{hero}</View>
				{footer ? <Discord.Stack spacing={16}>{footer}</Discord.Stack> : null}
			</SafeArea.SafeAreaPaddingView>
		</ScrollView>
	);
}

export default SyncFocusPage;
