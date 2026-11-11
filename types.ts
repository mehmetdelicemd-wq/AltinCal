
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
  silverOuncePrice: number;
  goldSilverRatio: number;
  quarterGoldPrice: number;
  halfGoldPrice: number;
  fullGoldPrice: number;
  btcPrice: number;
  btcChange: number;
  ethPrice: number;
  ethChange: number;
  timestamp: string;
  sources: Array<{ title: string; uri: string }>;
  searchGroundedAt?: string;
  searchStatus?: 'idle' | 'updating' | 'synced' | 'error' | 'rate_limited';
}

export interface NewsItem {
  title: string;
  snippet: string;
  url: string;
  source: string;
  date: string;
  imageUrl?: string;
  category?: 'altin' | 'gumus' | 'doviz' | 'kripto' | 'makro';
  readTime?: string;
}

export interface PortfolioHistoryPoint {
  date: string;
  totalValue: number;
  goldValue: number;
  silverValue: number;
  usdValue: number;
  cryptoValue: number;
  customValue: number;
  dailyChange: number;
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

export type AppLanguage = 'tr' | 'en';
