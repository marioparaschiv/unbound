import { Discord } from '~/api/metro/components';

import type { CustomScreenProps } from '../@unbound-app/types/ui/settings/custom';


function Custom({ route }: { route: { params: CustomScreenProps; }; }) {
	const { render: Component, title, ...props } = route.params ?? {};

	const navigation = Discord.useNavigation();
	const unsubscribe = navigation.addListener('focus', () => {
		unsubscribe();
		navigation.setOptions({ title });
	});

	return <Component {...props} />;
}

export default Custom;