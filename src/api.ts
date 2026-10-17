import raw from "./data/snapshot.json";
import type {
  Candle,
  Coin,
  Exchange,
  ExchangeResource,
  GlobalData,
  Pair,
  Period,
  Resource,
  TokenStats,
  Trade,
} from "./types";
const CG = "https://api.coingecko.com/api/v3";
const CB = "https://api.exchange.coinbase.com";
const GT = "https://api.geckoterminal.com/api/v2";
const nativeIds = new Set([
  "bitcoin",
  "ethereum",
  "solana",
  "binancecoin",
  "ripple",
  "dogecoin",
  "sui",
  "avalanche-2",
  "tron",
  "the-open-network",
  "cardano",
  "zcash",
  "litecoin",
  "polkadot",
  "cosmos",
  "near",
  "aptos",
  "stellar",
  "bitcoin-cash",
  "monero",
  "hedera-hashgraph",
  "hyperliquid",
]);
export const PEPE_ADDRESS = "0x6982508145454Ce325dDbE47a25d4ec3d2311933";
const contracts: Record<string, { chain: string; address: string }> = {
  pepe: { chain: "ethereum", address: PEPE_ADDRESS },
};
const blockscout: Record<string, string> = {
  ethereum: "https://eth.blockscout.com",
  base: "https://base.blockscout.com",
  optimism: "https://optimism.blockscout.com",
  arbitrum: "https://arbitrum.blockscout.com",
  polygon: "https://polygon.blockscout.com",
};
const networks: Record<string, string> = {
  ethereum: "eth",
  solana: "solana",
  base: "base",
  bsc: "bsc",
  arbitrum: "arbitrum",
  polygon: "polygon_pos",
  optimism: "optimism",
  avalanche: "avax",
};
const platformChains: Record<string, string> = {
  ethereum: "ethereum",
  base: "base",
  solana: "solana",
  "binance-smart-chain": "bsc",
  "arbitrum-one": "arbitrum",
  "polygon-pos": "polygon",
  "optimistic-ethereum": "optimism",
  avalanche: "avalanche",
};
const sameAddress = (a: string, b: string) =>
  a.startsWith("0x") ? a.toLowerCase() === b.toLowerCase() : a === b;
