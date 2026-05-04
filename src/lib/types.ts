export type Guess = {
  label: string;
  brand?: string;
  model?: string;
  category?: string;
  confidence: number;
  search_query: string;
  notes?: string;
};

export type Comp = {
  title: string;
  price: number;
  currency: string;
  url: string;
  image?: string;
  condition?: string;
};

export type CompsResult = {
  query: string;
  count: number;
  median?: number;
  p25?: number;
  p75?: number;
  currency: string;
  samples: Comp[];
};
