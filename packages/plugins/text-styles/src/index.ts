import { commands } from '@unbound-app/api';

import { mock, smallCaps, upsideDown, zalgo } from '~/styles';

const text = commands.option.string({ description: 'TEXT_DESC', required: true });

export function start() {
	commands.register({
		mock: { description: 'MOCK_DESC', options: { text }, execute: ({ text }) => mock(text) },
		upside: {
			description: 'UPSIDE_DESC',
			options: { text },
			execute: ({ text }) => upsideDown(text),
		},
		zalgo: { description: 'ZALGO_DESC', options: { text }, execute: ({ text }) => zalgo(text) },
		smallcaps: {
			description: 'SMALLCAPS_DESC',
			options: { text },
			execute: ({ text }) => smallCaps(text),
		},
	});
}

export function stop() {}
