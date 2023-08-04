import type { ApplicationCommand } from '@typings/api/commands';
import { findByProps } from '@metro';
import { ClientName } from '@constants';

const Messages = findByProps('sendMessage', 'receiveMessage', { lazy: true });
const Clyde = findByProps('createBotMessage', { lazy: true });

async function handleEvaluation(src: string) {
    const out = { res: null, err: null, time: null };
    const isAsync = src.includes("await");

    if (isAsync) {
        src = `(async function() { return ${src} })()`;
    }
  
    const start = new Date().getTime();

    try {
        out.res = eval(src);

        if (isAsync) {
            out.res = await out.res;
        }
    } catch(err) {
        out.res = err;
        out.err = true;
    }
  
    out.time = new Date().getTime() - start;

    return out;
}

function sendBotMessage(channelId: string, content: (string | object), username = ClientName): void {
    const message = Clyde.createBotMessage({ channelId, content: '' });
  
    message.author.username = username
  
    if (typeof content === 'string') {
      message.content = content;
    } else {
      Object.assign(message, content);
    }
  
    Messages.receiveMessage(channelId, message);
  }

export default {
	name: 'eval',
	description: 'Allows you to execute code through evaluation.',

    options: [
        {
            name: "src",
            displayName: "src",

            description: "Source of the code to evaluate (BE CAREFUL AS PASTING CODE FROM RANDOM PEOPLE IS DANGEROUS)",
            displayDescription: "Source of the code to evaluate (BE CAREFUL AS PASTING CODE FROM RANDOM PEOPLE IS DANGEROUS)",
            
            type: 3,
            required: true
        }
    ],

	async execute(args, context) {
        const src: string = args.find(x => x.name === "src").value;
        const { res, err, time } = await handleEvaluation(src);
        
        sendBotMessage(
            context.channel.id, 
            `${err ? "Failed executing" : "Successfully executed"} in ${time}ms
            \`\`\`js
            ${res}
            \`\`\`
            `.split('\n').map(line => line.trim()).join('\n')
        )
    }
} as ApplicationCommand;