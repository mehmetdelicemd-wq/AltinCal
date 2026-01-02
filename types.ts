
export interface PriceData {
  ouncePrice: number;
  ounceChange: number;
  usdTryRate: number;
  usdTryChange: number;
  eurTryRate: number;
  eurTryChange: number;
  gramPrice: number;
  gramChange: number;
  silverPrice: number;
  silverChange: number;
  btcPrice: number;
  btcChange: number;
  ethPrice: number;
  ethChange: number;
  timestamp: string;
  sources: Array<{ title: string; uri: string }>;
}

export interface NewsItem {
  title: string;
  snippet: string;
  url: string;
  source: string;
  date: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface OHLCData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface PriceAlert {
  id: string;
  targetPrice: number;
  type: 'above' | 'below';
  isActive: boolean;
}

export interface Asset {
  id: string;
  name: string;
  amount: string;
  priceKey: keyof PriceData;
  changeKey: keyof PriceData;
  color: string;
  unit: string;
}

export interface MarketSummary {
  current: PriceData | null;
  history: OHLCData[];
  loading: boolean;
  error: string | null;
}
