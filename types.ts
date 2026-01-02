
export interface PriceData {
  ouncePrice: number;
  usdTryRate: number;
  gramPrice: number;
  timestamp: string;
  sources: Array<{ title: string; uri: string }>;
}

export interface HistoricalData {
  date: string;
  price: number;
}

export interface MarketSummary {
  current: PriceData | null;
  history: HistoricalData[];
  loading: boolean;
  error: string | null;
}
