import { StyleSheet } from 'react-native';

import { Discord } from '~/api/metro/components';

export default Discord.createStyles({
	// Full-size, so the self-positioned FAB stays inside its parent's bounds and receives touches.
	container: StyleSheet.absoluteFillObject,
});
