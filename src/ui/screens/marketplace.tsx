import { Discord } from '@api/metro/components';
import { Image, View } from 'react-native';
import { Icons } from '@api/assets';


function MarketplacePage() {
	return <View style={{ flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
		<Image source={Icons['danger-dave']} />
		<Discord.Text variant='heading-md/bold'>Coming Soon.</Discord.Text>
	</View>;
};

export default MarketplacePage;