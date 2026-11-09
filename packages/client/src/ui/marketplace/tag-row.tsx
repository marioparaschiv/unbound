import type { Tag } from '@unbound-app/contracts/tags';
import { ScrollView, View } from 'react-native';

import useScrollEdges from './use-scroll-edges';
import useStyles from './tag-row.style';
import EdgeFade from './edge-fade';
import TagPill from './tag-pill';

type TagRowProps = {
	tags: Tag[];
};

/**
 * @description An addon's tags in one horizontally scrolling line. A scroll shadow covers each end only
 * while tags hide past it, so a row that fits shows none.
 */
function TagRow({ tags }: TagRowProps) {
	const styles = useStyles();
	const { edges, handlers } = useScrollEdges();

	return (
		<View style={styles.row}>
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.content}
				{...handlers}
			>
				{tags.map((tag) => (
					<TagPill key={tag.id} tag={tag} />
				))}
			</ScrollView>
			<EdgeFade side='start' visible={edges.start} />
			<EdgeFade side='end' visible={edges.end} />
		</View>
	);
}

export default TagRow;
