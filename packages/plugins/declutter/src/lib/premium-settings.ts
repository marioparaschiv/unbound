/** The User Settings pages each payment option hides. */
export const PAYMENT_PAGES = {
	paymentShop: ['COLLECTIBLES_SHOP', 'COLLECTIBLES_SHOP_VIEW_ALL_CATEGORY_ITEMS'],
	paymentQuests: ['QUEST_HOME', 'QUEST_PREVIEW_TOOL'],
	paymentNitro: [
		'PREMIUM',
		'PREMIUM_MANAGE_PLAN',
		'PREMIUM_PLAN_SELECT',
		'PREMIUM_RESTORE_SUBSCRIPTION',
		'PREMIUM_PROFILE_CUSTOMIZATION_TRY_IT_OUT',
	],
	paymentSubscriptions: [
		'PREMIUM_MANAGE_SUBSCRIPTIONS',
		'GUILD_ROLE_SUBSCRIPTIONS',
		'GUILD_ROLE_SUBSCRIPTIONS_CANCEL',
	],
	paymentBoosts: ['PREMIUM_GUILD_BOOSTING'],
	paymentGifts: ['PREMIUM_GIFTING'],
} as const;

export type PaymentSetting = keyof typeof PAYMENT_PAGES;

/**
 * @description Whether a User Settings page belongs to a payment option that is on.
 * @param page The page's setting id, such as `PREMIUM`.
 * @param options Which payment options are on.
 * @returns Whether to hide the page.
 */
export function blockedSetting(page: unknown, options: Record<PaymentSetting, boolean>): boolean {
	if (typeof page !== 'string') return false;

	return (Object.keys(PAYMENT_PAGES) as PaymentSetting[]).some(
		(option) => options[option] && (PAYMENT_PAGES[option] as readonly string[]).includes(page),
	);
}

export default blockedSetting;