async function resolveToken(c: Coin, signal?: AbortSignal) {
  if (c.dex) return c.dex;
  if (contracts[c.id]) return contracts[c.id];
  if (nativeIds.has(c.id)) return null;
  try {
    const detail = await request<{ platforms: Record<string, string> }>(
      `${CG}/coins/${encodeURIComponent(c.id)}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false&sparkline=false`,
      signal,
    );
    for (const [platform, chain] of Object.entries(platformChains)) {
      const address = detail.platforms?.[platform];
      if (address) return { chain, address };
    }
  } catch {
    /* Missing metadata leaves on-chain fields explicitly unavailable. */
  }
  return null;
}
async function resolveCoinId(c: Coin, signal?: AbortSignal) {
  if (!c.dex) return c.id;
  const token = c.dex;
  const known = Object.entries(contracts).find(
    ([, t]) => t.chain === token.chain && sameAddress(t.address, token.address),
  );
  if (known) return known[0];
  const platform = Object.keys(platformChains).find(
    (id) => platformChains[id] === token.chain,
  );
  if (!platform) return null;
  try {
    const detail = await request<{
      id: string;
      platforms: Record<string, string>;
    }>(
      `${CG}/coins/${platform}/contract/${encodeURIComponent(token.address)}`,
      signal,
    );
    return typeof detail.id === "string" &&
      detail.platforms?.[platform] &&
      sameAddress(detail.platforms[platform], token.address)
      ? detail.id
      : null;
  } catch {
    return null;
  }
}
const products: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
  ripple: "XRP",
  dogecoin: "DOGE",
  sui: "SUI",
  chainlink: "LINK",
  "avalanche-2": "AVAX",
  uniswap: "UNI",
  pepe: "PEPE",
};
export const snapshotAt = raw.capturedAt;
export const initialCoins: Coin[] = (raw.markets as Coin[]).map((c) => ({
  ...c,
  provenance: { source: "CoinGecko", status: "snapshot", at: raw.capturedAt },
}));
export const localIds = new Set(initialCoins.map((c) => c.id));
export const initialGlobal = raw.global as GlobalData;
const cache = new Map<string, { data: unknown; time: number }>();
export async function request<T>(
  url: string,
  signal?: AbortSignal,
): Promise<T> {
  const entry = cache.get(url);
  if (entry && Date.now() - entry.time < 55_000) return entry.data as T;
  const abort = new AbortController();
  const relay = () => abort.abort();
  signal?.addEventListener("abort", relay, { once: true });
  const timeout = setTimeout(() => abort.abort(), 12_000);
  try {
    if (signal?.aborted) throw new Error("Permintaan dibatalkan");
    const res = await fetch(url, {
      signal: abort.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok)
      throw new Error(
        res.status === 429
          ? "Batas API tercapai. Coba lagi sebentar."
          : `API merespons ${res.status}`,
      );
    const data = (await res.json()) as T;
    cache.set(url, { data, time: Date.now() });
    return data;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", relay);
  }
}
const live = <T>(data: T, source: string): Resource<T> => ({
  data,
  source,
  at: new Date().toISOString(),
  status: "live",
});
const stored = <T>(data: T, source: string, note?: string): Resource<T> => ({
  data,
  source,
  at: snapshotAt,
  status: "snapshot",
  note,
});
export async function getMarkets(
  signal?: AbortSignal,
): Promise<Resource<Coin[]>> {
  try {
    const coins = await request<Coin[]>(
      `${CG}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=true&price_change_percentage=7d`,
      signal,
    );
    if (!Array.isArray(coins) || !coins.length) throw new Error("Data kosong");
    return live(
      coins.map((c) => ({
        ...c,
        provenance: {
          source: "CoinGecko",
          status: "live" as const,
          at: c.last_updated ?? new Date().toISOString(),
        },
      })),
      "CoinGecko",
    );
  } catch {
    return stored(
      initialCoins,
      "CoinGecko",
      "API pasar tidak terjangkau. Snapshot ditampilkan.",
    );
  }
}
export async function getGlobal(
  signal?: AbortSignal,
): Promise<Resource<GlobalData>> {
  try {
    const d = await request<{ data: GlobalData }>(`${CG}/global`, signal);
    if (
      !Number.isFinite(d.data?.total_market_cap?.usd) ||
      !Number.isFinite(d.data?.total_volume?.usd)
    )
      throw new Error("Data global belum tersedia");
    return live(d.data, "CoinGecko");
  } catch {
    return stored(initialGlobal, "CoinGecko");
  }
}
export function pairCoin(p: Pair): Coin {
  return {
    provenance: {
      source: "DEX Screener",
      status: "live",
      at: new Date().toISOString(),
    },
    id: `${p.chainId}:${p.baseToken.address}`,
    symbol: p.baseToken.symbol,
    name: p.baseToken.name,
    image: p.info?.imageUrl,
    current_price: p.priceUsd ? Number(p.priceUsd) : null,
    market_cap: p.marketCap ?? null,
    total_volume: p.volume?.h24 ?? null,
    price_change_percentage_24h: p.priceChange?.h24 ?? null,
    dex: {
      chain: p.chainId,
      address: p.baseToken.address,
      pair: p.pairAddress,
      quote: p.quoteToken.symbol,
      exchange: p.dexId,
      url: p.url,
    },
  };
}
export async function searchCoins(
  query: string,
  signal?: AbortSignal,
): Promise<{ coins: Coin[]; partial: boolean }> {
  const q = query.trim();
  const [cg, dex] = await Promise.allSettled([
    request<{
      coins: {
        id: string;
        name: string;
        symbol: string;
        large: string;
        market_cap_rank: number | null;
      }[];
    }>(`${CG}/search?query=${encodeURIComponent(q)}`, signal),
    request<{ pairs: Pair[] | null }>(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`,
      signal,
    ),
  ]);
  if (signal?.aborted) return { coins: [], partial: true };
  const local = initialCoins.filter((c) =>
    `${c.name} ${c.symbol}`.toLowerCase().includes(q.toLowerCase()),
  );
  const found =
    cg.status === "fulfilled"
      ? cg.value.coins.slice(0, 6).map(
          (c) =>
            initialCoins.find((i) => i.id === c.id) ??
            ({
              id: c.id,
              name: c.name,
              symbol: c.symbol,
              image: c.large,
              market_cap_rank: c.market_cap_rank,
              current_price: null,
              market_cap: null,
              total_volume: null,
              price_change_percentage_24h: null,
            } as Coin),
        )
      : local;
  const seen = new Set(found.map((c) => c.id));
  const pairs =
    dex.status === "fulfilled"
      ? [...(dex.value.pairs ?? [])].sort(
          (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0),
        )
      : [];
  for (const p of pairs) {
    const c = pairCoin(p);
    if (!seen.has(c.id)) {
      found.push(c);
      seen.add(c.id);
    }
    if (found.length >= 12) break;
  }
  return {
    coins: found,
    partial: cg.status === "rejected" || dex.status === "rejected",
  };
}
export async function hydrateCoin(
  c: Coin,
  signal?: AbortSignal,
  force = false,
): Promise<Coin> {
  if (
    !force &&
    (c.dex || (c.current_price !== null && c.provenance?.status === "live"))
  )
    return c;
  if (c.dex) {
    const token = c.dex;
    const data = await request<{ pairs: Pair[] | null }>(
      `https://api.dexscreener.com/latest/dex/tokens/${token.address}`,
      signal,
    );
    const pairs = (data.pairs ?? []).filter(
      (p) =>
        p.chainId === token.chain &&
        sameAddress(p.baseToken.address, token.address),
    );
    const pair = pairs.find((p) => p.pairAddress === token.pair) ?? pairs[0];
    if (!pair) throw new Error("Harga pasangan belum tersedia");
    return { ...pairCoin(pair), id: c.id };
  }
  const data = await request<Coin[]>(
    `${CG}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(c.id)}&sparkline=true`,
    signal,
  );
  const coin = data.find((i) => i.id === c.id);
  if (!coin) throw new Error("Harga koin belum tersedia");
  return {
    ...coin,
    provenance: {
      source: "CoinGecko",
      status: "live",
      at: coin.last_updated ?? new Date().toISOString(),
    },
  };
}
const cbCandles = (d: number[][]): Candle[] =>
  d
    .map(([time, low, high, open, close, volume]) => ({
      time,
      low,
      high,
      open,
      close,
      volume,
    }))
    .sort((a, b) => a.time - b.time);
const gtCandles = (d: number[][]): Candle[] =>
  d
    .map(([time, open, high, low, close, volume]) => ({
      time,
      open,
      high,
      low,
      close,
      volume,
    }))
    .sort((a, b) => a.time - b.time);
function validCandles(data: Candle[]) {
  return data.filter(
    (c) =>
      [c.time, c.open, c.high, c.low, c.close].every(Number.isFinite) &&
      c.high >= c.low,
  );
}
export function initialCandles(
  id: string,
  period: Period,
): Resource<Candle[]> | null {
  if (id === "bitcoin")
    return stored(cbCandles(raw.bitcoin.candles[period]), "Coinbase");
  if (
    id === "pepe" ||
    id.toLowerCase() === `ethereum:${PEPE_ADDRESS.toLowerCase()}`
  )
    return stored(gtCandles(raw.pepe.candles[period]), "GeckoTerminal");
  return null;
}
export async function getCandles(
  c: Coin,
  period: Period,
  pool: string | undefined,
  signal?: AbortSignal,
): Promise<Resource<Candle[]>> {
  try {
    const token = await resolveToken(c, signal);
    if (token) {
      const { chain, address } = token;
      let actualPool = pool;
      if (!actualPool) {
        const r = await request<{
          data: { attributes: { address: string } }[];
        }>(
          `${GT}/networks/${networks[chain] ?? chain}/tokens/${address}/pools?page=1`,
          signal,
        );
        actualPool = r.data?.[0]?.attributes.address;
      }
      if (!actualPool) throw new Error("Pool tidak tersedia");
      const timeframe = period === "30" ? "day" : "hour";
      const aggregate = period === "7" ? 4 : 1;
      const limit = period === "1" ? 24 : period === "7" ? 42 : 30;
      const r = await request<{
        data: { attributes: { ohlcv_list: number[][] } };
      }>(
        `${GT}/networks/${networks[chain] ?? chain}/pools/${actualPool}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}&currency=usd&token=${address}`,
        signal,
      );
      const data = validCandles(gtCandles(r.data.attributes.ohlcv_list));
      if (!data.length) throw new Error("Belum ada candle");
      return live(data, "GeckoTerminal");
    }
    if (products[c.id]) {
      const granularity =
        period === "1" ? 3600 : period === "7" ? 21600 : 86400;
      const rows = await request<number[][]>(
        `${CB}/products/${products[c.id]}-USD/candles?granularity=${granularity}`,
        signal,
      );
      const data = validCandles(
        cbCandles(
          rows.slice(0, period === "1" ? 24 : period === "7" ? 28 : 30),
        ),
      );
      if (!data.length) throw new Error("Belum ada candle");
      return live(data, "Coinbase");
    }
    const rows = await request<number[][]>(
      `${CG}/coins/${encodeURIComponent(c.id)}/ohlc?vs_currency=usd&days=${period}`,
      signal,
    );
    const data = rows.map(([t, open, high, low, close]) => ({
      time: t / 1000,
      open,
      high,
      low,
      close,
      volume: 0,
    }));
    if (!data.length) throw new Error("Belum ada candle");
    return live(data, "CoinGecko");
  } catch {
    const fallback = initialCandles(c.id, period);
    if (fallback)
      return {
        ...fallback,
        note: "Pembaruan grafik gagal. Snapshot ditampilkan.",
      };
    return {
      data: [],
      status: "error",
      source: c.dex ? "GeckoTerminal" : "Coinbase / CoinGecko",
      at: "",
      note: "Grafik belum tersedia. Coba lagi atau pilih koin lain.",
    };
  }
}
export function initialStats(c: Coin): Resource<TokenStats> {
  const token = c.dex ?? contracts[c.id];
  const isPepe =
    c.id === "pepe" ||
    (token?.chain === "ethereum" &&
      token.address.toLowerCase() === PEPE_ADDRESS.toLowerCase());
  const pairs = isPepe ? (raw.pepe.pairs as Pair[]) : [];
  const pair = pairs.find((p) => p.chainId === (token?.chain ?? "ethereum"));
  return stored(
    {
      isNative: nativeIds.has(c.id),
      holders: isPepe ? Number(raw.pepe.holders.holders_count) : null,
      liquidity: pair?.liquidity?.usd ?? null,
      buys: pair?.txns?.h24?.buys ?? null,
      sells: pair?.txns?.h24?.sells ?? null,
      chain: token?.chain,
      address: token?.address,
      pool: isPepe ? raw.pepe.pool : undefined,
      pairs,
    },
    isPepe ? "DEX Screener · Blockscout" : "Info jaringan",
  );
}
export async function getTokenStats(
  c: Coin,
  signal?: AbortSignal,
): Promise<Resource<TokenStats>> {
  const token = await resolveToken(c, signal);
  if (!token)
    return { ...initialStats(c), status: "live", at: new Date().toISOString() };
  const [pairResult, holderResult, poolResult] = await Promise.allSettled([
    request<{ pairs: Pair[] | null }>(
      `https://api.dexscreener.com/latest/dex/tokens/${token.address}`,
      signal,
    ),
    blockscout[token.chain]
      ? request<{ holders_count: string }>(
          `${blockscout[token.chain]}/api/v2/tokens/${token.address}`,
          signal,
        )
      : Promise.resolve(null),
    request<{ data: { attributes: { address: string } }[] }>(
      `${GT}/networks/${networks[token.chain] ?? token.chain}/tokens/${token.address}/pools?page=1`,
      signal,
    ),
  ]);
  if (pairResult.status === "rejected")
    return {
      ...initialStats(c),
      note: "Pembaruan DEX gagal. Data snapshot jika tersedia.",
    };
  const pairs = (pairResult.value.pairs ?? [])
    .filter(
      (p) =>
        p.chainId === token.chain &&
        (token.address.startsWith("0x")
          ? p.baseToken.address.toLowerCase() === token.address.toLowerCase()
          : p.baseToken.address === token.address),
    )
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
  const p = c.dex
    ? (pairs.find((p) => p.pairAddress === c.dex!.pair) ?? pairs[0])
    : pairs[0];
  return live(
    {
      holders:
        holderResult.status === "fulfilled" &&
        holderResult.value?.holders_count != null
          ? Number(holderResult.value.holders_count)
          : null,
      liquidity: p?.liquidity?.usd ?? null,
      buys: p?.txns?.h24?.buys ?? null,
      sells: p?.txns?.h24?.sells ?? null,
      chain: token.chain,
      address: token.address,
      pool:
        poolResult.status === "fulfilled"
          ? poolResult.value.data?.[0]?.attributes.address
          : undefined,
      pairs,
    },
    "DEX Screener · Blockscout",
  );
}
const cbTrades = (
  d: {
    trade_id: number;
    time: string;
    side: string;
    price: string;
    size: string;
  }[],
): Trade[] =>
  d.map((t) => ({
    id: String(t.trade_id),
    time: t.time,
    side: t.side === "sell" ? "buy" : "sell",
    price: Number(t.price),
    amount: Number(t.size),
    total: Number(t.price) * Number(t.size),
  }));
type GTTrade = {
  id: string;
  attributes: {
    block_timestamp: string;
    kind: string;
    price_from_in_usd: string;
    price_to_in_usd: string;
    from_token_amount: string;
    to_token_amount: string;
    volume_in_usd: string;
    tx_hash: string;
    from_token_address: string;
    to_token_address: string;
  };
};
const gtTrades = (d: GTTrade[], address = PEPE_ADDRESS): Trade[] => {
  const normalize = (a: string) => (a.startsWith("0x") ? a.toLowerCase() : a);
  return d
    .filter((t) =>
      [t.attributes.from_token_address, t.attributes.to_token_address].some(
        (a) => normalize(a) === normalize(address),
      ),
    )
    .map((t) => {
      const a = t.attributes,
        buy = normalize(a.to_token_address) === normalize(address);
      return {
        id: t.id,
        time: a.block_timestamp,
        side: buy ? "buy" : "sell",
        price: Number(buy ? a.price_to_in_usd : a.price_from_in_usd),
        amount: Number(buy ? a.to_token_amount : a.from_token_amount),
        total: Number(a.volume_in_usd),
      };
    });
};
export async function getTrades(
  c: Coin,
  pool: string | undefined,
  signal?: AbortSignal,
): Promise<Resource<Trade[]>> {
  try {
    const token = await resolveToken(c, signal);
    if (token) {
      if (!pool) throw new Error("Pool belum tersedia");
      const d = await request<{ data: GTTrade[] }>(
        `${GT}/networks/${networks[token.chain] ?? token.chain}/pools/${pool}/trades`,
        signal,
      );
      return live(gtTrades(d.data, token.address), "GeckoTerminal");
    }
    if (!products[c.id]) throw new Error("Produk tidak terdaftar");
    const d = await request<Parameters<typeof cbTrades>[0]>(
      `${CB}/products/${products[c.id]}-USD/trades?limit=40`,
      signal,
    );
    return live(cbTrades(d), "Coinbase");
  } catch {
    if (c.id === "bitcoin")
      return stored(cbTrades(raw.bitcoin.trades), "Coinbase");
    if (
      c.id === "pepe" ||
      (c.dex?.chain === "ethereum" &&
        c.dex.address.toLowerCase() === PEPE_ADDRESS.toLowerCase())
    )
      return stored(gtTrades(raw.pepe.trades as GTTrade[]), "GeckoTerminal");
    return {
      data: [],
      source: "Coinbase / GeckoTerminal",
      status: "error",
      at: "",
      note: "Riwayat transaksi belum tersedia untuk pasangan ini. Coba lagi atau pilih koin lain.",
    };
  }
}
type Ticker = {
  market: { name: string; identifier: string };
  base: string;
  target: string;
  converted_last: { usd: number };
  converted_volume: { usd: number };
  trade_url?: string;
  is_stale?: boolean;
  is_anomaly?: boolean;
};
const knownDex =
  /uniswap|pancake|curve|sushi|raydium|orca|aerodrome|balancer|meteora|trader.?joe|jupiter|dodo|quickswap|camelot|velodrome/i;
const knownCex =
  /^(binance|coinbase|gdax|kraken|kucoin|bybit|okex|okx|bitfinex|bitstamp|bitget|mexc|mxc|gate|upbit|bithumb|huobi|htx|whitebit|poloniex|pionex|btcc|kcex|digifinex|bitmart|lbank|crypto_com|cryptocom|gemini|bitflyer|indodax|tokocrypto)(?:_|-|$)/i;
const tickers = (d: Ticker[]): Exchange[] =>
  d
    .filter((t) => !t.is_stale && !t.is_anomaly)
    .map((t) => ({
      name: t.market.name,
      kind: knownDex.test(t.market.identifier + " " + t.market.name)
        ? "DEX"
        : knownCex.test(t.market.identifier)
          ? "CEX"
          : "Belum dikenali",
      pair: `${t.base} / ${t.target}`,
      price: t.converted_last?.usd ?? null,
      volume: t.converted_volume?.usd ?? null,
      url: t.trade_url,
    }));
export async function getExchanges(
  c: Coin,
  stats: Resource<TokenStats>,
  signal?: AbortSignal,
): Promise<ExchangeResource> {
  const dexRows: Exchange[] = stats.data.pairs.map((p) => ({
    name: p.dexId,
    kind: "DEX",
    pair: `${p.baseToken.symbol} / ${p.quoteToken.symbol}`,
    price: p.priceUsd ? Number(p.priceUsd) : null,
    volume: p.volume?.h24 ?? null,
    liquidity: p.liquidity?.usd,
    url: p.url,
  }));
  const coinId = await resolveCoinId(c, signal);
  if (!coinId)
    return {
      data: dexRows,
      source: "DEX Screener",
      status: dexRows.length ? stats.status : "error",
      at: stats.at,
      note: "Cakupan CEX belum tersedia untuk kontrak ini",
      cexAvailable: false,
    };
  try {
    const d = await request<{ tickers: Ticker[] }>(
      `${CG}/coins/${encodeURIComponent(coinId)}/tickers?order=volume_desc&depth=false`,
      signal,
    );
    return {
      ...(stats.status === "snapshot" && dexRows.length
        ? stored(
            [...tickers(d.tickers), ...dexRows],
            "CoinGecko · DEX Screener",
            "Data DEX dari snapshot; CEX baru diperbarui.",
          )
        : live(
            [...tickers(d.tickers), ...dexRows],
            "CoinGecko · DEX Screener",
          )),
      cexAvailable: true,
    };
  } catch {
    if (coinId === "bitcoin")
      return {
        ...stored(tickers(raw.bitcoin.tickers as Ticker[]), "CoinGecko"),
        cexAvailable: true,
      };
    if (coinId === "pepe")
      return {
        ...stored(
          [...tickers(raw.pepe.tickers as Ticker[]), ...dexRows],
          "CoinGecko · DEX Screener",
          "Daftar CEX dari snapshot; status DEX mengikuti data on-chain.",
        ),
        cexAvailable: true,
      };
    return {
      data: dexRows,
      source: "DEX Screener",
      status: dexRows.length ? stats.status : "error",
      at: stats.at,
      note: c.dex
        ? "Cakupan CEX belum tersedia untuk kontrak ini"
        : "Daftar CEX belum tersedia. Coba lagi nanti.",
      cexAvailable: false,
    };
  }
}
