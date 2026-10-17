import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  CandlestickChart,
  ChartNoAxesCombined,
  ChevronDown,
  Maximize2,
} from "lucide-react";
import { compact, dateTime, number, price, type Currency } from "../format";
import type { Candle, Coin, Period, Resource } from "../types";
import { Change, CoinIcon, DataStatus, SaveButton } from "./Shared";
interface Props {
  coin: Coin;
  resource: Resource<Candle[]> | null;
  loading: boolean;
  period: Period;
  onPeriod: (p: Period) => void;
  currency: Currency;
  rate: number;
  saved: boolean;
  onSave: () => void;
  onChoose: () => void;
  onRetry: () => void;
}
export default function Chart({
  coin,
  resource,
  loading,
  period,
  onPeriod,
  currency,
  rate,
  saved,
  onSave,
  onChoose,
  onRetry,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(800);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) =>
      setChartWidth(Math.max(260, Math.round(entries[0].contentRect.width))),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const [mode, setMode] = useState<"candle" | "line">("candle");
  const [hover, setHover] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const candles = resource?.data ?? [];
  const w = chartWidth,
    h = chartWidth < 500 ? 210 : 270,
    left = 8,
    right = chartWidth < 500 ? 72 : 88,
    top = 18,
    bottom = 32;
  const plotW = w - left - right,
    plotH = h - top - bottom;
  const min = candles.length ? Math.min(...candles.map((c) => c.low)) : 0,
    max = candles.length ? Math.max(...candles.map((c) => c.high)) : 1;
  const padding = (max - min) * 0.1 || max * 0.01 || 1,
    lo = min - padding,
    hi = max + padding;
  const y = (n: number) => top + ((hi - n) / (hi - lo)) * plotH;
  const x = (i: number) =>
    left + ((i + 0.5) / Math.max(candles.length, 1)) * plotW;
  const current =
    hover == null
      ? candles[candles.length - 1]
      : candles[Math.min(hover, candles.length - 1)];
  const line = candles
    .map((c, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(c.close)}`)
    .join(" ");
  const last = candles[candles.length - 1];
  const chartLabel = `Grafik ${coin.name}, ${period === "1" ? "24 jam" : period + " hari"}. ${candles.length} candle. Gunakan panah kiri dan kanan untuk membaca candle. Harga sumbu di bawah 0,01 memakai notasi ilmiah.`;
  const candleNum = (n: number) => {
    const v = n * (currency === "IDR" ? rate : 1);
    return number(v, v < 0.01 ? 9 : currency === "IDR" ? 0 : 2);
  };
  function onKey(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setHover((i) =>
        Math.max(
          0,
          Math.min(
            candles.length - 1,
            (i ?? candles.length - 1) + (e.key === "ArrowLeft" ? -1 : 1),
          ),
        ),
      );
    }
    if (e.key === "Escape") setHover(null);
  }
  return (
    <section
      className={`panel chart-panel ${expanded ? "expanded" : ""}`}
      aria-label={`Analisis ${coin.name}`}
    >
      <div className="chart-heading">
        <button
          className="coin-select"
          type="button"
          onClick={onChoose}
          aria-label={`Pilih koin. Saat ini ${coin.name}`}
        >
          <CoinIcon coin={coin} />
          <span>
            <strong>{coin.name}</strong>
            <span className="muted coin-symbol">
              {coin.symbol.toUpperCase()} / {currency}
            </span>
          </span>
          <ChevronDown size={16} />
        </button>
        <div className="chart-actions">
          <SaveButton saved={saved} name={coin.name} onClick={onSave} />
          <button
            className="icon-button expand-chart"
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-pressed={expanded}
            aria-label={expanded ? "Perkecil grafik" : "Perbesar grafik"}
          >
            <Maximize2 size={17} />
          </button>
        </div>
      </div>
      <div className="price-heading">
        <strong className="coin-price">
          {price(coin.current_price, currency, rate)}
        </strong>
        <Change value={coin.price_change_percentage_24h} />
        <span className="muted price-period">24 jam</span>
      </div>
      {coin.provenance?.status === "snapshot" && (
        <p className="price-snapshot">
          Harga {coin.provenance.source} · Snapshot{" "}
          {dateTime(coin.provenance.at)}
        </p>
      )}
      <div className="chart-toolbar">
        <div
          className="segmented periods"
          role="group"
          aria-label="Rentang grafik"
        >
          {(["1", "7", "30"] as Period[]).map((p) => (
            <button
              type="button"
              aria-pressed={period === p}
              className={period === p ? "active" : ""}
              onClick={() => {
                setHover(null);
                onPeriod(p);
              }}
              key={p}
            >
              {p === "1" ? "24 jam" : `${p} hari`}
            </button>
          ))}
        </div>
        <div className="chart-kind" role="group" aria-label="Jenis grafik">
          <button
            className={`icon-button ${mode === "line" ? "selected" : ""}`}
            type="button"
            onClick={() => setMode("line")}
            aria-label="Grafik garis"
            aria-pressed={mode === "line"}
          >
            <ChartNoAxesCombined size={17} />
          </button>
          <button
            className={`icon-button ${mode === "candle" ? "selected" : ""}`}
            type="button"
            onClick={() => setMode("candle")}
            aria-label="Grafik candle"
            aria-pressed={mode === "candle"}
          >
            <CandlestickChart size={17} />
          </button>
        </div>
      </div>
      <div
        className="ohlc"
        aria-live="off"
        aria-label={`OHLC dalam ${currency}`}
      >
        {current ? (
          <>
            <span>
              Buka <b>{candleNum(current.open)}</b>
            </span>
            <span>
              Tinggi <b>{candleNum(current.high)}</b>
            </span>
            <span>
              Rendah <b>{candleNum(current.low)}</b>
            </span>
            <span>
              Tutup{" "}
              <b
                className={
                  current.close >= current.open ? "positive" : "negative"
                }
              >
                {candleNum(current.close)}
              </b>
            </span>
          </>
        ) : (
          <span>
            {loading ? "Memuat candle…" : "Data candle belum tersedia"}
          </span>
        )}
      </div>
      <div
        ref={canvasRef}
        className={`chart-canvas ${loading ? "loading-chart" : ""}`}
        aria-busy={loading}
      >
        {candles.length > 0 ? (
          <svg
            viewBox={`0 0 ${w} ${h}`}
            role="img"
            aria-label={chartLabel}
            tabIndex={0}
            onKeyDown={onKey}
            onMouseMove={(e) => {
              const b = e.currentTarget.getBoundingClientRect();
              setHover(
                Math.max(
                  0,
                  Math.min(
                    candles.length - 1,
                    Math.floor(
                      ((((e.clientX - b.left) / b.width) * w - left) / plotW) *
                        candles.length,
                    ),
                  ),
                ),
              );
            }}
            onMouseLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--color-positive)"
                  stopOpacity=".16"
                />
                <stop
                  offset="100%"
                  stopColor="var(--color-positive)"
                  stopOpacity="0"
                />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3, 4].map((i) => {
              const v = lo + ((hi - lo) * i) / 4;
              return (
                <g key={i}>
                  <line
                    x1={left}
                    x2={w - right}
                    y1={y(v)}
                    y2={y(v)}
                    className="grid-line"
                  />
                  <text x={w - right + 12} y={y(v) + 4} className="axis-label">
                    {compact(v, currency, rate)}
                  </text>
                </g>
              );
            })}
            {mode === "line" ? (
              <>
                <path
                  d={`${line} L${x(candles.length - 1)} ${h - bottom} L${x(0)} ${h - bottom} Z`}
                  fill="url(#chart-fill)"
                />
                <path
                  d={line}
                  fill="none"
                  stroke="var(--color-positive)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            ) : (
              candles.map((c, i) => {
                const up = c.close >= c.open,
                  cw = Math.max(3, (plotW / candles.length) * 0.52);
                return (
                  <g key={c.time} className={up ? "candle-up" : "candle-down"}>
                    <line
                      x1={x(i)}
                      x2={x(i)}
                      y1={y(c.high)}
                      y2={y(c.low)}
                      stroke="currentColor"
                      strokeWidth="1.2"
                    />
                    <rect
                      x={x(i) - cw / 2}
                      y={Math.min(y(c.open), y(c.close))}
                      width={cw}
                      height={Math.max(1.5, Math.abs(y(c.open) - y(c.close)))}
                      fill="currentColor"
                      rx="1"
                    />
                    <rect
                      x={x(i) - cw / 2}
                      y={
                        h -
                        bottom -
                        (c.volume /
                          Math.max(...candles.map((d) => d.volume), 1)) *
                          38
                      }
                      width={cw}
                      height={
                        (c.volume /
                          Math.max(...candles.map((d) => d.volume), 1)) *
                        38
                      }
                      fill="currentColor"
                      opacity=".1"
                    />
                  </g>
                );
              })
            )}
            {last && (
              <g>
                <line
                  x1={left}
                  x2={w - right}
                  y1={y(last.close)}
                  y2={y(last.close)}
                  stroke="var(--color-positive)"
                  strokeDasharray="4 5"
                  strokeOpacity=".5"
                />
                <rect
                  x={w - right + 5}
                  y={y(last.close) - 11}
                  width={right - 8}
                  height="22"
                  rx="4"
                  fill="var(--color-accent)"
                />
                <text
                  x={w - right / 2}
                  y={y(last.close) + 4}
                  textAnchor="middle"
                  className="current-label"
                >
                  {compact(last.close, currency, rate)}
                </text>
              </g>
            )}
            {[0, 1, 2, 3, 4].map((i) => {
              const index = Math.round(((candles.length - 1) * i) / 4);
              return (
                <text
                  key={i}
                  x={x(index)}
                  y={h - 8}
                  className="axis-label"
                  textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"}
                >
                  {new Intl.DateTimeFormat(
                    "id-ID",
                    period === "1"
                      ? { hour: "2-digit", minute: "2-digit" }
                      : { day: "numeric", month: "short" },
                  ).format(new Date(candles[index].time * 1000))}
                </text>
              );
            })}
            {hover != null && current && (
              <g>
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1={top}
                  y2={h - bottom}
                  stroke="var(--color-text-muted)"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={x(hover)}
                  cy={y(current.close)}
                  r="4"
                  fill="var(--color-accent)"
                  stroke="var(--color-bg-surface)"
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>
        ) : (
          <div className="empty-chart">
            <CandlestickChart size={30} />
            <p>
              {loading
                ? "Mengambil grafik dari sumber…"
                : (resource?.note ?? "Pilih koin untuk melihat grafik.")}
            </p>
            {!loading && (
              <button type="button" className="text-button" onClick={onRetry}>
                Coba lagi
              </button>
            )}
          </div>
        )}
      </div>
      <div className="chart-source">
        <span>
          {resource?.source ?? "Memuat sumber"}
          {coin.dex ? ` · ${coin.dex.exchange}` : " · Harga USD"}
        </span>
        {loading ? (
          <span>Memperbarui…</span>
        ) : (
          resource && <DataStatus resource={resource} compact />
        )}
      </div>
      {resource?.status === "snapshot" && (
        <p className="snapshot-caption">
          Snapshot {dateTime(resource.at)}. Pembaruan langsung belum berhasil.
        </p>
      )}
      <div className="chart-metrics">
        <div>
          <span>Kapitalisasi pasar</span>
          <strong>{compact(coin.market_cap, currency, rate)}</strong>
        </div>
        <div>
          <span>Volume 24 jam</span>
          <strong>{compact(coin.total_volume, currency, rate)}</strong>
        </div>
        <div>
          <span>Tertinggi 24 jam</span>
          <strong>
            {price(
              coin.high_24h ?? (period === "1" && candles.length ? max : null),
              currency,
              rate,
            )}
          </strong>
        </div>
      </div>
      <details className="candle-data">
        <summary>Lihat data candle</summary>
        <p>Harga sumber dalam USD. Waktu mengikuti zona waktu perangkat.</p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Buka</th>
                <th>Tinggi</th>
                <th>Rendah</th>
                <th>Tutup</th>
              </tr>
            </thead>
            <tbody>
              {candles.map((c) => (
                <tr key={c.time}>
                  <td>{dateTime(new Date(c.time * 1000).toISOString())}</td>
                  {[c.open, c.high, c.low, c.close].map((v, i) => (
                    <td key={i}>{price(v)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
