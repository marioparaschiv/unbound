import type { TextVariant } from '@unbound-app/types/components';

import { Discord } from '~/metro/components';
import { Manager } from '~/addons/manager';

import useStyles from './font-sample.style';

type FontSampleProps = {
	text: string;
	/** A Discord family, which draws its override, or a face's PostScript name; Discord's font when omitted. */
	family?: string;
	variant?: TextVariant;
	lines?: number;
	/** Set for an italic Discord family: iOS draws Discord's italics from the upright family plus this style. */
	italic?: boolean;
};

/**
 * @description Text drawn in one font. It remounts on every font store change, because text keeps the
 * typeface it was first laid out with, so a sample shows a new override at once.
 */
function FontSample({
	text,
	family,
	variant = 'text-md/normal',
	lines = 1,
	italic = false,
}: FontSampleProps) {
	const styles = useStyles();
	const { revision } = Manager.for('font');

	return (
		<Discord.Text
			key={revision}
			variant={variant}
			numberOfLines={lines}
			style={
				family ? [styles.face, italic ? styles.italic : null, { fontFamily: family }] : null
			}
		>
			{text}
		</Discord.Text>
	);
}

export default FontSample;
