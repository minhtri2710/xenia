import type { ReactNode } from "react";

/**
 * The page layout pieces of the wine & champagne design: full-width bands, a centred container,
 * the page hero (eyebrow, title, lead), section headings and raised panels. They hold no copy:
 * every string comes from the caller's messages.
 */

type Width = "wide" | "narrow" | "text";

// Each width adds the side padding (2 × 3rem) so the content edge lines up with the header and footer.
const WIDTHS: Record<Width, string> = { wide: "max-w-[86rem]", narrow: "max-w-[70rem]", text: "max-w-[54rem]" };

export function Container({ width = "wide", className = "", children }: { width?: Width; className?: string; children: ReactNode }) {
  return <div className={`mx-auto w-full px-6 sm:px-12 ${WIDTHS[width]} ${className}`}>{children}</div>;
}

type Tone = "paper" | "wine" | "deep" | "olive" | "plain";

const BANDS: Record<Tone, string> = {
  paper: "bg-paper",
  wine: "dark bg-wine text-ivory",
  deep: "dark bg-wine-deep text-ivory",
  olive: "dark band-olive bg-olive text-ivory",
  plain: "",
};

/** A full-width band; `framed` draws the gold hairline frame inside it. A page that ends with one meets the footer without a gap. */
export function Band({
  tone = "plain",
  framed = false,
  className = "",
  labelledBy,
  children,
}: {
  tone?: Tone;
  framed?: boolean;
  className?: string;
  labelledBy?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={labelledBy} data-band className={`${BANDS[tone]} ${framed ? "framed" : ""} ${className}`}>
      {framed ? <div className="frame">{children}</div> : children}
    </section>
  );
}

/** The top of a page: eyebrow, the one `h1`, an optional lead and whatever the page adds below. */
export function PageHero({
  eyebrow,
  title,
  lead,
  tone = "paper",
  width = "wide",
  center = false,
  testId,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  tone?: Tone;
  width?: Width;
  center?: boolean;
  testId?: string;
  children?: ReactNode;
}) {
  const framed = tone === "wine" || tone === "deep" || tone === "olive";
  const titleColor = framed ? (tone === "olive" ? "text-ivory" : "text-champagne") : "";
  return (
    <Band tone={tone} framed={framed} className={framed ? "" : "border-b border-line"}>
      <Container width={width} className={`${framed ? "py-16 sm:py-24" : "py-10 sm:py-14"} ${center ? "flex flex-col items-center text-center" : ""}`}>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className={`mt-3 font-display text-4xl leading-tight font-semibold sm:text-5xl ${titleColor}`} data-testid={testId}>
          {title}
        </h1>
        {lead && <div className={`mt-4 max-w-2xl text-lg ${framed ? "text-ivory" : "text-muted"}`}>{lead}</div>}
        {children}
      </Container>
    </Band>
  );
}

/** A section heading with an optional eyebrow; `as` keeps the outline right inside panels. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  as: Tag = "h2",
  size = "lg",
  className = "",
}: {
  id?: string;
  eyebrow?: ReactNode;
  title: ReactNode;
  as?: "h2" | "h3";
  size?: "lg" | "md";
  className?: string;
}) {
  return (
    <div className={className}>
      {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
      <Tag id={id} className={`font-display font-semibold ${size === "lg" ? "text-3xl" : "text-2xl"}`}>
        {title}
      </Tag>
    </div>
  );
}

/** A raised paper panel for a form, a summary or a group of facts. */
export function Panel({ className = "", labelledBy, children, testId }: { className?: string; labelledBy?: string; children: ReactNode; testId?: string }) {
  return (
    <section aria-labelledby={labelledBy} className={`card p-6 sm:p-8 ${className}`} data-testid={testId}>
      {children}
    </section>
  );
}
