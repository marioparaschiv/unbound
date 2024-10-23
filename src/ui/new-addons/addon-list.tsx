import type { AddonListProps } from '@typings/ui/addons/addon-list';
import AddonCard from '@ui/new-addons/addon-card';
import { FlashList } from '@api/metro/components';
import { View } from 'react-native';


function AddonPage(props: AddonListProps) {
	return <View style={{ flex: 1 }}>
		<FlashList.FlashList
			data={props.addons}
			estimatedItemSize={200}
			renderItem={({ item }) => <AddonCard
				kind={props.kind}
				addon={item}
			/>}
		/>
	</View>;
}


export default AddonPage;