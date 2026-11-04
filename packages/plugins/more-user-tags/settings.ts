import { defineSettings, setting } from '@unbound-app/settings/schema';

export default defineSettings(
	{
		tag: setting.section(
			{ title: 'TAGS' },
			{
				WEBHOOK: setting.boolean({
					default: true,
					title: 'TAG_WEBHOOK',
					subtitle: 'TAG_WEBHOOK_SUBTITLE',
				}),
				OWNER: setting.boolean({
					default: true,
					title: 'TAG_OWNER',
					subtitle: 'TAG_OWNER_SUBTITLE',
				}),
				ADMINISTRATOR: setting.boolean({
					default: true,
					title: 'TAG_ADMINISTRATOR',
					subtitle: 'TAG_ADMINISTRATOR_SUBTITLE',
				}),
				MODERATOR_STAFF: setting.boolean({
					default: true,
					title: 'TAG_MODERATOR_STAFF',
					subtitle: 'TAG_MODERATOR_STAFF_SUBTITLE',
				}),
				MODERATOR: setting.boolean({
					default: true,
					title: 'TAG_MODERATOR',
					subtitle: 'TAG_MODERATOR_SUBTITLE',
				}),
				VOICE_MODERATOR: setting.boolean({
					default: true,
					title: 'TAG_VOICE_MODERATOR',
					subtitle: 'TAG_VOICE_MODERATOR_SUBTITLE',
				}),
			},
		),
		coloredTags: setting.boolean({
			default: true,
			title: 'COLORED_TAGS',
			subtitle: 'COLORED_TAGS_SUBTITLE',
		}),
		useRoleColor: setting.boolean({
			default: true,
			title: 'USE_ROLE_COLOR',
			subtitle: 'USE_ROLE_COLOR_SUBTITLE',
		}),
		useEnhancedRoleColors: setting.boolean({
			default: true,
			title: 'USE_ENHANCED_ROLE_COLORS',
			subtitle: 'USE_ENHANCED_ROLE_COLORS_SUBTITLE',
		}),
		useOpTagStyle: setting.boolean({
			default: false,
			title: 'USE_OP_TAG_STYLE',
			subtitle: 'USE_OP_TAG_STYLE_SUBTITLE',
		}),
	},
	{ title: 'APPEARANCE' },
);
