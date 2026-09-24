import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  devIndicators: false,
  // AGENTS.md is the repo's governing contract; `next dev` must not append its own block.
  agentRules: false,
};

export default withPayload(withNextIntl(nextConfig));
