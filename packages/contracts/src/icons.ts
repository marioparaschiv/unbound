import { z } from './zod';

/** An icon the website shows for an addon: a Nucleo Micro Bold export name, such as `IconPlug`. */
export const addonIconSchema = z.string().check(z.regex(/^Icon[A-Z][A-Za-z\d]*$/), z.maxLength(64));

export type AddonIcon = z.infer<typeof addonIconSchema>;

export default { addonIconSchema };
