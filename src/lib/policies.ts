export const POLICY_SLUGS = [
  "thong-tin-doanh-nghiep",
  "bao-mat",
  "dieu-khoan",
  "khieu-nai",
  "gia",
  "dieu-kien-ban-hang",
  "thanh-toan",
  "giao-hang",
  "doi-tra-hoan-tien",
] as const;

export type PolicySlug = (typeof POLICY_SLUGS)[number];

export const policyPath = (slug: PolicySlug): `/chinh-sach/${PolicySlug}` => `/chinh-sach/${slug}`;

export const isPolicySlug = (value: string): value is PolicySlug => POLICY_SLUGS.includes(value as PolicySlug);
