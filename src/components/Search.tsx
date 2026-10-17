import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, Search as SearchIcon, X } from "lucide-react";
import { initialCoins, PEPE_ADDRESS, searchCoins } from "../api";
import type { Coin } from "../types";
import { CoinIcon } from "./Shared";
export default function Search({
  onSelect,
  inputRef,
}: {
  onSelect: (c: Coin) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [query, setQuery] = useState(""),
    [open, setOpen] = useState(false),
    [results, setResults] = useState<Coin[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const abort = useRef<AbortController | null>(null),
    container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(e: PointerEvent) {
      if (container.current && !container.current.contains(e.target as Node))
        setOpen(false);
    }
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      abort.current?.abort();
    };
  }, []);
  useEffect(() => {
    setResults(
      initialCoins
        .filter((c) =>
          `${c.name} ${c.symbol}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
        )
        .slice(0, 5),
    );
    setMessage("");
  }, [query]);
  async function submit(e?: FormEvent, q = query) {
    e?.preventDefault();
    if (!q.trim()) {
      setOpen(true);
      inputRef.current?.focus();
      return;
    }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setOpen(true);
    setMessage("");
    try {
      const r = await searchCoins(q, controller.signal);
      if (controller.signal.aborted) return;
      setResults(r.coins);
      setMessage(
        r.partial
          ? "Sebagian sumber tidak merespons. Hasil yang tersedia ditampilkan."
          : r.coins.length
            ? ""
            : "Tidak ada hasil. Periksa nama, jaringan, atau alamat kontrak.",
      );
    } catch {
      if (!controller.signal.aborted)
        setMessage("Pencarian gagal. Periksa koneksi lalu coba lagi.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  function pick(c: Coin) {
    abort.current?.abort();
    setBusy(false);
    setOpen(false);
    setQuery("");
    onSelect(c);
  }
  return (
    <div
      className="search-container"
      ref={container}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpen(false);
          inputRef.current?.focus();
        }
      }}
    >
      <form className="search-form" role="search" onSubmit={submit}>
        <label className="sr-only" htmlFor="coin-search">
          Cari nama koin atau alamat kontrak
        </label>
        <SearchIcon size={19} aria-hidden="true" />
        <input
          ref={inputRef}
          id="coin-search"
          name="coin"
          autoComplete="off"
          type="search"
          value={query}
          onChange={(e) => {
            abort.current?.abort();
            setBusy(false);
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (query) setOpen(true);
          }}
          placeholder="Cari koin atau alamat kontrak"
          aria-describedby="search-hint"
        />
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? "Mencari…" : "Cari"}
          <ArrowUpRight size={16} />
        </button>
      </form>
      <span className="sr-only" id="search-hint">
        Masukkan nama, simbol, atau alamat kontrak, lalu pilih Cari.
      </span>
      {open && (
        <div className="search-results">
          <div className="search-results-heading">
            <strong>
              {busy
                ? "Mencari di CoinGecko & DEX Screener…"
                : query
                  ? "Hasil pencarian"
                  : "Mulai dari koin ini"}
            </strong>
            <button
              className="icon-button"
              type="button"
              aria-label="Tutup hasil pencarian"
              onClick={() => {
                setOpen(false);
                inputRef.current?.focus();
              }}
            >
              <X size={16} />
            </button>
          </div>
          <p className="search-message" role="status">
            {message ||
              `${results.length} koin tersedia. Pilih koin untuk melihat analisis.`}
          </p>
          <ul>
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => pick(c)}
                  className="search-result"
                >
                  <CoinIcon coin={c} small />
                  <span>
                    <strong>{c.name}</strong>
                    <span className="muted">
                      {c.dex
                        ? `${c.dex.chain} · ${c.dex.exchange}`
                        : "Pasar global"}{" "}
                      · {c.symbol.toUpperCase()}
                    </span>
                    {c.dex && (
                      <code className="result-address">{c.dex.address}</code>
                    )}
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              </li>
            ))}
          </ul>
          {!busy && query && !results.length && (
            <button
              className="text-button search-example"
              type="button"
              onClick={() => {
                setQuery("");
                setMessage("");
                inputRef.current?.focus();
              }}
            >
              Bersihkan pencarian
            </button>
          )}
          {!busy && query && (
            <button
              className="text-button search-example"
              type="button"
              onClick={() => {
                setQuery(PEPE_ADDRESS);
                void submit(undefined, PEPE_ADDRESS);
              }}
            >
              Coba alamat kontrak PEPE
            </button>
          )}
        </div>
      )}
    </div>
  );
}
