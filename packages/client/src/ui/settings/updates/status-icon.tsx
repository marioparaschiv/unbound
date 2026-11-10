import TintedIcon from '~/metro/fallbacks/tinted-icon';
import { icons } from '~/assets/api';

import useStyles from './status-icon.style';

/** `current` is a green check, `paused` an amber pause, `blocked` an amber warning, `update` a brand download. */
type StatusVariant = 'current' | 'paused' | 'blocked' | 'update';

type StatusIconProps = {
	variant: StatusVariant;
};

const ICONS = {
	current: 'CircleCheckIcon',
	paused: 'PauseIcon',
	blocked: 'WarningIcon',
	update: 'DownloadIcon',
} as const satisfies Record<StatusVariant, string>;

/**
 * @description A row's trailing mark for a part that is up to date, paused, blocked on a loader update, or
 * has one waiting.
 */
function StatusIcon({ variant }: StatusIconProps) {
	const styles = useStyles();

	return <TintedIcon source={icons[ICONS[variant]] ?? 0} size={20} style={styles[variant]} />;
}

export default StatusIcon;
