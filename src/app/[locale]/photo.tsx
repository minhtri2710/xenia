import type { ReactNode } from "react";

import { findImage } from "@/lib/image-files";
import type { ImageName } from "@/lib/images";

/**
 * A photo from `public/images/` when the file exists, else `children` (the CSS placeholder).
 * Without `alt` the photo is decorative (`alt=""`): a heading or a name stands beside it.
 * A plain `<img>`: Next's image optimizer fetches the source without the visitor's age marker,
 * and the gate would answer it with a redirect.
 */
export function Photo({ name, alt = "", className = "", testId, children }: { name: ImageName; alt?: string; className?: string; testId?: string; children: ReactNode }) {
  const src = findImage(name);
  if (!src) return children;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- see above: the optimizer cannot pass the gate
    <img src={src} alt={alt} loading="lazy" decoding="async" className={`w-full object-cover ${className}`} data-testid={testId} />
  );
}
