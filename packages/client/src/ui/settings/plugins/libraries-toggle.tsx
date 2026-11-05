import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';

import useStyles from './libraries-toggle.style';

type LibrariesToggleProps = {
	count: number;
	shown: boolean;
	onToggle: () => void;
};

/** @description Shows or hides the library plugins, counting them while hidden. Renders nothing without any. */
function LibrariesToggle({ count, shown, onToggle }: LibrariesToggleProps) {
	const styles = useStyles();

	if (!count) return null;

	return (
		<Discord.Button
			variant='tertiary'
			size='sm'
			style={styles.toggle}
			text={
				shown
					? messages.UNBOUND_HIDE_LIBRARIES
					: format('UNBOUND_SHOW_LIBRARIES', { count })
			}
			onPress={onToggle}
		/>
	);
}

export default LibrariesToggle;
