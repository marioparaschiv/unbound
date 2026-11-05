import { memo } from 'react';

import { Discord } from '~/metro/components';

import useStyles from './addon-title.style';
import AddonTag from './addon-tag';

type AddonTitleProps = {
	name: string;
	version?: string;
	/** A label shown after the version, such as Library. */
	tag?: string;
};

/**
 * @description An addon's name on one line, followed by its version and an optional tag, each in a small tag.
 */
function AddonTitle({ name, version, tag }: AddonTitleProps) {
	const styles = useStyles();

	return (
		<Discord.Stack direction='horizontal' spacing={8} align='center'>
			<Discord.Text variant='text-md/semibold' style={styles.name} numberOfLines={1}>
				{name}
			</Discord.Text>
			{version ? <AddonTag>{`v${version}`}</AddonTag> : null}
			{tag ? <AddonTag variant='brand'>{tag}</AddonTag> : null}
		</Discord.Stack>
	);
}

export default memo(AddonTitle);
