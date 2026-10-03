import config from "@payload-config";
import { getPayload } from "payload";

import { type Quote, QUOTE_SLUG } from "@/lib/quote";

/** Stores a validated quote request with the instant its sender accepted the privacy policy. */
export async function saveQuote(quote: Quote, acceptedAt: Date): Promise<void> {
  const payload = await getPayload({ config });
  await payload.create({
    collection: QUOTE_SLUG,
    data: { ...quote, budget: quote.budget ?? undefined, privacyAcceptedAt: acceptedAt.toISOString(), status: "new" },
  });
}
