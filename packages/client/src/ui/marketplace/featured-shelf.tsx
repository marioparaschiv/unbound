import type { ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonKind } from '@unbound-app/types/addons';
import { ScrollView, View } from 'react-native';
import { memo } from 'react';

import { messages } from '~/i18n/api';

import useStyles from './featured-shelf.style';
import FeaturedCard from './featured-card';
import SectionTitle from './section-title';

type FeaturedShelfProps = {
	addons: ListedAddon[];
	kind: AddonKind;
};

/**
 * @description The Featured shelf atop a marketplace tab: compact cards that scroll sideways,
 * running to the screen's edges while the first and last line up with the list below.
 */
function FeaturedShelf({ addons, kind }: FeaturedShelfProps) {
	const styles = useStyles();

	return (
		<View style={styles.shelf}>
			<SectionTitle>{messages.UNBOUND_MARKETPLACE_FEATURED}</SectionTitle>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				style={styles.scroller}
				contentContainerStyle={styles.row}
			>
				{addons.map((addon) => (
					<FeaturedCard key={addon.id} addon={addon} kind={kind} />
				))}
			</ScrollView>
		</View>
	);
}

export default memo(FeaturedShelf);
