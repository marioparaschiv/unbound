import { commands } from '@unbound-app/api';

import { withKaomoji, type KaomojiName } from '~/kaomoji';

const DESCRIPTIONS = {
	dissatisfaction: 'KAOMOJI_DISSATISFACTION',
	smug: 'KAOMOJI_SMUG',
	happy: 'KAOMOJI_HAPPY',
	crying: 'KAOMOJI_CRYING',
	angry: 'KAOMOJI_ANGRY',
	anger: 'KAOMOJI_ANGER',
	joy: 'KAOMOJI_JOY',
	blush: 'KAOMOJI_BLUSH',
	confused: 'KAOMOJI_CONFUSED',
	sleeping: 'KAOMOJI_SLEEPING',
	laughing: 'KAOMOJI_LAUGHING',
} as const satisfies Record<KaomojiName, string>;

function kaomojiCommand<K extends KaomojiName>(name: K) {
	return {
		description: DESCRIPTIONS[name],
		options: { message: commands.option.string({ description: 'MESSAGE_DESC' }) },
		execute: ({ message }: { message?: string }) => withKaomoji(name, message),
	};
}

export function start() {
	commands.register({
		dissatisfaction: kaomojiCommand('dissatisfaction'),
		smug: kaomojiCommand('smug'),
		happy: kaomojiCommand('happy'),
		crying: kaomojiCommand('crying'),
		angry: kaomojiCommand('angry'),
		anger: kaomojiCommand('anger'),
		joy: kaomojiCommand('joy'),
		blush: kaomojiCommand('blush'),
		confused: kaomojiCommand('confused'),
		sleeping: kaomojiCommand('sleeping'),
		laughing: kaomojiCommand('laughing'),
	});
}

export function stop() {}
