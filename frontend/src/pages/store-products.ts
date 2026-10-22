export type StoreCategory = "pistols" | "automatic";

export type StoreVariant = {
  id: string;
  labelKey: string;
  modelName?: string;
  images: string[];
  specifications: StoreSpecification[];
};

export type StoreSpecification = {
  labelKey: string;
  value: string;
  valueKey?: string;
};

export type StoreProduct = {
  id: string;
  name: string;
  brand: string;
  category: StoreCategory;
  image: string;
  width: number;
  height: number;
  variants: StoreVariant[];
  specifications: StoreSpecification[];
};

const imagePath = (name: string) => `/store/demo/${name}.png`;

const arSpecifications: StoreSpecification[] = [
  { labelKey: "store.specifications.barrelLengthWithNut", value: "380 mm (14.96 in)" },
  { labelKey: "store.specifications.barrelLengthWithoutNut", value: "368 mm (14.48 in)" },
  { labelKey: "store.specifications.barrelWeightWithNut", value: "890 g" },
  { labelKey: "store.specifications.barrelWeightWithoutNut", value: "840 g" },
  { labelKey: "store.specifications.firearmWeightWithPlasticSights", value: "3,200 g" },
  { labelKey: "store.specifications.firearmWeightWithoutPlasticSights", value: "3,100 g" },
  { labelKey: "store.specifications.weightWithEmptyMagazineAndSights", value: "3,300 g" },
  { labelKey: "store.specifications.lengthWithStockRetracted", value: "815 mm" },
  { labelKey: "store.specifications.lengthWithStockExtended", value: "900 mm" },
];

const arCompactSpecifications: StoreSpecification[] = [
  { labelKey: "store.specifications.barrelLengthWithNut", value: "250 mm (9.85 in)" },
  { labelKey: "store.specifications.barrelLengthWithoutNut", value: "237.5 mm (9.33 in)" },
  { labelKey: "store.specifications.barrelWeightWithNut", value: "600 g" },
  { labelKey: "store.specifications.barrelWeightWithoutNut", value: "550 g" },
  { labelKey: "store.specifications.firearmWeightWithPlasticSights", value: "2,700 g" },
  { labelKey: "store.specifications.firearmWeightWithoutPlasticSights", value: "2,600 g" },
  { labelKey: "store.specifications.weightWithEmptyMagazineAndSights", value: "2,800 g" },
  { labelKey: "store.specifications.lengthWithStockRetracted", value: "685 mm" },
  { labelKey: "store.specifications.lengthWithStockExtended", value: "765 mm" },
];

