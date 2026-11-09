import { View } from 'react-native';

import useStyles from './tag-dot.style';

type TagDotProps = {
	/** The tag's CSS colour, as the catalog carries it. */
	color: string;
	/** `row` centres a dot in a table row's icon box; `pill` is the bare small dot a tag pill leads with. */
	variant?: 'row' | 'pill';
};

/**
 * @description A tag's coloured dot, as the website paints it beside each tag.
 */
function TagDot({ color, variant = 'row' }: TagDotProps) {
	const styles = useStyles();

	if (variant === 'pill') {
		return <View style={[styles.small, { backgroundColor: color }]} />;
	}

	return (
		<View style={styles.box}>
			<View style={[styles.dot, { backgroundColor: color }]} />
		</View>
	);
}

export default TagDot;
