export type Currency = "USD" | "IDR";
export function price(
  n: number | null | undefined,
  currency: Currency = "USD",
  rate = 1,
) {
  if (n == null || !Number.isFinite(n)) return "Tidak tersedia";
  const value = n * (currency === "IDR" ? rate : 1);
  if (Math.abs(value) > 0 && Math.abs(value) < 1e-8) {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      notation: "scientific",
      maximumFractionDigits: 2,
    })
      .format(value)
      .toLowerCase()
      .replace("us$", "US$")
      .replace("rp", "Rp");
  }
  const digits =
    value === 0
      ? 2
      : Math.abs(value) < 0.01
        ? Math.min(10, Math.ceil(-Math.log10(Math.abs(value))) + 2)
        : currency === "IDR"
          ? 0
          : 2;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}
export function compact(
  n: number | null | undefined,
  currency: Currency = "USD",
  rate = 1,
) {
  if (n == null || !Number.isFinite(n)) return "Tidak tersedia";
  const v = n * (currency === "IDR" ? rate : 1),
    abs = Math.abs(v);
  if (abs > 0 && abs < 0.01) {
    return `${currency === "USD" ? "$" : "Rp"}${new Intl.NumberFormat("id-ID", { notation: "scientific", maximumFractionDigits: 2 }).format(v).toLowerCase()}`;
  }
  const [div, suffix] =
    abs >= 1e12
      ? [1e12, "T"]
      : abs >= 1e9
        ? [1e9, "M"]
        : abs >= 1e6
          ? [1e6, "Jt"]
          : abs >= 1e3
            ? [1e3, "Rb"]
            : [1, ""];
  return `${currency === "USD" ? "$" : "Rp"}${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(v / Number(div))}${suffix ? " " + suffix : ""}`;
}
export function number(n: number | null | undefined, max = 2) {
  if (
    n != null &&
    Number.isFinite(n) &&
    max > 0 &&
    Math.abs(n) > 0 &&
    Math.abs(n) < 10 ** -max
  ) {
    return new Intl.NumberFormat("id-ID", {
      notation: "scientific",
      maximumFractionDigits: 2,
    })
      .format(n)
      .toLowerCase();
  }
  return n == null || !Number.isFinite(n)
    ? "Tidak tersedia"
    : new Intl.NumberFormat("id-ID", { maximumFractionDigits: max }).format(n);
}
export function dateTime(s: string) {
  return s
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZoneName: "short",
      }).format(new Date(s))
    : "Belum diperbarui";
}
export function safeUrl(url?: string) {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
}
