import { FlashList } from '~/api/metro/components';
import AddonCard from '~/ui/addons/addon-card';
import { View } from 'react-native';

import type { AddonListProps } from '../@unbound-app/types/ui/addons/addon-list';
import useStyles from './addon-list.style';


function AddonList(props: AddonListProps) {
	const styles = useStyles();

	return <View style={styles.container}>
		<FlashList.FlashList
			data={props.addons}
			renderItem={({ item }) => <AddonCard
				kind={props.kind}
				addon={item}
			/>}
		/>
	</View>;
}


export default AddonList;