/**
 * The fictional seed catalogue (decision F3). Every producer, wine name and tasting note is
 * invented for xenia; only the regions are real places. Nothing is copied from any shop.
 */
import type { BottleSize, CatalogueWine, Country, Occasion, PAIRINGS, WineType } from "@/lib/catalogue";

export type Localized = { vi: string; en: string };
type Status = "draft" | "published";

export type SeedProducer = { key: string; name: string; country: Country; region: string; story: Localized };

export type SeedVintage = {
  /** `null` is a non-vintage (NV) wine. */
  year: number | null;
  bottleMl: BottleSize;
  abvPct: number;
  priceVnd: number;
  stock: number;
  drinkFrom?: number;
  drinkTo?: number;
  status: Status;
};

export type SeedWine = {
  slug: string;
  producer: string;
  name: Localized;
  type: WineType;
  country: Country;
  region: string;
  appellation?: string;
  grapes: { grape: string; pct?: number }[];
  tasting: { nose: Localized; palate: Localized; finish: Localized };
  profile: { body: number; tannin: number; sweetness: number; acidity: number };
  pairings: (typeof PAIRINGS)[number][];
  servingTempC: number;
  occasions: Occasion[];
  /** Featured on the home page; a restricted wine stays off it whatever this says. */
  featured?: boolean;
  status: Status;
  vintages: SeedVintage[];
};

/** Fictional importer of record for every seeded vintage. */
export const IMPORTER = "Công ty TNHH Xenia Nhập khẩu (dữ liệu mẫu)";

export const SAMPLE_OWNER = {
  legalName: "Xenia Sample Trading Company (SAMPLE DATA)",
  headOffice: "Sample address, District 1, Ho Chi Minh City (SAMPLE DATA)",
  legalRepresentative: "Sample Representative (SAMPLE DATA)",
  businessRegistration: { number: "SAMPLE-BUSINESS-REGISTRATION", date: "2026-01-15", place: "Sample issuing authority (SAMPLE DATA)" },
  alcoholLicence: { number: "SAMPLE-ALCOHOL-LICENCE", issuer: "Sample licensing authority (SAMPLE DATA)", date: "2026-02-15" },
  contactEmail: "contact@example.test",
  contactPhone: "+84 000 000 0000 (SAMPLE DATA)",
  notificationLink: "",
} as const;

/** Placeholder flat delivery fees per zone (whole VND, VAT included) for the `site-settings` global. */
export const ZONE_FEES = [
  { zone: "hcmc", feeVnd: 30_000, leadDays: 1 },
  { zone: "hanoi", feeVnd: 45_000, leadDays: 1 },
] as const;

/** Placeholder packaging (F7): the Human sets real names and prices. Every price is at least 1 VND. */
export const PACKAGING = [
  {
    code: "silk",
    name: { vi: "Giấy lụa và ruy băng", en: "Tissue and silk ribbon" },
    description: { vi: "Giấy lụa mỏng, ruy băng lụa và tem sáp. Mỗi gói một chai.", en: "Fine tissue, a silk ribbon and a wax seal sticker. One bottle each." },
    capacity: 1,
    fits: [375, 750, 1500],
    priceVnd: 50_000,
  },
  {
    code: "box-1",
    name: { vi: "Hộp cứng", en: "Rigid box" },
    description: { vi: "Hộp cứng nắp nam châm, giấy lót và khay giữ chai. Một chai 750 ml.", en: "Rigid box with a magnetic lid, fine paper and a fitted insert. One 750 ml bottle." },
    capacity: 1,
    fits: [750],
    priceVnd: 120_000,
  },
  {
    code: "box-2",
    name: { vi: "Hộp cứng đôi", en: "Two-bottle box" },
    description: { vi: "Hộp cứng cho hai chai 750 ml, nắp nam châm và khay giữ chai.", en: "Rigid box for two 750 ml bottles, with a magnetic lid and a fitted insert." },
    capacity: 2,
    fits: [750],
    priceVnd: 200_000,
  },
] as const;

export const CARD_DESIGNS = [
  { code: "chuc-mung", name: { vi: "Chúc mừng", en: "Congratulations" } },
  { code: "cam-on", name: { vi: "Cảm ơn", en: "Thank you" } },
  { code: "tet", name: { vi: "Tết", en: "Tết" } },
  { code: "plain", name: { vi: "Trơn", en: "Plain" } },
] as const;

