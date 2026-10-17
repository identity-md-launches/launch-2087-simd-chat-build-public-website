export interface Coin {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price: number | null;
  market_cap: number | null;
  total_volume: number | null;
  market_cap_rank?: number | null;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  circulating_supply?: number | null;
  high_24h?: number | null;
  low_24h?: number | null;
  sparkline_in_7d?: { price: number[] };
  last_updated?: string;
  provenance?: { source: string; status: "live" | "snapshot"; at: string };
  dex?: {
    chain: string;
    address: string;
    pair: string;
    quote: string;
    exchange: string;
    url: string;
  };
}
export interface Pair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  url: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  txns?: { h24?: { buys: number; sells: number } };
  info?: { imageUrl?: string };
}
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
export interface Trade {
  id: string;
  time: string;
  side: "buy" | "sell";
  price: number;
  amount: number;
  total: number;
  url?: string;
}
export interface Exchange {
  name: string;
  kind: "CEX" | "DEX" | "Belum dikenali";
  pair: string;
  price: number | null;
  volume: number | null;
  liquidity?: number | null;
  url?: string;
}
export interface Resource<T> {
  data: T;
  source: string;
  at: string;
  status: "live" | "snapshot" | "error";
  note?: string;
}
export type Period = "1" | "7" | "30";
export interface GlobalData {
  total_market_cap: Record<string, number>;
  total_volume: Record<string, number>;
  market_cap_percentage: Record<string, number>;
  market_cap_change_percentage_24h_usd: number;
  active_cryptocurrencies: number;
  markets: number;
  updated_at: number;
}
export interface TokenStats {
  isNative?: boolean;
  holders: number | null;
  liquidity: number | null;
  buys: number | null;
  sells: number | null;
  chain?: string;
  address?: string;
  pool?: string;
  pairs: Pair[];
}
