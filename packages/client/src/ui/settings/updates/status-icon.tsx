import TintedIcon from '~/metro/fallbacks/tinted-icon';
import { icons } from '~/assets/api';

import useStyles from './status-icon.style';

type StatusIconProps = {
	/** `current` is a green check; `paused` an amber pause. */
	variant: 'current' | 'paused';
};

/** @description A row's trailing mark for a part that is up to date or whose updates are paused. */
function StatusIcon({ variant }: StatusIconProps) {
	const styles = useStyles();

	return variant === 'current' ? (
		<TintedIcon source={icons.CircleCheckIcon ?? 0} size={20} style={styles.current} />
	) : (
		<TintedIcon source={icons.PauseIcon ?? 0} size={20} style={styles.paused} />
	);
}

export default StatusIcon;
