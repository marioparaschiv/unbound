import type { Tag } from '@unbound-app/contracts/tags';
import { View } from 'react-native';
import { memo } from 'react';

import { Discord } from '~/metro/components';

import useStyles from './tag-pill.style';
import TagDot from './tag-dot';

type TagPillProps = {
	tag: Tag;
};

/**
 * @description One of an addon's tags on its Marketplace card: the tag's dot and label, in the version pill's style.
 */
function TagPill({ tag }: TagPillProps) {
	const styles = useStyles();

	return (
		<View style={styles.pill}>
			<TagDot color={tag.color} variant='pill' />
			<Discord.Text variant='text-xxs/semibold' numberOfLines={1} style={styles.label}>
				{tag.label}
			</Discord.Text>
		</View>
	);
}

export default memo(TagPill);
