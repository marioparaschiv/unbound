import type { AddonListProps } from '@typings/ui/addons/addon-list';
import { Discord, FlashList } from '@api/metro/components';
import AddonCard from '@ui/addons/addon-card';
import Empty from '@ui/misc/empty-state';
import { View } from 'react-native';

import useStyles from './addon-list.style';


function AddonList(props: AddonListProps) {
	const styles = useStyles();

	return <View style={styles.container}>
		{props.addons.length !== 0 && <FlashList.FlashList
			data={props.addons}
			renderItem={({ item }) => <AddonCard
				kind={props.kind}
				addon={item}
			/>}
		/>}
		{props.addons.length === 0 && <Empty>
			<Discord.Text>
				Damn.
			</Discord.Text>
		</Empty>}
	</View>;
}


export default AddonList;