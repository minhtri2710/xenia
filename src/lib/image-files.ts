import { existsSync } from "node:fs";
import path from "node:path";

import { type ImageName, imageUrl } from "@/lib/images";

const PUBLIC_DIR = path.join(process.cwd(), "public");

/** The URL of `name`'s photo in `public/`, checked on every render so a new file shows at once. */
export function findImage(name: ImageName): string | null {
  return imageUrl(name, (relative) => existsSync(path.join(PUBLIC_DIR, relative)));
}
