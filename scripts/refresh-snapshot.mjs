import { writeFile, mkdir } from "node:fs/promises";
const get = async (url) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status}: ${url}`);
  return r.json();
};
const cg = "https://api.coingecko.com/api/v3";
const cb = "https://api.exchange.coinbase.com";
const gt = "https://api.geckoterminal.com/api/v2";
const address = "0x6982508145454Ce325dDbE47a25d4ec3d2311933";
const ids =
  "bitcoin,ethereum,solana,binancecoin,ripple,dogecoin,pepe,sui,chainlink,avalanche-2,uniswap,tether,usd-coin,hyperliquid";
const [
  markets,
  global,
  btcHour,
  btcDay,
  btcWeek,
  btcTrades,
  btcTickers,
  pairs,
  pools,
  holders,
] = await Promise.all([
  get(
    `${cg}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=true&price_change_percentage=1h,24h,7d`,
  ),
  get(`${cg}/global`),
  get(`${cb}/products/BTC-USD/candles?granularity=3600`),
  get(`${cb}/products/BTC-USD/candles?granularity=86400`),
  get(`${cb}/products/BTC-USD/candles?granularity=21600`),
  get(`${cb}/products/BTC-USD/trades?limit=40`),
  get(`${cg}/coins/bitcoin/tickers?order=volume_desc&depth=false`),
  get(`https://api.dexscreener.com/latest/dex/tokens/${address}`),
  get(`${gt}/networks/eth/tokens/${address}/pools?page=1`),
  get(`https://eth.blockscout.com/api/v2/tokens/${address}`),
]);
const pool = pools.data[0].attributes.address;
const [pepeHour, pepeWeek, pepeDay, pepeTrades, pepeTickers] =
  await Promise.all([
    get(
      `${gt}/networks/eth/pools/${pool}/ohlcv/hour?aggregate=1&limit=24&currency=usd&token=base`,
    ),
    get(
      `${gt}/networks/eth/pools/${pool}/ohlcv/hour?aggregate=4&limit=42&currency=usd&token=base`,
    ),
    get(
      `${gt}/networks/eth/pools/${pool}/ohlcv/day?aggregate=1&limit=30&currency=usd&token=base`,
    ),
    get(`${gt}/networks/eth/pools/${pool}/trades`),
    get(`${cg}/coins/pepe/tickers?order=volume_desc&depth=false`),
  ]);
const snapshot = {
  capturedAt: new Date().toISOString(),
  markets,
  global: global.data,
  bitcoin: {
    candles: {
      1: btcHour.slice(0, 24),
      7: btcWeek.slice(0, 28),
      30: btcDay.slice(0, 30),
    },
    trades: btcTrades,
    tickers: btcTickers.tickers.slice(0, 20),
  },
  pepe: {
    pool,
    tickers: pepeTickers.tickers.slice(0, 20),
    pairs: pairs.pairs
      .filter(
        (p) => p.baseToken.address.toLowerCase() === address.toLowerCase(),
      )
      .slice(0, 15),
    holders,
    candles: {
      1: pepeHour.data.attributes.ohlcv_list,
      7: pepeWeek.data.attributes.ohlcv_list,
      30: pepeDay.data.attributes.ohlcv_list,
    },
    trades: pepeTrades.data.slice(0, 40),
  },
};
await mkdir("src/data", { recursive: true });
await writeFile("src/data/snapshot.json", JSON.stringify(snapshot));
console.log(
  `Saved real API snapshot at ${snapshot.capturedAt}; ${markets.length} coins; pool ${pool}`,
);
