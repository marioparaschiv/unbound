import { FlatList, ScrollView, View, Image, Text, TouchableOpacity } from 'react-native';
import { StyleSheet, Constants, Moment, Theme } from '@api/metro/common';
import { TintedIcon, Section } from '@ui/misc/forms';
import { GeneralSearch } from '@ui/misc/search';
import { Design } from '@api/metro/components';
import { useMemo, useState } from 'react';
import LoggerStore from '@stores/logger';
import { Icons } from '@api/assets';
import { Strings } from '@api/i18n';

const { TableRow, TableRowIcon } = Design;

const levelSelection = {
	variant(level: number) {
		return ['muted', 'normal', 'warning', 'danger'][level];
	},

	icon(level: number) {
		return ['ic_settings', 'ic_chat_bubble_16px', 'ic_warning_24px', 'failure-header'][level];
	}
};

export default function Logger() {
	const [search, setSearch] = useState('');
	const navigation = Design.useNavigation();
	const store = LoggerStore.useStore();
	const styles = useStyles();

	const data = useMemo(() => store.logs
		.filter(item => item.message?.toLowerCase()?.includes(search))
		.sort((a, b) => a.time - b.time), [search]);

	const unsubscribe = navigation.addListener('focus', () => {
		unsubscribe();
		navigation.setOptions({ headerRight: HeaderRight });
	});

	return <ScrollView>
		<View style={{ marginHorizontal: 16, marginVertical: 12 }}>
			<GeneralSearch
				type={'logs'}
				search={search}
				setSearch={setSearch}
			/>
		</View>
		<Section style={{ flex: 1, marginBottom: 108 }} margin={false}>
			<FlatList
				data={data}
				keyExtractor={(_, idx) => String(idx)}
				scrollEnabled={false}
				ListEmptyComponent={<View style={styles.empty}>
					<Image
						style={styles.emptyImage}
						source={Icons['img_connection_empty_dark']}
					/>
					<Text style={styles.emptyMessage}>
						{Strings.UNBOUND_LOGS_EMPTY}
					</Text>
				</View>}
				renderItem={({ item }) => {
					return <TableRow
						label={item.message}
						subLabel={Moment['module'](item.time).format('HH:mm:ss.SSS')}
						variant={levelSelection.variant(item.level)}
						icon={<TableRowIcon source={Icons[levelSelection.icon(item.level)]} />}
					/>;
				}}
			/>
		</Section>
	</ScrollView>;
}

const useStyles = StyleSheet.createStyles({
	touchable: {
		marginRight: 10
	},
	empty: {
		justifyContent: 'center',
		alignItems: 'center',
		marginTop: '50%'
	},
	emptyImage: {
		marginBottom: 10
	},
	emptyMessage: {
		color: Theme.colors.TEXT_MUTED,
		fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
		textAlign: 'center',
		paddingHorizontal: 25
	}
});

function HeaderRight() {
	const styles = useStyles();

	return <TouchableOpacity
		style={styles.touchable}
		onPress={() => LoggerStore.store.setState({ logs: [] })}
	>
		<TintedIcon source={Icons['ic_input_clear_24px']} />
	</TouchableOpacity>;
}