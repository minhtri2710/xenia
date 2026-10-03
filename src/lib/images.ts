/**
 * Photos are static files under `public/images/`, found by name: `wines/<slug>` for a wine and
 * `site/<slot>` for the site's own photos (`SITE_IMAGES`), in any of `IMAGE_EXTENSIONS`. A missing
 * photo leaves the CSS placeholder in its place. The files sit behind the age gate like every
 * storefront path; `src/proxy.ts` serves them to a verified visitor without locale routing.
 */
export const IMAGES_PATH = "/images/";

export const IMAGE_EXTENSIONS = ["avif", "webp", "jpg", "jpeg", "png"] as const;

/** The site photo slots, each `public/images/site/<slot>.<extension>`. */
export const SITE_IMAGES = [
  "home-hero",
  "occasion-gift",
  "occasion-tet",
  "occasion-celebration",
  "gift-service",
  "personalise",
  "brio-region",
  "brio-ferment",
  "brio-bottle",
] as const;
export type SiteImage = (typeof SITE_IMAGES)[number];

/** `wines/<slug>` or `site/<slot>`. */
export type ImageName = `wines/${string}` | `site/${SiteImage}`;

const SAFE_NAME = /^(?:wines\/[a-z0-9]+(?:-[a-z0-9]+)*|site\/[a-z-]+)$/;

/**
 * The public URL of the first existing file for `name`, trying each extension in order, or null.
 * `exists` receives the path relative to `public/`. A name with anything but lowercase letters,
 * digits and single hyphens after its folder never reaches the file system.
 */
export function imageUrl(name: string, exists: (relative: string) => boolean): string | null {
  if (!SAFE_NAME.test(name)) return null;
  for (const extension of IMAGE_EXTENSIONS) {
    const relative = `images/${name}.${extension}`;
    if (exists(relative)) return `/${relative}`;
  }
  return null;
}

/** Whether a request path (locale prefix stripped) is a photo file the proxy serves directly. */
export function isImagePath(path: string): boolean {
  return path.startsWith(IMAGES_PATH) && IMAGE_EXTENSIONS.some((e) => path.toLowerCase().endsWith(`.${e}`)) && !path.includes("..");
}
