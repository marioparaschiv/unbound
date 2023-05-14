import { ReactNative as RN, React, StyleSheet, Constants, Moment, Theme } from '@metro/common';
import { Forms, Navigation } from '@metro/components';
import Logger from '@stores/logger';
import Assets from '@api/assets';

const { Fonts } = Constants;
const { colors } = Theme;

export default function () {

	const navigation = Navigation.useNavigation();
	const store = Logger.useStore();

	React.useEffect(() => {
		navigation.setOptions({ headerRight: HeaderRight });
	}, []);

	return <Forms.FormSection style={{ flex: 1 }}>
		<RN.FlatList
			data={store.logs.sort((a, b) => a.time - b.time)}
			keyExtractor={(_, idx) => String(idx)}
			/* TODO: Empty Placeholder */
			ListEmptyComponent={() => <RN.Text>nothing here!</RN.Text>}
			ItemSeparatorComponent={Forms.FormDivider}
			renderItem={({ item }) => {
				// to-do: move this out of render to avoid event listener leak
				const styles = StyleSheet.createThemedStyleSheet({
					log: {
						fontSize: 16,
						fontFamily: Fonts.DISPLAY_SEMIBOLD,
						color: (() => {
							switch (item.level) {
								case 1:
									return colors.TEXT_NORMAL;
								case 0:
									return colors.TEXT_MUTED;
								case 2:
									return 'yellow';
								case 3:
									return 'red';
							}
						})(),
					},
					time: {
						fontSize: 16,
						fontFamily: Fonts.DISPLAY_SEMIBOLD,
						color: colors.TEXT_MUTED
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
		tintColor: colors.TEXT_NORMAL
	}
});

function HeaderRight() {
	return <RN.TouchableOpacity
		style={styles.touchable}
		onPress={() => Logger.store.setState({ logs: [] })}
	>
		<RN.Image
			style={styles.image}
			source={Assets.getIDByName('ic_input_clear_24px')}
		/>
	</RN.TouchableOpacity>;
}