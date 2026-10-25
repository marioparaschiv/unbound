import type { ChatInputCommandSuccessPayload } from '@sapphire/framework';
import { Events, Listener, LogLevel } from '@sapphire/framework';
import type { Logger } from '@sapphire/plugin-logger';
import { ApplyOptions } from '@sapphire/decorators';

import { logSuccessCommand } from '~/lib/log-command';

@ApplyOptions<Listener.Options>({ event: Events.ChatInputCommandSuccess })
export class ChatInputCommandSuccessListener extends Listener<
	typeof Events.ChatInputCommandSuccess
> {
	public override run(payload: ChatInputCommandSuccessPayload) {
		logSuccessCommand(payload);
	}

	public override onLoad() {
		this.enabled = (this.container.logger as Logger).level <= LogLevel.Debug;

		return super.onLoad();
	}
}
