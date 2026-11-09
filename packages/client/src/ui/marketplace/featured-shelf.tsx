import type { ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonKind } from '@unbound-app/types/addons';
import { View } from 'react-native';
import { memo } from 'react';

import FlashList from '~/ui/components/flash-list';
import { messages } from '~/i18n/api';

import useStyles from './featured-shelf.style';
import FeaturedCard from './featured-card';
import SectionTitle from './section-title';

type FeaturedShelfProps = {
	addons: ListedAddon[];
	kind: AddonKind;
};

type CardInfo = { item: ListedAddon; index: number };

const keyOf = (addon: ListedAddon) => addon.id;

/**
 * @description The Featured shelf atop a marketplace tab: compact cards in a virtualised row that scrolls
 * sideways, running to the screen's edges while the first and last line up with the list below.
 */
function FeaturedShelf({ addons, kind }: FeaturedShelfProps) {
	const styles = useStyles();

	function renderCard({ item, index }: CardInfo) {
		return (
			<View style={index ? styles.after : null}>
				<FeaturedCard addon={item} kind={kind} />
			</View>
		);
	}

	return (
		<View style={styles.shelf}>
			<SectionTitle>{messages.UNBOUND_MARKETPLACE_FEATURED}</SectionTitle>
			<FlashList
				horizontal
				showsHorizontalScrollIndicator={false}
				data={addons}
				keyExtractor={keyOf}
				renderItem={renderCard}
				estimatedItemSize={220}
				style={styles.scroller}
				contentContainerStyle={styles.row}
			/>
		</View>
	);
}

export default memo(FeaturedShelf);
