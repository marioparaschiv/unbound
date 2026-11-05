import type { StyleProp, TextStyle } from 'react-native';
import type { AddonAuthor } from '@unbound-app/types';

import AddonAuthors from '~/ui/addons/addon-authors';

import useStyles from './carousel-authors.style';

type CarouselAuthorsProps = {
	authors: AddonAuthor[];
	/** The caption's animated style, so the names recolour with the preview's base as Discord's text does. */
	nameStyle?: StyleProp<TextStyle>;
};

/** @description The previewed addon's authors, centred where the theme carousel's caption was. */
function CarouselAuthors({ authors, nameStyle }: CarouselAuthorsProps) {
	const styles = useStyles();

	return <AddonAuthors authors={authors} style={styles.authors} nameStyle={nameStyle} />;
}

export default CarouselAuthors;
