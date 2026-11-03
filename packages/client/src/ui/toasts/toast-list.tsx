import { Platform, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';

import { Screens } from '~/metro/common';

import useStyles from './toast.style';
import Toast from './toast';

type ToastListProps = {
	ids: string[];
};

const androidInset =
	Platform.OS === 'android' ? { paddingTop: StatusBar.currentHeight ?? 0 } : null;

// Its styles read Discord's design module, so it renders only once a toast shows.
function ToastList({ ids }: ToastListProps) {
	const styles = useStyles();

	const list = (
		<SafeAreaView style={[styles.list, androidInset]} pointerEvents='box-none'>
			{ids.map((id) => (
				<Toast key={id} id={id} />
			))}
		</SafeAreaView>
	);

	// The overlay must be created only while toasts are visible so its window lands above other floating
	// windows (dialogs, action sheets) that may already be open.
	if (Platform.OS === 'android') {
		return (
			<View style={StyleSheet.absoluteFill} pointerEvents='box-none'>
				{list}
			</View>
		);
	}

	return <Screens.FullWindowOverlay>{list}</Screens.FullWindowOverlay>;
}

export default ToastList;
