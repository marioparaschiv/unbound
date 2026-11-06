import { createFileRoute } from '@tanstack/react-router';

import ThemeMaker from '~/components/theme-maker/theme-maker';
import PageHeader from '~/components/page-header';

function CreateThemePage() {
	return (
		<div className='flex flex-col gap-6 page-frame'>
			<PageHeader
				title='Create a Theme'
				description='Pick three colors, see them on Discord, and download a theme you can submit.'
			/>
			<ThemeMaker />
		</div>
	);
}

export const Route = createFileRoute('/_site/themes_/create')({
	head: () => ({ meta: [{ title: 'Unbound | Create a Theme' }] }),
	component: CreateThemePage,
});
