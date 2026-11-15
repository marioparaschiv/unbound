import { ApplyOptions } from '@sapphire/decorators';
import type { Command } from '@sapphire/framework';

import { CaseListCommand } from '~/moderation/case-list-command';
import { listCases } from '~/moderation/cases';
import { getDatabase } from '~/db/instance';

@ApplyOptions<Command.Options>({
	name: 'modlogs',
	description: "Lists a user's moderation cases, newest first.",
	aliases: ['cases'],
	requiredUserPermissions: ['ModerateMembers'],
	preconditions: ['unbound'],
})
export class ModlogsCommand extends CaseListCommand {
	protected readonly noun = 'cases';

	protected list(userId: string) {
		return listCases(getDatabase(), userId);
	}
}
