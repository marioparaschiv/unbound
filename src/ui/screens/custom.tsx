import type { CustomScreenProps } from '@typings/ui/settings/custom';
import { Discord } from '@api/metro/components';


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