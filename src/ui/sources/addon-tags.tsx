import type { Source } from '@ui/sources/addons';
import { TintedIcon } from '@ui/misc/forms';
import { View, Text } from 'react-native';
import { Strings } from '@api/i18n';
import { Icons } from '@api/assets';

import useStyles from './addon-tags.style';


export function Tags({ source: tags }: { source: Source['data']['tags']; }) {
	const styles = useStyles();

	return <View style={styles.container}>
		<TintedIcon
			source={Icons['ic_tag']}
			size={16}
		/>
		<Text style={styles.tagsLabel}>
			{Strings.UNBOUND_TAGS}
		</Text>
		{tags.map(tag => (
			<View style={styles.tagBackground} key={tag}>
				<Text style={styles.tag}>
					{tag}
				</Text>
			</View>
		))}
	</View>;
}