export const producers: SeedProducer[] = [
  {
    key: "lune-grise",
    name: "Domaine de la Lune Grise",
    country: "FR",
    region: "Bordeaux",
    story: {
      vi: "Một điền trang nhỏ bên bờ sông Dordogne, do ba thế hệ trong gia đình chăm sóc từng hàng nho bằng tay.",
      en: "A small estate on the banks of the Dordogne, where three generations of one family tend every row by hand.",
    },
  },
  {
    key: "clos-des-sept-pierres",
    name: "Clos des Sept Pierres",
    country: "FR",
    region: "Burgundy",
    story: {
      vi: "Bảy bức tường đá khô bao quanh vườn nho, giữ ấm cho đất vào những đêm đầu xuân.",
      en: "Seven dry-stone walls enclose the vineyard and keep the soil warm through early-spring nights.",
    },
  },
  {
    key: "maison-aubeline",
    name: "Maison Aubeline",
    country: "FR",
    region: "Champagne",
    story: {
      vi: "Một nhà làm vang sủi nhỏ ủ rượu trong hầm phấn đào tay từ thế kỷ trước.",
      en: "A small sparkling house that ages its wine in chalk cellars dug by hand a century ago.",
    },
  },
  {
    key: "tenuta-colle-vento",
    name: "Tenuta Colle del Vento",
    country: "IT",
    region: "Tuscany",
    story: {
      vi: "Trên một ngọn đồi lộng gió, nơi gió biển thổi khô sương sớm trên chùm nho.",
      en: "On a windswept hill where the sea breeze dries the morning dew off the bunches.",
    },
  },
  {
    key: "cantina-due-fiumi",
    name: "Cantina Due Fiumi",
    country: "IT",
    region: "Piedmont",
    story: {
      vi: "Hầm rượu nằm giữa hai con sông, chuyên làm vang đỏ để lâu và vang ngọt nhẹ.",
      en: "A cellar between two rivers, making long-lived reds and gently sweet wines.",
    },
  },
  {
    key: "bodega-sol-alto",
    name: "Bodega Sol Alto",
    country: "ES",
    region: "Rioja",
    story: {
      vi: "Vườn nho trên cao nguyên, ngày nắng gắt, đêm lạnh sâu, cho trái nho giữ được độ tươi.",
      en: "High-plateau vineyards with fierce days and cold nights that keep the fruit fresh.",
    },
  },
  {
    key: "quinta-do-rio-velho",
    name: "Quinta do Rio Velho",
    country: "PT",
    region: "Douro",
    story: {
      vi: "Những bậc thang đá dốc đứng bên sông Douro, nơi rượu vang cường hoá được ủ nhiều năm trong thùng gỗ cũ.",
      en: "Steep stone terraces above the Douro, where fortified wine rests for years in old casks.",
    },
  },
  {
    key: "weingut-steinbach",
    name: "Weingut Steinbach",
    country: "DE",
    region: "Mosel",
    story: {
      vi: "Sườn đá phiến dốc hướng về dòng sông, chuyên về Riesling thanh mảnh.",
      en: "Steep slate slopes facing the river, devoted to finely drawn Riesling.",
    },
  },
  {
    key: "hollow-creek",
    name: "Hollow Creek Vineyards",
    country: "US",
    region: "Napa Valley",
    story: {
      vi: "Một trang trại cũ được chuyển thành vườn nho, canh tác hữu cơ từ ngày đầu.",
      en: "A former ranch turned vineyard, farmed organically from the first day.",
    },
  },
  {
    key: "vina-cordillera-azul",
    name: "Viña Cordillera Azul",
    country: "CL",
    region: "Maipo Valley",
    story: {
      vi: "Tưới bằng nước tuyết tan từ dãy Andes, vườn nho nằm dưới chân núi.",
      en: "Watered by Andean snowmelt, the vineyard sits at the foot of the mountains.",
    },
  },
  {
    key: "red-gum-ridge",
    name: "Red Gum Ridge",
    country: "AU",
    region: "Barossa Valley",
    story: {
      vi: "Những gốc nho già trồng giữa hàng cây bạch đàn đỏ, cho rượu đậm và ấm.",
      en: "Old vines planted among red gums, giving deep and warm wines.",
    },
  },
  {
    key: "southern-light",
    name: "Southern Light Estate",
    country: "NZ",
    region: "Marlborough",
    story: {
      vi: "Nắng dài và gió biển lạnh tạo nên những chai vang trắng tươi sáng.",
      en: "Long sunshine and a cold sea wind make bright, fresh whites.",
    },
  },
];

