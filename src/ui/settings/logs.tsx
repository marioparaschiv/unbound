import { View, TouchableOpacity, ScrollView } from 'react-native';
import { Discord, FlashList } from '@api/metro/components';
import { GeneralSearch } from '@ui/misc/search';
import useLoggerStore from '@stores/logger';
import { TintedIcon } from '@ui/misc/forms';
import { Moment } from '@api/metro/common';
import { useMemo, useState } from 'react';
import { Icons } from '@api/assets';

import useStyles from './logs.style';


const TYPE_NAMES = [
	'error',
	'info',
	'log',
	'warn',
	'trace',
	'debug'
];

export default function Logs() {
	const navigation = Discord.useNavigation();
	const [search, setSearch] = useState('');
	const store = useLoggerStore();
	const styles = useStyles();

	const data = useMemo(() => store.logs
		.filter(item => item.message?.toLowerCase()?.includes(search))
		.sort((a, b) => a.time - b.time),
		[store, search]);

	const unsubscribe = navigation.addListener('focus', () => {
		unsubscribe();
		navigation.setOptions({ headerRight: HeaderRight });
	});

	return <View style={styles.container}>
		<GeneralSearch
			type='logs'
			search={search}
			setSearch={setSearch}
		/>

		<FlashList.FlashList
			data={data}
			keyExtractor={(_, idx) => idx.toString()}
			ItemSeparatorComponent={Discord.TableRowDivider}
			estimatedItemSize={60}
			removeClippedSubviews
			renderScrollComponent={({ children, ...props }) => <ScrollView {...props}>
				{children}
				<View style={styles.listEnd} />
			</ScrollView>}
			renderItem={({ item, index }) => <Discord.TableRow
				key={`log-item-${index}`}
				label={item.message}
				subLabel={`${TYPE_NAMES[item.level].toUpperCase()} · ${Moment(item.time).format('HH:mm:ss.SSS')}`}
				start={index === 0}
				end={index === data.length - 1}
			/>}
		/>
	</View>;
}

function HeaderRight() {
	const styles = useStyles();

	return <TouchableOpacity
		style={styles.touchable}
		onPress={() => useLoggerStore.setState({ logs: [] })}
	>
		<TintedIcon source={Icons['TrashIcon']} />
	</TouchableOpacity>;
}