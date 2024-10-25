import type { ApplicationCommand } from '@typings/api/commands';
import { Messages } from '@api/metro/api';


async function handleEvaluation(src: string) {
	const out = { res: null, err: null, time: null };
	const isAsync = src.includes('await');

	if (isAsync) {
		src = `(async function() { return ${src} })()`;
	}

	const start = new Date().getTime();

	try {
		out.res = eval(src);

		if (isAsync) {
			out.res = await out.res;
		}
	} catch (err) {
		out.res = err;
		out.err = true;
	}

	out.time = new Date().getTime() - start;

	return out;
}

export default {
	name: 'eval',
	description: 'Allows you to execute code through evaluation.',

	options: [
		{
			name: 'src',
			description: 'Source of the code to evaluate (BE CAREFUL AS PASTING CODE FROM RANDOM PEOPLE IS DANGEROUS)',
			type: 3,
			required: true
		}
	],

	async execute(args, context) {
		const src: string = args.find(x => x.name === 'src').value;
		const { res, err, time } = await handleEvaluation(src);

		const status = err ? 'Failed executing' : 'Successfully executed';

		console.log(res);

		Messages.sendBotMessage(context.channel.id, [
			`${status} in ${time}ms`,
			'\`\`\`js',
			res ? res.toString().trim() : 'undefined',
			'\`\`\`',
		].join('\n'));
	}
} as ApplicationCommand;