export type StoreCategory = "pistols" | "automatic";

export type StoreVariant = {
  id: string;
  label: string;
  modelName?: string;
  images: string[];
  imageAlts?: Record<string, string>;
  specifications: StoreSpecification[];
};

export type StoreSpecification = {
  label: string;
  value: string;
};

export type StoreProduct = {
  coverAlt?: string;
  id: string;
  name: string;
  brand: string;
  description: string;
  category: StoreCategory;
  image: string;
  width: number;
  height: number;
  variants: StoreVariant[];
  specifications: StoreSpecification[];
};
