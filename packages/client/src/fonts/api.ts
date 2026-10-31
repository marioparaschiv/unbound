import { fonts } from '~/fonts/manager';

/** Lists every installed font. */
export const getAll = fonts.getEntities.bind(fonts);
/** Reads one installed font by family name. */
export const get = fonts.getEntity.bind(fonts);
/** Installs a font from a URL, resolving the installed file name. */
export const install = fonts.install.bind(fonts);
/** Removes an installed font by the file name {@link install} resolved. */
export const uninstall = fonts.delete.bind(fonts);

/** @deprecated Use getAll */
export const getEntities = getAll;
/** @deprecated Use get */
export const getEntity = get;
/** @deprecated Use uninstall */
export { uninstall as delete };
