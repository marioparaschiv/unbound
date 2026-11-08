import type { StyleProp, TextStyle } from 'react-native';
import type { AddonAuthor } from '@unbound-app/types';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import AddonAuthors from '~/ui/addons/addon-authors';

import useStyles from './carousel-authors.style';

type CarouselAuthorsProps = {
	authors: AddonAuthor[];
	/** The caption's animated style, so the names recolour with the preview's base as Discord's text does. */
	nameStyle?: StyleProp<TextStyle>;
	/** Discord's caption, kept hidden in the layout so the slot is exactly its height on every platform. */
	children: ReactNode;
};

/** @description The previewed addon's authors, laid over the theme carousel's hidden caption. */
function CarouselAuthors({ authors, nameStyle, children }: CarouselAuthorsProps) {
	const styles = useStyles();

	return (
		<View>
			<View
				style={styles.hidden}
				accessibilityElementsHidden
				importantForAccessibility='no-hide-descendants'
			>
				{children}
			</View>
			<View style={styles.overlay}>
				<AddonAuthors authors={authors} style={styles.authors} nameStyle={nameStyle} />
			</View>
		</View>
	);
}

export default CarouselAuthors;
