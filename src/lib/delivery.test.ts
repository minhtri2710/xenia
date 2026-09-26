import { describe, expect, it } from "vitest";

import { checkDeliveryDate, deliveryRange, HORIZON_DAYS, isDeliveryMode, isDeliveryWindow, isIsoDate } from "./delivery";

// Every expected date is worked out by hand on the Asia/Ho_Chi_Minh (UTC+7) calendar.
// 2026-09-24T03:00Z is 24 September, 10:00 in Vietnam.
const NOW = new Date("2026-09-24T03:00:00Z");

describe("deliveryRange", () => {
  it("is today in Vietnam + lead days, to that + 30 days", () => {
    expect(HORIZON_DAYS).toBe(30);
    expect(deliveryRange(NOW, 1)).toEqual({ earliest: "2026-09-25", latest: "2026-10-25" });
    expect(deliveryRange(NOW, 3)).toEqual({ earliest: "2026-09-27", latest: "2026-10-27" });
  });

  it("moves by one day across local midnight: 16:59:59Z is still the 24th, 17:00:00Z is the 25th", () => {
    expect(deliveryRange(new Date("2026-09-24T16:59:59Z"), 1).earliest).toBe("2026-09-25");
    expect(deliveryRange(new Date("2026-09-24T17:00:00Z"), 1).earliest).toBe("2026-09-26");
    expect(checkDeliveryDate("2026-09-25", new Date("2026-09-24T16:59:59Z"), 1, [])).toBeNull();
    expect(checkDeliveryDate("2026-09-25", new Date("2026-09-24T17:00:00Z"), 1, [])).toBe("dateTooEarly");
  });

  it("crosses month, year and 29 February boundaries", () => {
    expect(deliveryRange(new Date("2026-01-31T03:00:00Z"), 1)).toEqual({ earliest: "2026-02-01", latest: "2026-03-03" });
    expect(deliveryRange(new Date("2026-12-31T03:00:00Z"), 1)).toEqual({ earliest: "2027-01-01", latest: "2027-01-31" });
    expect(deliveryRange(new Date("2028-02-28T03:00:00Z"), 1)).toEqual({ earliest: "2028-02-29", latest: "2028-03-30" });
    expect(deliveryRange(new Date("2027-02-28T03:00:00Z"), 1)).toEqual({ earliest: "2027-03-01", latest: "2027-03-31" });
  });

  it.each([0, -1, 1.5, Number.NaN])("rejects lead days %s", (lead) => {
    expect(() => deliveryRange(NOW, lead)).toThrow(RangeError);
  });
});

describe("checkDeliveryDate", () => {
  it("accepts the earliest and the latest date", () => {
    expect(checkDeliveryDate("2026-09-25", NOW, 1, [])).toBeNull();
    expect(checkDeliveryDate("2026-10-25", NOW, 1, [])).toBeNull();
  });

  it("refuses a date before the earliest (today, and ignoring lead days)", () => {
    expect(checkDeliveryDate("2026-09-24", NOW, 1, [])).toBe("dateTooEarly");
    expect(checkDeliveryDate("2026-09-26", NOW, 3, [])).toBe("dateTooEarly");
    expect(checkDeliveryDate("2026-09-27", NOW, 3, [])).toBeNull();
  });

  it("refuses earliest + 31", () => {
    expect(checkDeliveryDate("2026-10-26", NOW, 1, [])).toBe("dateTooLate");
  });

  it("refuses a blackout date that is otherwise inside the window", () => {
    expect(checkDeliveryDate("2026-10-01", NOW, 1, [])).toBeNull();
    expect(checkDeliveryDate("2026-10-01", NOW, 1, ["2026-10-01"])).toBe("dateBlackout");
    expect(checkDeliveryDate("2026-10-02", NOW, 1, ["2026-10-01"])).toBeNull();
  });

  it.each([
    ["", "dateRequired"],
    ["  ", "dateRequired"],
    ["2026-9-30", "dateInvalid"],
    ["2026-09-31", "dateInvalid"],
    ["2026-10-01T00:00", "dateInvalid"],
  ])("refuses %j as %s", (value, error) => {
    expect(checkDeliveryDate(value, NOW, 1, [])).toBe(error);
  });

  it("knows real dates, modes and windows", () => {
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2027-02-29")).toBe(false);
    expect(isIsoDate(20261001)).toBe(false);
    expect(["self", "gift", "pickup"].map(isDeliveryMode)).toEqual([true, true, false]);
    expect(["morning", "afternoon", "evening", "night", ""].map(isDeliveryWindow)).toEqual([true, true, true, false, false]);
  });
});
