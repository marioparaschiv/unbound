import { metro } from '@unbound-app/api';

import useStyles from './view-icon.style';

function ViewIcon() {
	const styles = useStyles();
	const { Svg, Path } = metro.common.SVG;

	return (
		<Svg width={20} height={20} viewBox='0 0 24 24'>
			<Path
				fill={styles.icon.color}
				d='M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Zm0 16H5V5h14v14ZM8.5 13.5 11 16.51 14.5 12 19 18H5l3.5-4.5ZM8 10.5A1.5 1.5 0 1 0 8 7.5a1.5 1.5 0 0 0 0 3Z'
			/>
		</Svg>
	);
}

export default ViewIcon;
