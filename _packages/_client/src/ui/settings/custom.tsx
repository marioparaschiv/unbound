import { Discord } from '~/api/metro/components';
import type { ComponentType } from 'react';


export interface CustomScreenProps {
	title: string;
	render: ComponentType<any>;
}

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