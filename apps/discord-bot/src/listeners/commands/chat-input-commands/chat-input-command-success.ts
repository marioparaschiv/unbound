import type { ChatInputCommandSuccessPayload } from '@sapphire/framework';
import { Events, Listener } from '@sapphire/framework';
import { ApplyOptions } from '@sapphire/decorators';

import { isDebugLogging, logSuccessCommand } from '~/lib/log-command';

@ApplyOptions<Listener.Options>({ event: Events.ChatInputCommandSuccess })
export class ChatInputCommandSuccessListener extends Listener<
	typeof Events.ChatInputCommandSuccess
> {
	public override run(payload: ChatInputCommandSuccessPayload) {
		logSuccessCommand(payload);
	}

	public override onLoad() {
		this.enabled = isDebugLogging();

		return super.onLoad();
	}
}
