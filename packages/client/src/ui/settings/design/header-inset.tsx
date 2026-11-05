import { useContext, type ReactNode } from 'react';
import { View } from 'react-native';

import { HeaderElements } from './navigation';
import useStyles from './header-inset.style';

type HeaderInsetProps = {
	children: ReactNode;
};

/** @description Pads a page below a transparent header and anything overlaid with it. */
function HeaderInset({ children }: HeaderInsetProps) {
	const styles = useStyles();
	const top = useContext(HeaderElements.HeaderHeightContext) ?? 0;

	return <View style={[styles.inset, { paddingTop: top }]}>{children}</View>;
}

export default HeaderInset;
