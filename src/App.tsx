import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  Database,
  ExternalLink,
  Globe2,
  LayoutDashboard,
  Menu,
  Radio,
  RefreshCw,
  Search as SearchIcon,
  SlidersHorizontal,
  Star,
  TrendingUp,
  X,
} from "lucide-react";
import {
  getCandles,
  getExchanges,
  getGlobal,
  getMarkets,
  getTokenStats,
  getTrades,
  hydrateCoin,
  initialCandles,
  initialCoins,
  initialGlobal,
  initialStats,
  pairCoin,
  snapshotAt,
} from "./api";
import {
  compact,
  dateTime,
  number,
  price,
  safeUrl,
  type Currency,
} from "./format";
import type {
  Candle,
  Coin,
  ExchangeResource,
  GlobalData,
  Period,
  Resource,
  TokenStats,
  Trade,
} from "./types";
import Chart from "./components/Chart";
import Search from "./components/Search";
import {
  Change,
  CoinIcon,
  DataStatus,
  SaveButton,
  Sparkline,
} from "./components/Shared";

type View = "overview" | "watchlist" | "dex";
type Tab = "coins" | "trades" | "exchanges";
function readSaved(): Coin[] {
  try {
    const d = JSON.parse(localStorage.getItem("ehs-watchlist-v1") ?? "null");
    return Array.isArray(d)
      ? d
          .filter(
            (c) =>
              typeof c.id === "string" &&
              typeof c.name === "string" &&
              typeof c.symbol === "string",
          )
          .slice(0, 100)
          .map((c) => ({
            ...c,
            provenance: {
              source: c.provenance?.source ?? "Data tersimpan",
              status: "snapshot",
              at: c.provenance?.at ?? snapshotAt,
            },
          }))
      : [
          initialCoins.find((c) => c.id === "bitcoin")!,
          initialCoins.find((c) => c.id === "ethereum")!,
          initialCoins.find((c) => c.id === "solana")!,
        ];
  } catch {
    return [];
  }
}
function Brand({ onHome }: { onHome: () => void }) {
  return (
    <a
      className="brand"
      href="#"
      onClick={onHome}
      aria-label="Everted Hand Swarm, beranda"
    >
      <span className="brand-hand" aria-hidden="true">
        <img src="./hand.svg" alt="" />
      </span>
      <span>
        Everted Hand
        <strong>
          Swarm<span className="brand-dot">.</span>
        </strong>
      </span>
    </a>
  );
}
export default function App() {
  const [markets, setMarkets] = useState<Resource<Coin[]>>({
    data: initialCoins,
    source: "CoinGecko",
    at: snapshotAt,
    status: "snapshot",
  });
  const [global, setGlobal] = useState<Resource<GlobalData>>({
    data: initialGlobal,
    source: "CoinGecko",
    at: snapshotAt,
    status: "snapshot",
  });
  const [selected, setSelected] = useState<Coin>(
    initialCoins.find((c) => c.id === "bitcoin")!,
  );
  const [chart, setChart] = useState<Resource<Candle[]> | null>(
    initialCandles("bitcoin", "1"),
  );
  const [stats, setStats] = useState<Resource<TokenStats>>(
    initialStats(selected),
  );
  const [trades, setTrades] = useState<Resource<Trade[]> | null>(null),
    [exchanges, setExchanges] = useState<ExchangeResource | null>(null);
  const [saved, setSaved] = useState<Coin[]>(readSaved),
    [period, setPeriod] = useState<Period>("1"),
    [currency, setCurrency] = useState<Currency>("USD");
  const [refresh, setRefresh] = useState(0),
    [marketBusy, setMarketBusy] = useState(true),
    [chartBusy, setChartBusy] = useState(true),
    [detailBusy, setDetailBusy] = useState(true);
  const [view, setView] = useState<View>("overview"),
    [tab, setTab] = useState<Tab>("coins"),
    [filter, setFilter] = useState("all"),
    [chain, setChain] = useState("all"),
    [sort, setSort] = useState("cap"),
    [limit, setLimit] = useState(10);
  const [tradeFilter, setTradeFilter] = useState("all"),
    [exchangeFilter, setExchangeFilter] = useState("all");
  const [info, setInfo] = useState(false),
    [mobileMenu, setMobileMenu] = useState(false),
    [notice, setNotice] = useState(""),
    [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null),
    dialogRef = useRef<HTMLDialogElement>(null),
    infoTrigger = useRef<HTMLElement | null>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuWasOpen = useRef(false);
  const lastChartKey = useRef("");
  const lastDetailId = useRef("");
  const rate =
    global.data.total_market_cap.idr / global.data.total_market_cap.usd;
  useEffect(() => {
    try {
      localStorage.setItem("ehs-watchlist-v1", JSON.stringify(saved));
    } catch {
      setNotice(
        "Penyimpanan browser tidak tersedia. Pantauan hanya bertahan selama sesi ini.",
      );
    }
  }, [saved]);
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) setRefresh((v) => v + 1);
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const a = new AbortController();
    setMarketBusy(true);
    void Promise.all([getMarkets(a.signal), getGlobal(a.signal)]).then(
      ([m, g]) => {
        if (a.signal.aborted) return;
        setMarkets(m);
        setGlobal(g);
        setMarketBusy(false);
        setSelected((c) => m.data.find((i) => i.id === c.id) ?? c);
        setSaved((current) =>
          current.map(
            (c) =>
              m.data.find(
                (i) => i.id === c.id && i.provenance?.status === "live",
              ) ?? c,
          ),
        );
        // Saved coins outside the top 50 need their own price refresh, even when
        // another coin is selected. Match current state so removal stays removed.
        const extraCoins = new Map([...saved, selected].map((c) => [c.id, c]));
        for (const c of extraCoins.values()) {
          if (
            m.data.some((i) => i.id === c.id && i.provenance?.status === "live")
          )
            continue;
          void hydrateCoin(c, a.signal, true)
            .catch(
              (): Coin => ({
                ...c,
                provenance: c.provenance && {
                  ...c.provenance,
                  status: "snapshot",
                },
              }),
            )
            .then((c) => {
              if (a.signal.aborted) return;
              setSelected((current) => (current.id === c.id ? c : current));
              setSaved((current) =>
                current.map((i) => (i.id === c.id ? c : i)),
              );
            });
        }
      },
    );
    return () => a.abort();
  }, [refresh]);
  useEffect(() => {
    const a = new AbortController();
    const key = `${selected.id}:${period}`;
    if (lastChartKey.current !== key)
      setChart(initialCandles(selected.id, period));
    lastChartKey.current = key;
    setChartBusy(true);
    void getCandles(selected, period, undefined, a.signal).then((r) => {
      if (!a.signal.aborted) {
        setChart(r);
        setChartBusy(false);
      }
    });
    return () => a.abort();
  }, [selected.id, period, refresh]); // Selection identity, rather than polling price changes, controls this request.
  useEffect(() => {
    const a = new AbortController();
    if (lastDetailId.current !== selected.id) {
      setStats(initialStats(selected));
      setTrades(null);
      setExchanges(null);
      setDetailBusy(true);
    }
    lastDetailId.current = selected.id;
    void getTokenStats(selected, a.signal)
      .catch(
        (): Resource<TokenStats> => ({
          ...initialStats(selected),
          status: "error",
          note: "Data on-chain belum tersedia. Coba perbarui data.",
        }),
      )
      .then(async (r) => {
        if (a.signal.aborted) return;
        setStats(r);
        if (selected.dex) {
          const p =
            r.data.pairs.find((p) => p.pairAddress === selected.dex?.pair) ??
            r.data.pairs[0];
          if (p)
            setSelected((current) =>
              current.id === selected.id
                ? {
                    ...pairCoin(p),
                    provenance: {
                      source: "DEX Screener",
                      status: r.status === "live" ? "live" : "snapshot",
                      at: r.at,
                    },
                  }
                : current,
            );
        }
        const [t, e] = await Promise.all([
          getTrades(selected, r.data.pool, a.signal),
          getExchanges(selected, r, a.signal),
        ]);
        if (a.signal.aborted) return;
        setTrades(t);
        setExchanges(e);
        setDetailBusy(false);
      });
    return () => a.abort();
  }, [selected.id, refresh]);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (info && !dialog?.open) {
      infoTrigger.current = document.activeElement as HTMLElement;
      dialog?.showModal();
    } else if (!info && dialog?.open) {
      dialog.close();
      infoTrigger.current?.focus();
    }
  }, [info]);
  useEffect(() => {
    if (mobileMenu) {
      menuWasOpen.current = true;
      sidebarRef.current
        ?.querySelector<HTMLButtonElement>(".drawer-close")
        ?.focus();
    } else if (menuWasOpen.current) {
      document.querySelector<HTMLButtonElement>(".mobile-menu-button")?.focus();
      menuWasOpen.current = false;
    }
  }, [mobileMenu]);
  useEffect(() => {
    function shortcut(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") setMobileMenu(false);
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  function toggleSave(c: Coin) {
    const isSaved = saved.some((i) => i.id === c.id);
    setSaved((s) => (isSaved ? s.filter((i) => i.id !== c.id) : [...s, c]));
    setNotice(
      `${c.name} ${isSaved ? "dihapus dari" : "ditambahkan ke"} pantauan.`,
    );
  }
  async function selectCoin(c: Coin) {
    setSelected(c);
    setPeriod("1");
    setNotice(`Menampilkan analisis ${c.name}.`);
    try {
      const complete = await hydrateCoin(c);
      setSelected((current) => (current.id === c.id ? complete : current));
    } catch {
      setNotice(`Harga ${c.name} belum tersedia. Coba perbarui data.`);
    }
  }
  function navigate(v: View) {
    setTab("coins");
    setView(v);
    setMobileMenu(false);
    setFilter("all");
    setChain("all");
    setLimit(10);
    if (v === "dex") {
      inputRef.current?.focus();
      setNotice("Cari nama atau kontrak untuk menjelajahi token DEX.");
    }
  }
  async function copyAddress() {
    if (!stats.data.address) return;
    try {
      await navigator.clipboard.writeText(stats.data.address);
      setCopied(true);
      setNotice("Alamat kontrak disalin.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setNotice(
        "Alamat belum tersalin. Pilih dan salin alamat kontrak yang ditampilkan.",
      );
    }
  }
  const allCoins = [...markets.data];
  if (!allCoins.some((c) => c.id === selected.id)) allCoins.push(selected);
  const savedResolved = saved.map((c) => {
    const current = allCoins.find((i) => i.id === c.id);
    if (!current) return c;
    if (current.provenance?.status !== c.provenance?.status)
      return c.provenance?.status === "live" ? c : current;
    return Date.parse(c.provenance?.at ?? "") >
      Date.parse(current.provenance?.at ?? "")
      ? c
      : current;
  });
  let rows = (
    view === "watchlist"
      ? savedResolved
      : view === "dex"
        ? allCoins.filter((c) => c.dex)
        : allCoins
  ).filter(
    (c) =>
      (filter === "all" ||
        (filter === "up" && (c.price_change_percentage_24h ?? 0) > 0) ||
        (filter === "down" && (c.price_change_percentage_24h ?? 0) < 0)) &&
      (chain === "all" || c.dex?.chain === chain),
  );
  rows = [...rows].sort((a, b) =>
    sort === "price"
      ? (b.current_price ?? -1) - (a.current_price ?? -1)
      : sort === "change"
        ? (b.price_change_percentage_24h ?? -Infinity) -
          (a.price_change_percentage_24h ?? -Infinity)
        : (b.market_cap ?? -1) - (a.market_cap ?? -1),
  );
  const displayedRows = rows.slice(0, limit);
  const freshRows = displayedRows.filter(
    (c) => c.provenance?.status === "live",
  ).length;
  const snapshotRows = displayedRows.filter(
    (c) => c.provenance?.status === "snapshot",
  ).length;
  const unavailableRows = displayedRows.length - freshRows - snapshotRows;
  const featured = ["bitcoin", "ethereum", "solana", "pepe"]
    .map(
      (id) =>
        allCoins.find((c) => c.id === id) ??
        initialCoins.find((c) => c.id === id)!,
    )
    .filter(Boolean);
  const totalBuys = (stats.data.buys ?? 0) + (stats.data.sells ?? 0),
    buyPercent = totalBuys ? ((stats.data.buys ?? 0) / totalBuys) * 100 : 0;
  const selectedSaved = saved.some((c) => c.id === selected.id);
  const shownTrades = (trades?.data ?? [])
    .filter((t) => tradeFilter === "all" || t.side === tradeFilter)
    .slice(0, 20);
  const shownExchanges = (exchanges?.data ?? [])
    .filter((e) => exchangeFilter === "all" || e.kind === exchangeFilter)
    .slice(0, 15);
  return (
    <>
      <a className="skip-link" href="#main">
        Lewati ke konten
      </a>
      <aside
        ref={sidebarRef}
        className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}
        aria-label="Navigasi utama"
        role={mobileMenu ? "dialog" : undefined}
        aria-modal={mobileMenu ? true : undefined}
        onKeyDown={(e) => {
          if (!mobileMenu || e.key !== "Tab") return;
          const items = Array.from(
            e.currentTarget.querySelectorAll<HTMLElement>(
              "a[href],button:not(:disabled)",
            ),
          ).filter((el) => el.getClientRects().length);
          const first = items[0],
            last = items[items.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
          if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }}
      >
        <Brand onHome={() => navigate("overview")} />
        {mobileMenu && (
          <button
            className="icon-button drawer-close"
            type="button"
            aria-label="Tutup menu navigasi"
            onClick={() => setMobileMenu(false)}
          >
            <X size={20} />
          </button>
        )}
        <div className="sidebar-nav">
          <p className="nav-caption">Ruang pasar</p>
          <nav>
            <button
              type="button"
              className={view === "overview" ? "nav-item active" : "nav-item"}
              onClick={() => navigate("overview")}
              aria-current={view === "overview" ? "page" : undefined}
            >
              <LayoutDashboard size={19} />
              Ringkasan
              <span className="active-marker" />
            </button>
            <button
              type="button"
              className={view === "watchlist" ? "nav-item active" : "nav-item"}
              onClick={() => navigate("watchlist")}
              aria-current={view === "watchlist" ? "page" : undefined}
            >
              <Star size={19} />
              Pantauan<span className="nav-count">{saved.length}</span>
            </button>
            <button
              type="button"
              className={view === "dex" ? "nav-item active" : "nav-item"}
              onClick={() => navigate("dex")}
              aria-current={view === "dex" ? "page" : undefined}
            >
              <Globe2 size={19} />
              Jelajahi DEX
              <ArrowUpRight size={15} className="nav-end" />
            </button>
          </nav>
        </div>
        <div className="sidebar-bottom">
          <div className="network-art" aria-hidden="true">
            <svg viewBox="0 0 180 90">
              <g stroke="currentColor" fill="none">
                <path d="M18 72L46 30l42 40 34-55 40 48M18 72l70-2 74-7M46 30l76-15M46 30l116 33" />
                {[
                  [18, 72],
                  [46, 30],
                  [88, 70],
                  [122, 15],
                  [162, 63],
                ].map(([x, y]) => (
                  <circle key={x} cx={x} cy={y} r="4" fill="currentColor" />
                ))}
              </g>
            </svg>
          </div>
          <span className="muted">API publik tanpa akun.</span>
          <button
            type="button"
            className="nav-item help-link"
            onClick={() => {
              setInfo(true);
              setMobileMenu(false);
            }}
          >
            <CircleHelp size={18} />
            Tentang data
            <ArrowUpRight size={15} />
          </button>
          <div className="sidebar-footer">
            <span className="status-dot" />
            Sumber data publik
          </div>
        </div>
      </aside>
      {mobileMenu && (
        <button
          className="menu-backdrop"
          tabIndex={-1}
          aria-label="Tutup navigasi"
          type="button"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <div className="workspace" inert={mobileMenu}>
        <header className="topbar">
          <div className="mobile-brand">
            <Brand onHome={() => navigate("overview")} />
          </div>
          <div className="breadcrumb">
            <span>Terminal</span>
            <span className="muted">/</span>
            <strong>
              {view === "watchlist"
                ? "Pantauan"
                : view === "dex"
                  ? "Jelajahi DEX"
                  : "Ringkasan pasar"}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="automatic">
              <span className="status-dot" />
              Pembaruan tiap 60 dtk
            </span>
            <div className="currency-picker">
              <Globe2 size={14} />
              <label className="sr-only" htmlFor="currency">
                Mata uang
              </label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
              >
                <option value="USD">USD</option>
                <option value="IDR">IDR</option>
              </select>
            </div>
            <button
              className="icon-button mobile-menu-button"
              type="button"
              aria-label={mobileMenu ? "Tutup menu" : "Buka menu"}
              aria-expanded={mobileMenu}
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              {mobileMenu ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>
        <main id="main">
          <section className="page-heading">
            <div>
              <div className="title-row">
                <h1>
                  {view === "watchlist"
                    ? "Pantauan koin"
                    : view === "dex"
                      ? "Jelajahi DEX"
                      : "Pasar kripto"}
                </h1>
                <span className="version-tag">Terminal</span>
              </div>
              <p>
                {view === "watchlist"
                  ? "Koin pilihanmu, tersimpan di browser ini."
                  : view === "dex"
                    ? "Temukan token lintas jaringan melalui alamat kontrak."
                    : "Pantau harga, likuiditas, dan aktivitas pasar kripto."}
              </p>
            </div>
            <Search
              onSelect={(c) => {
                void selectCoin(c);
              }}
              inputRef={inputRef}
            />
          </section>
          <div className="market-status">
            <span>
              <DataStatus resource={global} />
              <span className="source-label">via CoinGecko</span>
            </span>
            <button
              className="text-button refresh-button"
              type="button"
              disabled={marketBusy}
              onClick={() => setRefresh((v) => v + 1)}
            >
              <RefreshCw size={13} className={marketBusy ? "refreshing" : ""} />
              {marketBusy ? "Memperbarui…" : "Perbarui data"}
            </button>
          </div>
          <section className="global-stats" aria-label="Ringkasan pasar global">
            <div className="global-stat">
              <span>
                <span className="stat-icon">
                  <BarChart3 size={16} />
                </span>
                Kapitalisasi pasar
              </span>
              <div>
                <strong>
                  {compact(global.data.total_market_cap.usd, currency, rate)}
                </strong>
                <Change
                  value={global.data.market_cap_change_percentage_24h_usd}
                />
              </div>
              <small>Seluruh pasar kripto</small>
            </div>
            <div className="global-stat">
              <span>
                <span className="stat-icon">
                  <ArrowDownUp size={16} />
                </span>
                Volume 24 jam
              </span>
              <div>
                <strong>
                  {compact(global.data.total_volume.usd, currency, rate)}
                </strong>
              </div>
              <small>Volume perdagangan global</small>
            </div>
            <div className="global-stat">
              <span>
                <span className="stat-icon">
                  <CoinIcon coin={initialCoins[0]} small />
                </span>
                Dominasi Bitcoin
              </span>
              <div>
                <strong>
                  {number(global.data.market_cap_percentage.btc)}
                  <span className="value-unit">%</span>
                </strong>
                <span className="dominance-bar" aria-hidden="true">
                  <i
                    style={{
                      width: `${global.data.market_cap_percentage.btc}%`,
                    }}
                  />
                </span>
              </div>
              <small>Dari kapitalisasi pasar</small>
            </div>
            <div className="global-stat">
              <span>
                <span className="stat-icon">
                  <Globe2 size={16} />
                </span>
                Koin aktif
              </span>
              <div>
                <strong>
                  {number(global.data.active_cryptocurrencies, 0)}
                </strong>
                <span className="neutral-badge">
                  {number(global.data.markets, 0)} bursa
                </span>
              </div>
              <small>Terindeks oleh CoinGecko</small>
            </div>
          </section>
          <div className="analytics-grid">
            <Chart
              coin={selected}
              resource={chart}
              loading={chartBusy}
              period={period}
              onPeriod={setPeriod}
              currency={currency}
              rate={rate}
              saved={selectedSaved}
              onSave={() => toggleSave(selected)}
              onChoose={() => {
                inputRef.current?.focus();
                window.scrollTo({ top: 0, behavior: "instant" });
              }}
              onRetry={() => setRefresh((v) => v + 1)}
            />
            <aside className="analysis-side">
              <section className="panel spotlight">
                <div className="section-title">
                  <h2>
                    <TrendingUp size={18} />
                    Sorotan koin
                  </h2>
                  <span className="muted">24 jam</span>
                </div>
                <ul>
                  {featured.map((c) => (
                    <li key={c.id}>
                      <button
                        className={`featured-coin ${selected.id === c.id ? "current" : ""}`}
                        type="button"
                        onClick={() => {
                          void selectCoin(c);
                        }}
                      >
                        <CoinIcon coin={c} small />
                        <span className="featured-name">
                          <strong>{c.name}</strong>
                          <span className="muted">
                            {c.symbol.toUpperCase()}
                            {c.provenance?.status === "snapshot"
                              ? " · Snapshot"
                              : ""}
                          </span>
                        </span>
                        <span className="featured-price">
                          <strong>
                            {price(c.current_price, currency, rate)}
                          </strong>
                          <Change value={c.price_change_percentage_24h} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  className="text-button spotlight-link"
                  type="button"
                  onClick={() => {
                    setTab("coins");
                    document
                      .getElementById("market-list")
                      ?.scrollIntoView({ behavior: "instant", block: "start" });
                  }}
                >
                  Lihat seluruh koin
                  <ArrowRight size={15} />
                </button>
              </section>
              <section className="panel token-stats">
                <div className="section-title">
                  <h2>
                    <Activity size={17} />
                    Data on-chain
                  </h2>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="Pelajari cakupan data on-chain"
                    onClick={() => setInfo(true)}
                  >
                    <CircleHelp size={16} />
                  </button>
                </div>
                <div className="token-stats-rows">
                  <div>
                    <span>Jaringan</span>
                    <strong>
                      {stats.data.chain ??
                        (stats.data.isNative
                          ? selected.name
                          : "Belum diketahui")}
                    </strong>
                  </div>
                  <div>
                    <span>Likuiditas pool</span>
                    <strong>
                      {stats.data.liquidity == null
                        ? "Tidak tersedia"
                        : compact(stats.data.liquidity, currency, rate)}
                    </strong>
                  </div>
                  <div>
                    <span>Holder token</span>
                    <strong>
                      {stats.data.holders == null
                        ? "Tidak tersedia"
                        : number(stats.data.holders, 0)}
                    </strong>
                  </div>
                </div>
                {stats.data.address ? (
                  <details className="contract-details">
                    <summary>
                      Alamat kontrak
                      <ChevronDown size={13} />
                    </summary>
                    <code>{stats.data.address}</code>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => {
                        void copyAddress();
                      }}
                    >
                      {copied ? <Check size={13} /> : <Copy size={13} />}Salin
                      alamat
                    </button>
                  </details>
                ) : (
                  <p className="native-note">
                    {stats.data.isNative
                      ? "Koin native tidak memiliki kontrak token. Cari token seperti PEPE untuk melihat holder dan likuiditas."
                      : "Kontrak koin ini belum tersedia. Cari alamat kontraknya untuk melihat holder dan likuiditas."}
                  </p>
                )}
                {totalBuys > 0 && (
                  <div className="buy-sell">
                    <div>
                      <span>Beli {number(stats.data.buys, 0)}</span>
                      <span>Jual {number(stats.data.sells, 0)}</span>
                    </div>
                    <div className="buy-sell-bar">
                      <i style={{ width: `${buyPercent}%` }} />
                    </div>
                    <small>Transaksi pool utama · 24 jam</small>
                  </div>
                )}
                {stats.data.address && (
                  <div className="onchain-source">
                    <DataStatus resource={stats} compact />
                    <span>Pool paling likuid</span>
                  </div>
                )}
              </section>
            </aside>
          </div>
          <section
            className="panel market-section"
            id="market-list"
            aria-label="Data pasar terperinci"
          >
            <div
              className="market-tabs"
              role="group"
              aria-label="Tampilan data"
            >
              <button
                type="button"
                className={tab === "coins" ? "active" : ""}
                aria-pressed={tab === "coins"}
                onClick={() => setTab("coins")}
              >
                <BarChart3 size={17} />
                {view === "watchlist"
                  ? "Daftar pantauan"
                  : view === "dex"
                    ? "Token DEX"
                    : "Daftar koin"}
                <span className="tab-count">{rows.length}</span>
              </button>
              <button
                type="button"
                className={tab === "trades" ? "active" : ""}
                aria-pressed={tab === "trades"}
                onClick={() => setTab("trades")}
              >
                <ArrowDownUp size={17} />
                Riwayat transaksi
              </button>
              <button
                type="button"
                className={tab === "exchanges" ? "active" : ""}
                aria-pressed={tab === "exchanges"}
                onClick={() => setTab("exchanges")}
              >
                <Globe2 size={17} />
                Bursa CEX / DEX
              </button>
            </div>
            {tab === "coins" ? (
              <>
                <div className="table-toolbar">
                  <div
                    className="filter-pills"
                    role="group"
                    aria-label="Filter perubahan harga"
                  >
                    {[
                      ["all", "Semua koin"],
                      ["up", "Naik"],
                      ["down", "Turun"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={filter === value ? "active" : ""}
                        aria-pressed={filter === value}
                        onClick={() => {
                          setFilter(value);
                          setLimit(10);
                        }}
                      >
                        {value === "up" && <TrendingUp size={14} />} {label}
                      </button>
                    ))}
                  </div>
                  <div className="table-selects">
                    <label className="filter-select">
                      <SlidersHorizontal size={14} />
                      <span className="sr-only">Urutkan koin</span>
                      <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="cap">Kapitalisasi</option>
                        <option value="price">Harga tertinggi</option>
                        <option value="change">Kenaikan 24 jam</option>
                      </select>
                    </label>
                    {view === "dex" && (
                      <label className="filter-select">
                        <span className="sr-only">Filter jaringan</span>
                        <select
                          value={chain}
                          onChange={(e) => setChain(e.target.value)}
                        >
                          <option value="all">Semua jaringan</option>
                          {[
                            ...new Set(
                              allCoins.flatMap((c) =>
                                c.dex ? [c.dex.chain] : [],
                              ),
                            ),
                          ].map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                </div>
                {rows.length ? (
                  <>
                    <div className="table-scroll coin-table-wrap">
                      <table className="coin-table">
                        <thead>
                          <tr>
                            <th className="save-cell">
                              <span className="sr-only">Pantauan</span>
                              <Star size={13} />
                            </th>
                            <th className="rank-cell">#</th>
                            <th>Koin</th>
                            <th>Harga</th>
                            <th>
                              24 jam
                              <ArrowDown size={12} />
                            </th>
                            <th className="hide-mobile">Kapitalisasi pasar</th>
                            <th className="hide-tablet">Volume 24 jam</th>
                            <th className="hide-mobile">7 hari terakhir</th>
                            <th className="go-cell">
                              <span className="sr-only">Analisis</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayedRows.map((c, i) => (
                            <tr
                              key={c.id}
                              className={
                                selected.id === c.id ? "selected-row" : ""
                              }
                            >
                              <td className="save-cell">
                                <SaveButton
                                  saved={saved.some((s) => s.id === c.id)}
                                  name={c.name}
                                  onClick={() => toggleSave(c)}
                                />
                              </td>
                              <td className="rank-cell muted">
                                {c.dex ? "•" : (c.market_cap_rank ?? i + 1)}
                              </td>
                              <td>
                                <button
                                  className="table-coin"
                                  type="button"
                                  onClick={() => {
                                    void selectCoin(c);
                                    document
                                      .querySelector(".analytics-grid")
                                      ?.scrollIntoView({
                                        behavior: "instant",
                                        block: "start",
                                      });
                                  }}
                                >
                                  <CoinIcon coin={c} small />
                                  <span>
                                    <strong>{c.name}</strong>
                                    <span className="muted">
                                      {c.symbol.toUpperCase()}
                                      {c.dex ? ` · ${c.dex.chain}` : ""}
                                    </span>
                                  </span>
                                </button>
                              </td>
                              <td className="numeric">
                                <div className="coin-row-price">
                                  <span>
                                    {price(c.current_price, currency, rate)}
                                  </span>
                                  <DataStatus
                                    resource={
                                      c.provenance ?? {
                                        source: "Data tersimpan",
                                        status: "error",
                                        at: "",
                                      }
                                    }
                                    compact={c.provenance?.status === "live"}
                                  />
                                </div>
                              </td>
                              <td>
                                <Change value={c.price_change_percentage_24h} />
                              </td>
                              <td className="numeric hide-mobile">
                                {compact(c.market_cap, currency, rate)}
                              </td>
                              <td className="numeric hide-tablet">
                                {compact(c.total_volume, currency, rate)}
                              </td>
                              <td className="hide-mobile">
                                <Sparkline
                                  data={c.sparkline_in_7d?.price}
                                  positive={
                                    (c.price_change_percentage_7d_in_currency ??
                                      0) >= 0
                                  }
                                />
                              </td>
                              <td className="go-cell">
                                <button
                                  className="icon-button"
                                  type="button"
                                  onClick={() => {
                                    void selectCoin(c);
                                    document
                                      .querySelector(".analytics-grid")
                                      ?.scrollIntoView({
                                        behavior: "instant",
                                        block: "start",
                                      });
                                  }}
                                  aria-label={`Analisis ${c.name}`}
                                >
                                  <ArrowUpRight size={17} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="table-footer">
                      <span>
                        Menampilkan {Math.min(limit, rows.length)} dari{" "}
                        {rows.length} koin{" "}
                        <span className="table-data-status">
                          {[
                            freshRows ? `${freshRows} terbaru` : "",
                            snapshotRows ? `${snapshotRows} snapshot` : "",
                            unavailableRows
                              ? `${unavailableRows} belum tersedia`
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      {rows.length > limit ? (
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => setLimit((n) => n + 10)}
                        >
                          Tampilkan lebih banyak
                          <ChevronDown size={14} />
                        </button>
                      ) : (
                        <span className="muted">Harga dalam {currency}</span>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <SearchIcon size={28} />
                    <h3>
                      {view === "watchlist"
                        ? "Belum ada koin dalam pantauan"
                        : view === "dex"
                          ? "Temukan token DEX pertamamu"
                          : "Tidak ada koin untuk filter ini"}
                    </h3>
                    <p>
                      {view === "watchlist"
                        ? "Simpan koin dengan tombol bintang di daftar pasar."
                        : view === "dex"
                          ? "Cari nama token atau tempel alamat kontrak pada kolom pencarian."
                          : "Pilih semua koin untuk kembali ke daftar pasar."}
                    </p>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        if (view === "watchlist") navigate("overview");
                        else if (view === "dex") {
                          inputRef.current?.focus();
                          window.scrollTo({ top: 0 });
                        } else setFilter("all");
                      }}
                    >
                      {view === "watchlist"
                        ? "Jelajahi pasar"
                        : view === "dex"
                          ? "Cari token"
                          : "Tampilkan semua koin"}
                      <ArrowRight size={15} />
                    </button>
                  </div>
                )}
              </>
            ) : tab === "trades" ? (
              <>
                <div className="detail-table-heading">
                  <div>
                    <h2>Transaksi {selected.name}</h2>
                    <p>
                      {trades?.source ?? "Mengambil sumber"} · Sisi pengambil
                      order (taker) · Maks. 20 transaksi terbaru
                    </p>
                  </div>
                  <div
                    className="filter-pills"
                    role="group"
                    aria-label="Filter transaksi"
                  >
                    {[
                      ["all", "Semua"],
                      ["buy", "Beli"],
                      ["sell", "Jual"],
                    ].map(([v, label]) => (
                      <button
                        type="button"
                        key={v}
                        aria-pressed={tradeFilter === v}
                        className={tradeFilter === v ? "active" : ""}
                        onClick={() => setTradeFilter(v)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {trades && (
                  <div className="table-resource">
                    <DataStatus resource={trades} />
                  </div>
                )}
                {detailBusy ? (
                  <div className="empty-state" role="status">
                    <RefreshCw size={24} />
                    <p>Memuat riwayat transaksi…</p>
                  </div>
                ) : shownTrades.length ? (
                  <div className="table-scroll">
                    <table className="trade-table">
                      <thead>
                        <tr>
                          <th>Waktu</th>
                          <th>Aksi</th>
                          <th>Harga</th>
                          <th>Jumlah {selected.symbol.toUpperCase()}</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shownTrades.map((t) => (
                          <tr key={t.id}>
                            <td>{dateTime(t.time)}</td>
                            <td>
                              <span
                                className={`trade-side ${t.side === "buy" ? "positive" : "negative"}`}
                              >
                                {t.side === "buy" ? (
                                  <ArrowUpRight size={14} />
                                ) : (
                                  <ArrowDown size={14} />
                                )}{" "}
                                {t.side === "buy" ? "Beli" : "Jual"}
                              </span>
                            </td>
                            <td>{price(t.price, currency, rate)}</td>
                            <td>{number(t.amount, 6)}</td>
                            <td>{price(t.total, currency, rate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>
                      {trades?.note ?? "Belum ada transaksi dengan filter ini."}
                    </p>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => {
                        setTradeFilter("all");
                        setRefresh((v) => v + 1);
                      }}
                    >
                      Coba lagi
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="detail-table-heading">
                  <div>
                    <h2>Pasar {selected.name}</h2>
                    <p>
                      Pasangan yang dilaporkan penyedia. Volume bukan
                      likuiditas.
                    </p>
                  </div>
                  <div
                    className="filter-pills"
                    role="group"
                    aria-label="Filter jenis bursa"
                  >
                    {["all", "CEX", "DEX"].map((v) => (
                      <button
                        type="button"
                        key={v}
                        aria-pressed={exchangeFilter === v}
                        className={exchangeFilter === v ? "active" : ""}
                        onClick={() => setExchangeFilter(v)}
                      >
                        {v === "all" ? "Semua" : v}
                      </button>
                    ))}
                  </div>
                </div>
                {exchanges && (
                  <div className="table-resource">
                    <DataStatus resource={exchanges} />
                    {exchanges.note && <span>{exchanges.note}</span>}
                  </div>
                )}
                {detailBusy ? (
                  <div className="empty-state" role="status">
                    <RefreshCw size={24} />
                    <p>Memuat daftar bursa…</p>
                  </div>
                ) : shownExchanges.length ? (
                  <div className="table-scroll">
                    <table className="exchange-table">
                      <thead>
                        <tr>
                          <th>Bursa</th>
                          <th>Jenis</th>
                          <th>Pasangan</th>
                          <th>Harga</th>
                          <th>Volume 24 jam</th>
                          <th>Pasar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shownExchanges.map((e, i) => (
                          <tr key={`${e.name}-${e.pair}-${i}`}>
                            <td>
                              <strong>{e.name}</strong>
                            </td>
                            <td>
                              <span className="neutral-badge">{e.kind}</span>
                            </td>
                            <td className="pair-name">{e.pair}</td>
                            <td>{price(e.price, currency, rate)}</td>
                            <td>{compact(e.volume, currency, rate)}</td>
                            <td>
                              {safeUrl(e.url) ? (
                                <a
                                  href={safeUrl(e.url)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="external-link"
                                  aria-label={`Lihat ${e.pair} di ${e.name}, tab baru`}
                                >
                                  Lihat
                                  <ExternalLink size={13} />
                                </a>
                              ) : (
                                <span className="muted">Tidak tersedia</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <p>
                      {exchangeFilter === "all"
                        ? "Daftar pasar belum tersedia. Coba perbarui data."
                        : exchangeFilter === "CEX" &&
                            selected.dex &&
                            !exchanges?.cexAvailable
                          ? "Cakupan CEX belum tersedia untuk kontrak ini"
                          : `Belum ada pasar ${exchangeFilter} dari sumber untuk ${selected.name}.`}
                    </p>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => {
                        setExchangeFilter("all");
                        setRefresh((v) => v + 1);
                      }}
                    >
                      Muat semua pasar
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
          <footer className="page-footer">
            <button
              className="text-button"
              type="button"
              onClick={() => setInfo(true)}
            >
              Sumber & cakupan data
              <ArrowUpRight size={13} />
            </button>
            <span className="footer-brand">
              Everted Hand Swarm <span>© 2026</span>
            </span>
          </footer>
        </main>
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {notice}
      </div>
      <dialog
        ref={dialogRef}
        className="info-dialog"
        onCancel={() => setInfo(false)}
        onClose={() => setInfo(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setInfo(false);
        }}
      >
        <div className="dialog-header">
          <h2>Kenali sumber datamu</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Tutup informasi data"
            onClick={() => setInfo(false)}
          >
            <X size={20} />
          </button>
        </div>
        <p>
          Everted Hand Swarm membaca API publik tanpa akun. Pembaruan otomatis
          setiap 60 detik saat halaman aktif; ini bukan feed tick per tick.
        </p>
        <ul className="source-list">
          <li>
            <Database size={20} />
            <div>
              <a
                href="https://www.coingecko.com/en/api"
                target="_blank"
                rel="noreferrer"
              >
                CoinGecko <ExternalLink size={12} />
              </a>
              <p>
                Harga agregat, kapitalisasi, volume, dominasi, dan daftar pasar.
                Daftar awal hingga 50 koin; pencarian menjangkau katalog lebih
                luas.
              </p>
            </div>
          </li>
          <li>
            <BarChart3 size={20} />
            <div>
              <a
                href="https://docs.cdp.coinbase.com/exchange/docs/welcome"
                target="_blank"
                rel="noreferrer"
              >
                Coinbase Exchange <ExternalLink size={12} />
              </a>
              <p>
                Candle dan transaksi pasangan USD yang didukung. Beli/jual
                mengikuti sisi taker, kebalikan dari sisi maker API.
              </p>
            </div>
          </li>
          <li>
            <Globe2 size={20} />
            <div>
              <a
                href="https://dexscreener.com"
                target="_blank"
                rel="noreferrer"
              >
                DEX Screener & GeckoTerminal <ExternalLink size={12} />
              </a>
              <p>
                Pencarian kontrak, pool, candle, dan swap DEX. Likuiditas
                merujuk satu pool utama; kapitalisasi tidak diganti dengan FDV.
                Cakupan bergantung jaringan dan indeks API.
              </p>
            </div>
          </li>
          <li>
            <Activity size={20} />
            <div>
              <a href="https://blockscout.com" target="_blank" rel="noreferrer">
                Blockscout <ExternalLink size={12} />
              </a>
              <p>
                Jumlah alamat pemegang token pada Ethereum, Base, Optimism,
                Arbitrum, dan Polygon bila tersedia. Bukan jumlah orang. Holder
                native dan jaringan lain ditandai tidak tersedia.
              </p>
            </div>
          </li>
        </ul>
        <div className="source-explainer">
          <Radio size={17} />
          <p>
            <strong>Terbaru</strong> berarti permintaan API berhasil.{" "}
            <strong>Snapshot</strong> adalah rekaman nyata bertanggal{" "}
            {dateTime(snapshotAt)}. Waktu pada label adalah waktu pengambilan;
            penyedia dapat memiliki jeda. Setiap modul memiliki status sumber
            sendiri.
          </p>
        </div>
        <p className="muted">
          Konversi IDR memakai rasio USD/IDR pada data global CoinGecko.
          Pantauan disimpan hanya di browser ini. Simbol dapat digunakan banyak
          token: periksa jaringan dan kontraknya.
        </p>
        <button
          className="secondary-button"
          type="button"
          onClick={() => setInfo(false)}
        >
          Kembali ke pasar
          <ArrowRight size={16} />
        </button>
      </dialog>
    </>
  );
}
