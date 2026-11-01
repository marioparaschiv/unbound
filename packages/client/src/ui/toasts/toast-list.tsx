import { Platform, SafeAreaView, StatusBar } from 'react-native';

import useStyles from './toast-list.style';
import Toast from './toast';

type ToastListProps = {
	ids: string[];
};

const androidInset =
	Platform.OS === 'android' ? { paddingTop: StatusBar.currentHeight ?? 0 } : null;

// Its styles read Discord's design module, so it renders only once a toast shows.
function ToastList({ ids }: ToastListProps) {
	const styles = useStyles();

	return (
		<SafeAreaView style={[styles.container, androidInset]} pointerEvents='box-none'>
			{ids.map((id) => (
				<Toast key={id} id={id} />
			))}
		</SafeAreaView>
	);
}

export default ToastList;
