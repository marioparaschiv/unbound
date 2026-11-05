import { createContext, useContext, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import useStyles from './deferred-page.style';

/** The segmented control's active tab, read by each {@link DeferredPage}. */
export const ActiveTab = createContext(0);

type DeferredPageProps = {
	index: number;
	children: ReactNode;
};

/**
 * @description Mounts a segmented-control page the first time its tab is selected and keeps it
 * mounted after, so unseen tabs cost nothing at open.
 */
function DeferredPage({ index, children }: DeferredPageProps) {
	const styles = useStyles();
	const active = useContext(ActiveTab);
	const [visited, setVisited] = useState(active === index);

	if (!visited && active === index) {
		setVisited(true);
	}

	return visited ? children : <View style={styles.placeholder} />;
}

export default DeferredPage;
