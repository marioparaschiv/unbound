import { messages, useMessages } from '@unbound-app/i18n';
import { Image, Text, View } from 'react-native';

import icon from '../../assets/icon.png';
import Star from '../../assets/star.svg';

function GreetingTitle() {
	useMessages();

	return (
		<View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
			<Image source={icon} />
			<Star width={16} height={16} />
			<Text>{messages.GREETING_TITLE}</Text>
		</View>
	);
}

export default GreetingTitle;
