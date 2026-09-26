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

export const POLICY_PATHS: Record<PolicySlug, `/${string}`> = {
  "thong-tin-doanh-nghiep": "/chinh-sach/thong-tin-doanh-nghiep",
  "bao-mat": "/chinh-sach/bao-mat",
  "dieu-khoan": "/chinh-sach/dieu-khoan",
  "khieu-nai": "/chinh-sach/khieu-nai",
  gia: "/chinh-sach/gia",
  "dieu-kien-ban-hang": "/chinh-sach/dieu-kien-ban-hang",
  "thanh-toan": "/chinh-sach/thanh-toan",
  "giao-hang": "/chinh-sach/giao-hang",
  "doi-tra-hoan-tien": "/chinh-sach/doi-tra-hoan-tien",
};

export const isPolicySlug = (value: string): value is PolicySlug => POLICY_SLUGS.includes(value as PolicySlug);