const L = (vi: string, en: string): Localized => ({ vi, en });

const v = (
  year: number | null,
  bottleMl: BottleSize,
  abvPct: number,
  priceVnd: number,
  stock: number,
  extra: Partial<Pick<SeedVintage, "drinkFrom" | "drinkTo" | "status">> = {},
): SeedVintage => ({ year, bottleMl, abvPct, priceVnd, stock, status: "published", ...extra });

export const wines: SeedWine[] = [
  {
    slug: "lune-grise-rouge",
    producer: "lune-grise",
    name: L("Lune Grise Đỏ", "Lune Grise Rouge"),
    type: "red",
    country: "FR",
    region: "Bordeaux",
    appellation: "Bordeaux Supérieur",
    grapes: [
      { grape: "Merlot", pct: 70 },
      { grape: "Cabernet Sauvignon", pct: 30 },
    ],
    tasting: {
      nose: L("Mận chín, lá thuốc lá khô và chút vani.", "Ripe plum, dried tobacco leaf and a touch of vanilla."),
      palate: L("Mềm mại, tannin tròn, quả đỏ đậm đà.", "Supple, with rounded tannin and generous red fruit."),
      finish: L("Dư vị vừa phải, thoảng gỗ tuyết tùng.", "Medium length with a hint of cedar."),
    },
    profile: { body: 4, tannin: 3, sweetness: 1, acidity: 3 },
    pairings: ["beef", "bo-luc-lac", "cheese"],
    servingTempC: 17,
    occasions: ["dinner", "gift"],
    featured: true,
    status: "published",
    vintages: [
      v(2019, 750, 13.5, 890_000, 24, { drinkFrom: 2022, drinkTo: 2030 }),
      v(2020, 750, 14, 850_000, 36, { drinkFrom: 2023, drinkTo: 2031 }),
      v(2019, 1500, 13.5, 1_950_000, 4, { drinkFrom: 2023, drinkTo: 2034 }),
    ],
  },
  {
    slug: "coteau-des-pierres",
    producer: "clos-des-sept-pierres",
    name: L("Côteau des Pierres", "Côteau des Pierres"),
    type: "red",
    country: "FR",
    region: "Burgundy",
    appellation: "Bourgogne Hautes-Côtes",
    grapes: [{ grape: "Pinot Noir", pct: 100 }],
    tasting: {
      nose: L("Anh đào tươi, hoa hồng khô và đất ẩm sau mưa.", "Fresh cherry, dried rose and damp earth after rain."),
      palate: L("Nhẹ nhàng, thanh lịch, độ chua tươi.", "Light, elegant and freshly acidic."),
      finish: L("Dư vị dài, thoảng gia vị.", "Long, with a gentle spice."),
    },
    profile: { body: 2, tannin: 2, sweetness: 1, acidity: 4 },
    pairings: ["poultry", "vit-quay", "fish"],
    servingTempC: 15,
    occasions: ["dinner", "celebration"],
    status: "published",
    vintages: [
      v(2020, 750, 13, 1_650_000, 12, { drinkFrom: 2023, drinkTo: 2029 }),
      v(2021, 750, 12.5, 1_550_000, 18, { drinkFrom: 2024, drinkTo: 2030 }),
    ],
  },
  {
    slug: "sept-pierres-blanc",
    producer: "clos-des-sept-pierres",
    name: L("Sept Pierres Trắng", "Sept Pierres Blanc"),
    type: "white",
    country: "FR",
    region: "Burgundy",
    grapes: [{ grape: "Chardonnay", pct: 100 }],
    tasting: {
      nose: L("Táo xanh, hoa chanh và bánh mì nướng nhẹ.", "Green apple, lemon blossom and light toast."),
      palate: L("Tròn đầy, kem mịn, độ chua cân bằng.", "Round and creamy with balanced acidity."),
      finish: L("Dư vị khoáng, sạch.", "A clean, mineral finish."),
    },
    profile: { body: 3, tannin: 1, sweetness: 1, acidity: 3 },
    pairings: ["seafood", "fish", "goi-cuon"],
    servingTempC: 11,
    occasions: ["dinner", "gift"],
    status: "published",
    vintages: [v(2022, 750, 13, 1_250_000, 20, { drinkFrom: 2024, drinkTo: 2028 })],
  },
  {
    slug: "aubeline-brut",
    producer: "maison-aubeline",
    name: L("Aubeline Brut", "Aubeline Brut"),
    type: "sparkling",
    country: "FR",
    region: "Champagne",
    grapes: [
      { grape: "Chardonnay", pct: 50 },
      { grape: "Pinot Noir", pct: 50 },
    ],
    tasting: {
      nose: L("Bánh brioche, lê chín và hạnh nhân.", "Brioche, ripe pear and almond."),
      palate: L("Bọt mịn, tươi mát, vị khô.", "Fine mousse, fresh and dry."),
      finish: L("Dư vị sảng khoái, thoảng vỏ chanh.", "A refreshing finish with lemon zest."),
    },
    profile: { body: 2, tannin: 1, sweetness: 1, acidity: 4 },
    pairings: ["seafood", "cha-gio", "cheese"],
    servingTempC: 8,
    occasions: ["celebration", "tet", "gift"],
    featured: true,
    status: "published",
    vintages: [
      v(null, 750, 12, 2_450_000, 30),
      v(null, 375, 12, 1_350_000, 16),
      v(null, 1500, 12, 5_200_000, 3),
    ],
  },
  {
    slug: "colle-vento-rosso",
    producer: "tenuta-colle-vento",
    name: L("Colle del Vento Rosso", "Colle del Vento Rosso"),
    type: "red",
    country: "IT",
    region: "Tuscany",
    grapes: [{ grape: "Sangiovese", pct: 90 }, { grape: "Merlot", pct: 10 }],
    tasting: {
      nose: L("Anh đào chua, thảo mộc khô và da thuộc.", "Sour cherry, dried herbs and leather."),
      palate: L("Độ chua sống động, tannin chắc.", "Lively acidity and firm tannin."),
      finish: L("Dư vị hơi đắng dễ chịu như vỏ cam.", "A pleasantly bitter, orange-peel finish."),
    },
    profile: { body: 3, tannin: 4, sweetness: 1, acidity: 4 },
    pairings: ["pork", "bun-cha", "cheese"],
    servingTempC: 16,
    occasions: ["dinner", "everyday"],
    status: "published",
    vintages: [v(2021, 750, 13.5, 720_000, 40, { drinkFrom: 2023, drinkTo: 2029 })],
  },
  {
    slug: "due-fiumi-nebbiolo",
    producer: "cantina-due-fiumi",
    name: L("Due Fiumi Nebbiolo", "Due Fiumi Nebbiolo"),
    type: "red",
    country: "IT",
    region: "Piedmont",
    grapes: [{ grape: "Nebbiolo", pct: 100 }],
    tasting: {
      nose: L("Hoa hồng, hắc ín và quả mâm xôi.", "Rose, tar and raspberry."),
      palate: L("Tannin mạnh mẽ, cấu trúc cao.", "Powerful tannin and a tall structure."),
      finish: L("Rất dài, cần thời gian để mở.", "Very long; it needs time to open."),
    },
    profile: { body: 4, tannin: 5, sweetness: 1, acidity: 4 },
    pairings: ["beef", "cheese"],
    servingTempC: 18,
    occasions: ["gift", "celebration"],
    status: "published",
    vintages: [v(2018, 750, 14.5, 4_600_000, 6, { drinkFrom: 2025, drinkTo: 2040 })],
  },
  {
    slug: "due-fiumi-moscato",
    producer: "cantina-due-fiumi",
    name: L("Due Fiumi Moscato", "Due Fiumi Moscato"),
    type: "sweet",
    country: "IT",
    region: "Piedmont",
    grapes: [{ grape: "Moscato", pct: 100 }],
    tasting: {
      nose: L("Đào trắng, hoa cam và mật ong.", "White peach, orange blossom and honey."),
      palate: L("Ngọt nhẹ, sủi lăn tăn, độ cồn thấp.", "Gently sweet, lightly fizzy and low in alcohol."),
      finish: L("Dư vị tươi và ngắn.", "A fresh, short finish."),
    },
    profile: { body: 1, tannin: 1, sweetness: 4, acidity: 3 },
    pairings: ["dessert", "spicy"],
    servingTempC: 7,
    occasions: ["tet", "everyday"],
    status: "published",
    vintages: [v(2023, 750, 5.5, 480_000, 50)],
  },
  {
    slug: "sol-alto-crianza",
    producer: "bodega-sol-alto",
    name: L("Sol Alto Crianza", "Sol Alto Crianza"),
    type: "red",
    country: "ES",
    region: "Rioja",
    grapes: [{ grape: "Tempranillo", pct: 85 }, { grape: "Garnacha", pct: 15 }],
    tasting: {
      nose: L("Dâu tây chín, dừa nướng và thì là.", "Ripe strawberry, toasted coconut and dill."),
      palate: L("Mượt, ấm, quả đỏ và gia vị ngọt.", "Smooth and warm, with red fruit and sweet spice."),
      finish: L("Dư vị trung bình, êm.", "A medium, gentle finish."),
    },
    profile: { body: 3, tannin: 3, sweetness: 1, acidity: 3 },
    pairings: ["pork", "bun-cha", "beef"],
    servingTempC: 16,
    occasions: ["everyday", "dinner"],
    status: "published",
    vintages: [
      v(2020, 750, 14, 650_000, 48, { drinkFrom: 2022, drinkTo: 2028 }),
      v(2020, 375, 14, 360_000, 0, { drinkFrom: 2022, drinkTo: 2026 }),
    ],
  },
  {
    slug: "sol-alto-rosado",
    producer: "bodega-sol-alto",
    name: L("Sol Alto Hồng", "Sol Alto Rosado"),
    type: "rose",
    country: "ES",
    region: "Rioja",
    grapes: [{ grape: "Garnacha", pct: 100 }],
    tasting: {
      nose: L("Dâu rừng, dưa hấu và hoa trắng.", "Wild strawberry, watermelon and white flowers."),
      palate: L("Khô, giòn và tươi mát.", "Dry, crisp and refreshing."),
      finish: L("Dư vị ngắn, sạch.", "A short, clean finish."),
    },
    profile: { body: 2, tannin: 1, sweetness: 1, acidity: 4 },
    pairings: ["seafood", "goi-cuon", "spicy"],
    servingTempC: 9,
    occasions: ["everyday"],
    status: "published",
    vintages: [v(2023, 750, 12.5, 540_000, 0)],
  },
  {
    slug: "rio-velho-tawny-10",
    producer: "quinta-do-rio-velho",
    name: L("Rio Velho Tawny 10 năm", "Rio Velho 10-Year Tawny"),
    type: "sweet",
    country: "PT",
    region: "Douro",
    appellation: "Porto",
    grapes: [
      { grape: "Touriga Nacional", pct: 60 },
      { grape: "Touriga Franca", pct: 40 },
    ],
    tasting: {
      nose: L("Hạt óc chó, caramel và vỏ cam khô.", "Walnut, caramel and dried orange peel."),
      palate: L("Ngọt, ấm, rượu cường hoá đậm vị hạt.", "Sweet and warm, a fortified wine full of nutty flavour."),
      finish: L("Dư vị rất dài, thoảng cà phê.", "A very long finish with a hint of coffee."),
    },
    profile: { body: 4, tannin: 2, sweetness: 5, acidity: 3 },
    pairings: ["dessert", "cheese"],
    servingTempC: 14,
    occasions: ["gift", "tet"],
    featured: true,
    status: "published",
    vintages: [
      v(null, 750, 20, 1_890_000, 10),
      v(null, 375, 20, 1_050_000, 8),
    ],
  },
  {
    slug: "steinbach-riesling-kabinett",
    producer: "weingut-steinbach",
    name: L("Steinbach Riesling Kabinett", "Steinbach Riesling Kabinett"),
    type: "white",
    country: "DE",
    region: "Mosel",
    grapes: [{ grape: "Riesling", pct: 100 }],
    tasting: {
      nose: L("Chanh xanh, táo xanh và đá ướt.", "Lime, green apple and wet stone."),
      palate: L("Hơi ngọt, độ chua cao, rất nhẹ.", "Off-dry with high acidity, very light."),
      finish: L("Dư vị khoáng, kéo dài.", "A lingering mineral finish."),
    },
    profile: { body: 1, tannin: 1, sweetness: 3, acidity: 5 },
    pairings: ["spicy", "vit-quay", "seafood"],
    servingTempC: 9,
    occasions: ["everyday", "dinner"],
    status: "published",
    vintages: [v(2022, 750, 8.5, 780_000, 22, { drinkFrom: 2023, drinkTo: 2032 })],
  },
  {
    slug: "hollow-creek-cabernet",
    producer: "hollow-creek",
    name: L("Hollow Creek Cabernet", "Hollow Creek Cabernet"),
    type: "red",
    country: "US",
    region: "Napa Valley",
    grapes: [{ grape: "Cabernet Sauvignon", pct: 100 }],
    tasting: {
      nose: L("Lý chua đen, sô-cô-la đen và bạc hà.", "Blackcurrant, dark chocolate and mint."),
      palate: L("Đậm đặc, tannin mịn, quả chín.", "Dense and ripe with polished tannin."),
      finish: L("Dư vị dài, ấm áp.", "A long, warm finish."),
    },
    profile: { body: 5, tannin: 4, sweetness: 1, acidity: 3 },
    pairings: ["beef", "bo-luc-lac"],
    servingTempC: 18,
    occasions: ["gift", "celebration"],
    status: "published",
    vintages: [
      v(2019, 750, 14.5, 3_200_000, 9, { drinkFrom: 2023, drinkTo: 2035 }),
      v(2021, 750, 14.5, 2_950_000, 14, { drinkFrom: 2025, drinkTo: 2037 }),
      v(2022, 750, 14.5, 2_900_000, 0, { status: "draft" }),
    ],
  },
  {
    slug: "cordillera-carmenere",
    producer: "vina-cordillera-azul",
    name: L("Cordillera Azul Carmenère", "Cordillera Azul Carmenère"),
    type: "red",
    country: "CL",
    region: "Maipo Valley",
    grapes: [{ grape: "Carmenère", pct: 100 }],
    tasting: {
      nose: L("Ớt chuông đỏ, mận và tiêu đen.", "Red pepper, plum and black pepper."),
      palate: L("Mềm, quả đậm, dễ uống.", "Soft, fruity and easy to drink."),
      finish: L("Dư vị ngắn, cay nhẹ.", "A short, lightly peppery finish."),
    },
    profile: { body: 3, tannin: 3, sweetness: 1, acidity: 3 },
    pairings: ["pork", "bun-cha", "pho"],
    servingTempC: 16,
    occasions: ["everyday"],
    status: "published",
    vintages: [v(2022, 750, 13.5, 450_000, 60)],
  },
  {
    slug: "red-gum-shiraz",
    producer: "red-gum-ridge",
    name: L("Red Gum Shiraz", "Red Gum Shiraz"),
    type: "red",
    country: "AU",
    region: "Barossa Valley",
    grapes: [{ grape: "Shiraz", pct: 100 }],
    tasting: {
      nose: L("Mâm xôi đen, tiêu và khói gỗ.", "Blackberry, pepper and wood smoke."),
      palate: L("Rất đậm, mượt, cồn ấm.", "Very full, smooth and warming."),
      finish: L("Dư vị dài, ngọt quả.", "A long, sweet-fruited finish."),
    },
    profile: { body: 5, tannin: 4, sweetness: 2, acidity: 2 },
    pairings: ["beef", "bo-luc-lac", "spicy"],
    servingTempC: 18,
    occasions: ["dinner", "tet"],
    status: "published",
    vintages: [v(2021, 750, 14.5, 1_150_000, 18, { drinkFrom: 2023, drinkTo: 2033 })],
  },
  {
    slug: "southern-light-sauvignon",
    producer: "southern-light",
    name: L("Southern Light Sauvignon Blanc", "Southern Light Sauvignon Blanc"),
    type: "white",
    country: "NZ",
    region: "Marlborough",
    grapes: [{ grape: "Sauvignon Blanc", pct: 100 }],
    tasting: {
      nose: L("Chanh dây, cỏ mới cắt và bưởi.", "Passion fruit, cut grass and grapefruit."),
      palate: L("Giòn, tươi, rất sảng khoái.", "Crisp, zesty and very refreshing."),
      finish: L("Dư vị chua thanh.", "A bright, tangy finish."),
    },
    profile: { body: 2, tannin: 1, sweetness: 1, acidity: 5 },
    pairings: ["seafood", "goi-cuon", "fish"],
    servingTempC: 8,
    occasions: ["everyday", "dinner"],
    status: "published",
    vintages: [v(2023, 750, 12.5, 690_000, 44)],
  },
  {
    slug: "southern-light-rose",
    producer: "southern-light",
    name: L("Southern Light Hồng", "Southern Light Rosé"),
    type: "rose",
    country: "NZ",
    region: "Marlborough",
    grapes: [{ grape: "Pinot Noir", pct: 100 }],
    tasting: {
      nose: L("Dâu tây, lựu và hoa hồng.", "Strawberry, pomegranate and rose."),
      palate: L("Khô, nhẹ, quả đỏ tinh tế.", "Dry and light with delicate red fruit."),
      finish: L("Dư vị gọn, tươi.", "A neat, fresh finish."),
    },
    profile: { body: 2, tannin: 1, sweetness: 2, acidity: 4 },
    pairings: ["seafood", "cha-gio"],
    servingTempC: 9,
    occasions: ["celebration", "everyday"],
    featured: true,
    status: "published",
    vintages: [v(2023, 750, 12.5, 820_000, 15)],
  },
  {
    // Published, but its only vintage is a draft: not listed, and its page is not found.
    slug: "steinbach-riesling-spatlese",
    producer: "weingut-steinbach",
    name: L("Steinbach Riesling Spätlese", "Steinbach Riesling Spätlese"),
    type: "white",
    country: "DE",
    region: "Mosel",
    grapes: [{ grape: "Riesling", pct: 100 }],
    tasting: {
      nose: L("Mơ chín, hoa cam và mật ong.", "Ripe apricot, orange blossom and honey."),
      palate: L("Ngọt vừa, độ chua cao, rất thanh.", "Medium-sweet with high acidity, very pure."),
      finish: L("Dư vị dài, khoáng.", "A long, mineral finish."),
    },
    profile: { body: 2, tannin: 1, sweetness: 4, acidity: 5 },
    pairings: ["spicy", "dessert"],
    servingTempC: 9,
    occasions: ["dinner"],
    status: "published",
    vintages: [v(2023, 750, 8, 1_100_000, 0, { status: "draft" })],
  },
  {
    slug: "lune-grise-reserve",
    producer: "lune-grise",
    name: L("Lune Grise Réserve (chưa phát hành)", "Lune Grise Réserve (unreleased)"),
    type: "red",
    country: "FR",
    region: "Bordeaux",
    grapes: [{ grape: "Cabernet Sauvignon", pct: 100 }],
    tasting: {
      nose: L("Chưa đánh giá.", "Not yet assessed."),
      palate: L("Chưa đánh giá.", "Not yet assessed."),
      finish: L("Chưa đánh giá.", "Not yet assessed."),
    },
    profile: { body: 4, tannin: 4, sweetness: 1, acidity: 3 },
    pairings: ["beef"],
    servingTempC: 17,
    occasions: ["gift"],
    status: "draft",
    vintages: [v(2022, 750, 14, 3_900_000, 0)],
  },
];

/** The seed as the collection page sees it: published wines with their published vintages. */
export function seedCatalogue(locale: keyof Localized): CatalogueWine[] {
  return wines.flatMap((w) => {
    const vintages = w.vintages.filter((x) => x.status === "published");
    if (w.status !== "published" || vintages.length === 0) return [];
    return [
      {
        slug: w.slug,
        name: w.name[locale],
        producer: producers.find((p) => p.key === w.producer)!.name,
        type: w.type,
        country: w.country,
        region: w.region,
        grapes: w.grapes.map((g) => g.grape),
        occasions: w.occasions,
        featured: w.featured ?? false,
        vintages: vintages.map(({ priceVnd, bottleMl, stock, abvPct }) => ({ priceVnd, bottleMl, stock, abvPct })),
      },
    ];
  });
}
