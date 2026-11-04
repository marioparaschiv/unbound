import { format, useMessages } from '@unbound-app/i18n';
import { useSetting } from '@unbound-app/settings';
import { Pressable, Text } from 'react-native';
import { flux } from '@unbound-app/api';
import { useState } from 'react';

import starAsset from '../../assets/star.svg?asset';

const UserStore = flux.getStore('User');

function StarCount() {
	useMessages();

	const [count, setCount] = useState(0);
	const appearance = useSetting('appearance');
	const user = flux.useStore(UserStore, () => UserStore.getCurrentUser());

	return (
		<Pressable accessibilityLabel={String(starAsset)} onPress={() => setCount(count + 1)}>
			<Text style={{ fontSize: appearance.size, color: appearance.accent }}>
				{user?.username}: {format('STARS', { count })}
			</Text>
		</Pressable>
	);
}

export default StarCount;
