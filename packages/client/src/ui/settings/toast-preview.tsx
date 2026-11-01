import { View } from 'react-native';

import ToastContent from '~/ui/toasts/toast-content';
import ToastSurface from '~/ui/toasts/toast-surface';
import ToastIcon from '~/ui/toasts/toast-icon';
import { messages } from '~/i18n/api';

import useStyles from './toast-preview.style';

/**
 * @description A sample toast over coloured shapes, so the saved opacity and blur show as they change.
 */
function ToastPreview() {
	const styles = useStyles();

	return (
		<View style={styles.stage} accessibilityElementsHidden>
			<View style={[styles.shape, styles.brand]} />
			<View style={[styles.shape, styles.positive]} />
			<View style={[styles.shape, styles.warning]} />
			<ToastSurface style={styles.toast}>
				<View style={styles.row}>
					<ToastIcon icon='BellIcon' />
					<ToastContent
						title={messages.UNBOUND_TOASTS_PREVIEW_TITLE}
						content={messages.UNBOUND_TOASTS_PREVIEW_CONTENT}
					/>
				</View>
			</ToastSurface>
		</View>
	);
}

export default ToastPreview;
