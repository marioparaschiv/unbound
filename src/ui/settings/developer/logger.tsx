import { ReactNative as RN, React, StyleSheet, Constants, Moment, Theme } from '@metro/common';
import { Section, Row, RowIcon } from '@ui/components/form';
import { Redesign } from '@metro/components';
import LoggerStore from '@stores/logger';
import { Icons } from '@api/assets';
import { Strings } from '@api/i18n';
import { GeneralSearch } from '@ui/components/search';

const levelSelection = {
	variant(level: number) {
		return ['muted', 'normal', 'warning', 'danger'][level];
	},

	icon(level: number) {
		return ['ic_settings', 'ic_chat_bubble_16px', 'ic_warning_24px', 'failure-header'][level];
	}
};

export default function Logger() {
	const [search, setSearch] = React.useState('');
	const navigation = Redesign.useNavigation();
	const store = LoggerStore.useStore();
	const styles = useStyles();

	const data = React.useMemo(() => store.logs
		.filter(item => item.message?.toLowerCase()?.includes(search))
		.sort((a, b) => a.time - b.time), [search]);

	const unsubscribe = navigation.addListener('focus', () => {
		unsubscribe();
		navigation.setOptions({ headerRight: HeaderRight });
	});

	return <RN.View>
		<RN.View style={{ marginHorizontal: 16, marginVertical: 12 }}>
			<GeneralSearch
				type={'logs'}
				search={search}
				setSearch={setSearch}
			/>
		</RN.View>
		<Section style={{ flex: 1, marginBottom: 108 }} margin={false}>
			<RN.FlatList
				data={data}
				keyExtractor={(_, idx) => String(idx)}
				scrollEnabled={false}
				ListEmptyComponent={<RN.View style={styles.empty}>
					<RN.Image
						style={styles.emptyImage}
						source={Icons['img_connection_empty_dark']}
					/>
					<RN.Text style={styles.emptyMessage}>
						{Strings.UNBOUND_LOGS_EMPTY}
					</RN.Text>
				</RN.View>}
				renderItem={({ item }) => {
					return <Row
						label={item.message}
						subLabel={Moment(item.time).format('HH:mm:ss.SSS')}
						variant={levelSelection.variant(item.level)}
						icon={<RowIcon source={Icons[levelSelection.icon(item.level)]} />}
					/>;
				}}
			/>
		</Section>
	</RN.View>;
}

const useStyles = StyleSheet.createStyles({
	touchable: {
		marginRight: 10
	},
	image: {
		tintColor: Theme.colors.TEXT_NORMAL
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

	return <RN.TouchableOpacity
		style={styles.touchable}
		onPress={() => LoggerStore.store.setState({ logs: [] })}
	>
		<RN.Image
			style={styles.image}
			source={Icons['ic_input_clear_24px']}
		/>
	</RN.TouchableOpacity>;
}