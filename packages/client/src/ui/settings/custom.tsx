import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { Discord } from '~/metro/components';

type CustomScreenParams = {
	title?: string;
	render?: () => ReactNode;
};

type CustomScreenProps = {
	route: { params?: CustomScreenParams };
};

/**
 * @description A generic settings route that renders a component supplied via navigation params.
 */
function CustomScreen({ route }: CustomScreenProps) {
	const navigation = Discord.useNavigation();
	const { title, render } = route.params ?? {};

	useEffect(() => {
		if (title) {
			navigation.setOptions({ title });
		}
	}, [title]);

	return render?.() ?? null;
}

export default CustomScreen;