export const storeProducts: StoreProduct[] = [
  {
    id: "nyx-guard",
    name: "NYX Guard",
    brand: "AI DEF",
    category: "pistols",
    image: imagePath("69B03F53-DDB3-4F94-9F63-F2BC7C18ABDD"),
    width: 1506,
    height: 1044,
    variants: [
      {
        id: "standard",
        labelKey: "store.variants.nyx112",
        images: [
          imagePath("69B03F53-DDB3-4F94-9F63-F2BC7C18ABDD"),
          imagePath("78828894-3DE7-4682-A297-721CA52BFFDE"),
        ],
        specifications: [
          { labelKey: "store.specifications.overallLength", value: "205 mm" },
          { labelKey: "store.specifications.barrelLength", value: "112 mm" },
          { labelKey: "store.specifications.weightWithoutMagazine", value: "725 g" },
        ],
      },
      {
        id: "barrel-124",
        labelKey: "store.variants.nyx124",
        images: [
          "/store/nyx-guard/nyx-124-case.jpg",
          "/store/nyx-guard/nyx-124-case-reverse.jpg",
          "/store/nyx-guard/nyx-124-side.jpg",
          "/store/nyx-guard/nyx-124-slide-side.jpg",
        ],
        specifications: [
          { labelKey: "store.specifications.overallLength", value: "217 mm" },
          { labelKey: "store.specifications.barrelLength", value: "124 mm" },
          { labelKey: "store.specifications.weightWithoutMagazine", value: "735 g" },
        ],
      },
      {
        id: "threaded",
        labelKey: "store.variants.nyx130Threaded",
        images: [
          imagePath("2C8F95D6-B9A9-4C99-B9C2-0E25BF2AA998"),
          imagePath("DEE9854E-2C79-4A4E-B3CE-12C7F2BE6683"),
          imagePath("BBEB8192-0562-4532-BEC0-C9376DBAF0D2"),
        ],
        specifications: [
          { labelKey: "store.specifications.overallLength", value: "223 mm" },
          { labelKey: "store.specifications.barrelLength", value: "130 mm" },
          { labelKey: "store.specifications.weightWithoutMagazine", value: "742 g" },
        ],
      },
    ],
    specifications: [
      { labelKey: "store.specifications.caliber", value: "9 mm Luger" },
      { labelKey: "store.specifications.magazineCapacity", value: "16", valueKey: "store.specificationValues.standardCapacity" },
      { labelKey: "store.specifications.width", value: "33 mm" },
      { labelKey: "store.specifications.heightWithMagazine", value: "145 mm" },
      { labelKey: "store.specifications.heightWithoutMagazine", value: "135 mm" },
      { labelKey: "store.specifications.magazineWeight", value: "87 g" },
      { labelKey: "store.specifications.material", value: "", valueKey: "store.specificationValues.material" },
      { labelKey: "store.specifications.mountingRail", value: "Picatinny" },
    ],
  },
  {
    id: "ar15",
    name: "AR / AR Compact",
    brand: "AI DEF",
    category: "automatic",
    image: imagePath("C9383A81-5323-4A00-A4A2-22DFF4826367"),
    width: 1774,
    height: 887,
    // shortcut: Photo assignments follow barrel profiles; replace when the manufacturer supplies a model-to-photo list.
    variants: [
      {
        id: "ar-black",
        labelKey: "store.variants.arBlack",
        modelName: "AR",
        specifications: arSpecifications,
        images: [
          imagePath("C9383A81-5323-4A00-A4A2-22DFF4826367"),
          imagePath("9ACCDBAB-0056-44AD-BB43-D41169E29558"),
          imagePath("480EF0AA-42C4-4BCA-AA3C-CB70F621BF60"),
          imagePath("BFA35536-936C-452D-98E9-B65E5780CB93"),
        ],
      },
      {
        id: "ar-compact-black",
        labelKey: "store.variants.arCompactBlack",
        modelName: "AR Compact",
        specifications: arCompactSpecifications,
        images: [
          imagePath("E49D5E30-351E-4547-BC64-766DAF310447"),
          imagePath("DEFE400E-CCA5-4498-B0E0-D69F14244B33"),
        ],
      },
      {
        id: "ar-compact-black-optic",
        labelKey: "store.variants.arCompactBlackOptic",
        modelName: "AR Compact",
        specifications: arCompactSpecifications,
        images: [
          imagePath("73165FD0-8B1B-4EF6-B605-2FB9CDCBA7BD"),
          imagePath("50EE71B6-6D16-453B-AE53-D7F98B1790D9"),
        ],
      },
      {
        id: "ar-sand",
        labelKey: "store.variants.arSand",
        modelName: "AR",
        specifications: arSpecifications,
        images: [
          imagePath("5E3342A0-E033-47C9-B0B3-2937CE12CB9F"),
          imagePath("E625025A-6815-473B-9AE3-6674573486C7"),
          imagePath("A2765BBF-B93C-4388-A3F9-CA4DE09DD5F4"),
        ],
      },
      {
        id: "ar-compact-sand",
        labelKey: "store.variants.arCompactSand",
        modelName: "AR Compact",
        specifications: arCompactSpecifications,
        images: [
          imagePath("BD19E33B-CBD7-4A3A-8CFA-0EEF76FE6B31"),
          imagePath("9A3E7AAD-9E98-4FC9-A921-E16F590551E1"),
          imagePath("43C8F9CD-E102-4FAC-AA6C-7054EBCA29F4"),
        ],
      },
      {
        id: "ar-olive-optic",
        labelKey: "store.variants.arOliveOptic",
        modelName: "AR",
        specifications: arSpecifications,
        images: [
          imagePath("C932F602-BB98-4A0E-9D1C-EE440D622393"),
          imagePath("9A6FE882-40C1-4DD0-AA3B-7822B72DD1B0"),
        ],
      },
    ],
    specifications: [
      { labelKey: "store.specifications.caliber", value: "", valueKey: "store.specificationValues.multicaliber" },
      { labelKey: "store.specifications.barrelTwistRate", value: "1:7" },
      { labelKey: "store.specifications.heightAtGrip", value: "185 mm" },
      { labelKey: "store.specifications.widthAtThickestPoint", value: "55 mm" },
    ],
  },
];

export const storeCategories: StoreCategory[] = ["pistols", "automatic"];
