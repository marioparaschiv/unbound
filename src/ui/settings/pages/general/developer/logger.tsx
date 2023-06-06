import { ReactNative as RN, React, StyleSheet, Constants, Moment, Theme, i18n } from '@metro/common';
import { Forms, Navigation } from '@metro/components';
import { Icons } from '@api/assets';
import Logger from '@stores/logger';

export default function () {
	const navigation = Navigation.useNavigation();
	const store = Logger.useStore();

    const unsubscribe = navigation.addListener('focus', () => {
        unsubscribe();
        navigation.setOptions({ headerRight: HeaderRight });
    });

	return <Forms.FormSection style={{ flex: 1 }}>
		<RN.FlatList
			data={store.logs.sort((a, b) => a.time - b.time)}
			keyExtractor={(_, idx) => String(idx)}
			ListEmptyComponent={<RN.View style={styles.empty}>
				<RN.Image
					style={styles.emptyImage}
					source={Icons['img_connection_empty_dark']}
				/>
				<RN.Text style={styles.emptyMessage}>
					{i18n.Messages.UNBOUND_LOGS_EMPTY}
				</RN.Text>
			</RN.View>}
			ItemSeparatorComponent={Forms.FormDivider}
			renderItem={({ item }) => {
				// to-do: move this out of render to avoid event listener leak
				const styles = StyleSheet.createThemedStyleSheet({
					log: {
						fontSize: 16,
						fontFamily: Constants.Fonts.DISPLAY_SEMIBOLD,
						color: (() => {
							switch (item.level) {
								case 1:
									return Theme.colors.TEXT_NORMAL;
								case 0:
									return Theme.colors.TEXT_MUTED;
								case 2:
									return 'yellow';
								case 3:
									return 'red';
							}
						})(),
					},
					time: {
						fontSize: 16,
						fontFamily: Constants.Fonts.DISPLAY_SEMIBOLD,
						color: Theme.colors.TEXT_MUTED
					}
				});

				return <Forms.FormRow
					label={() => <RN.Text style={styles.log}>
						{item.message}
					</RN.Text>}
					subLabel={Moment(item.time).format('HH:mm:ss.SSS')}
				/>;
			}}
		/>
	</Forms.FormSection>;
}


const styles = StyleSheet.createThemedStyleSheet({
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
	return <RN.TouchableOpacity
		style={styles.touchable}
		onPress={() => Logger.store.setState({ logs: [] })}
	>
		<RN.Image
			style={styles.image}
			source={Icons['ic_input_clear_24px']}
		/>
	</RN.TouchableOpacity>;
}