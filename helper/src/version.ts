import pkg from "../package.json" with { type: "json" };

/** From package.json; bump it there for each release (and HELPER_LATEST in the site's lib/helper.ts). */
export const VERSION: string = pkg.version;
export const PORT = 47533;
