import { find, findByName, findByProps } from '@metro';

export const [
	Redesign,
	Slider,
	HelpMessage,
	Media
] = [
		findByProps('SegmentedControl', 'Stack', { lazy: true }),
		find(m => m.render?.name === 'SliderComponent'),
		findByName('HelpMessage'),
		findByProps('openMediaModal', { lazy: true })
	];