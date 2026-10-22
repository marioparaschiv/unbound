import { View } from 'react-native';
import { memo } from 'react';

import { Discord } from '~/api/metro/components';
import { Theme } from '~/api/metro/common';

import useStyles from './addon-title.style';

type AddonTitleProps = {
	name: string;
	version?: string;
};

/**
 * @description An addon's name on one line, followed by its version in a badge when it has one.
 */
function AddonTitle({ name, version }: AddonTitleProps) {
	const styles = useStyles();

	return (
		<View style={styles.row}>
			<Discord.Text
				variant='text-md/semibold'
				style={[styles.name, { color: Theme.colors.TEXT_STRONG }]}
				numberOfLines={1}
			>
				{name}
			</Discord.Text>
			{version ? (
				<View style={styles.versionBadge}>
					<Discord.Text
						variant='text-xxs/semibold'
						style={{ color: Theme.colors.TEXT_MUTED }}
					>
						v{version}
					</Discord.Text>
				</View>
			) : null}
		</View>
	);
}

export default memo(AddonTitle);
