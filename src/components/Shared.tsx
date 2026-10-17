import { ArrowDownLeft, ArrowUpRight, Clock3, Radio, Star } from "lucide-react";
import { localIds } from "../api";
import { dateTime, number } from "../format";
import type { Coin, Resource } from "../types";
export function CoinIcon({
  coin,
  small = false,
}: {
  coin: Coin;
  small?: boolean;
}) {
  const image = localIds.has(coin.id) ? `./coins/${coin.id}.png` : coin.image;
  return (
    <span className={`coin-icon ${small ? "small" : ""}`} aria-hidden="true">
      <span>{coin.symbol.slice(0, 1)}</span>
      {image && (
        <img
          src={image}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
    </span>
  );
}
export function Change({
  value,
  suffix = false,
}: {
  value: number | null | undefined;
  suffix?: boolean;
}) {
  if (value == null || !Number.isFinite(value))
    return <span className="muted">Tidak tersedia</span>;
  const positive = value >= 0;
  return (
    <span className={`change ${positive ? "positive" : "negative"}`}>
      {positive ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
      <span>
        {positive ? "+" : "−"}
        {number(Math.abs(value))}%{suffix ? " (24 jam)" : ""}
      </span>
    </span>
  );
}
export function DataStatus({
  resource,
  compact = false,
}: {
  resource: Pick<Resource<unknown>, "status" | "at" | "source">;
  compact?: boolean;
}) {
  return (
    <span
      className={`data-status ${resource.status}`}
      title={`${resource.source} · ${dateTime(resource.at)}`}
    >
      {resource.status === "live" ? <Radio size={12} /> : <Clock3 size={12} />}
      <span>
        {resource.status === "live"
          ? "Terbaru"
          : resource.status === "snapshot"
            ? "Snapshot"
            : "Belum tersedia"}
        {!compact && resource.at ? ` · ${dateTime(resource.at)}` : ""}
      </span>
    </span>
  );
}
export function SaveButton({
  saved,
  name,
  onClick,
}: {
  saved: boolean;
  name: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`icon-button save-button ${saved ? "saved" : ""}`}
      type="button"
      aria-label={`${saved ? "Hapus" : "Simpan"} ${name} ${saved ? "dari" : "ke"} pantauan`}
      aria-pressed={saved}
      onClick={onClick}
    >
      <Star size={17} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
export function Sparkline({
  data,
  positive = true,
}: {
  data?: number[];
  positive?: boolean;
}) {
  if (!data?.length) return <span className="muted">Tidak tersedia</span>;
  const min = Math.min(...data),
    max = Math.max(...data),
    span = max - min || 1;
  const pts = data
    .filter((_, i) => i % 3 === 0)
    .map(
      (v, i, arr) =>
        `${(i / (arr.length - 1)) * 110},${32 - ((v - min) / span) * 28}`,
    )
    .join(" ");
  return (
    <svg
      className={`sparkline ${positive ? "positive" : "negative"}`}
      viewBox="0 0 112 36"
      aria-label="Tren harga 7 hari"
      role="img"
    >
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
