// Regression checks for the four reopened findings, against dist/ at /preview/.
// Price, pair and ticker fixtures are recorded public API responses. The long
// name is a metadata-only search fixture; no invented market values are used.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, extname } from "node:path";

const req = createRequire(
  process.env.EHS_DEPENDENCY_ROOT
    ? resolve(process.env.EHS_DEPENDENCY_ROOT, "package.json")
    : new URL("../package.json", import.meta.url),
);
const { chromium, webkit } = req("playwright");
const raw = JSON.parse(await readFile("src/data/snapshot.json", "utf8"));
const out = "test/scratch/revision";
await mkdir(out, { recursive: true });
const checks = [],
  limitations = [],
  measurements = {};
const root = resolve("dist");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url, "http://localhost").pathname;
    if (!path.startsWith("/preview/")) return res.writeHead(404).end();
    const file = resolve(root, path.slice(9) || "index.html");
    if (!file.startsWith(root + "/")) return res.writeHead(403).end();
    res.setHeader("Content-Type", mime[extname(file)] ?? "text/plain");
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const json = (route, data) =>
  route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, passed: true });
    console.log(`PASS ${name}`);
  } catch (e) {
    checks.push({ name, passed: false, error: String(e) });
    console.error(`FAIL ${name}: ${e}`);
  }
}
function gate(mode, key) {
  let release;
  mode[key] = new Promise((r) => {
    release = r;
  });
  return () => {
    mode[key] = null;
    release();
  };
}
async function fixture(context, mode, requests) {
  await context.route("**/*", async (route) => {
    const u = new URL(route.request().url()),
      p = u.pathname;
    if (u.hostname === "127.0.0.1") return route.continue();
    requests.push(u.href);
    if (p.endsWith("/global")) return json(route, { data: raw.global });
    if (p.endsWith("/coins/markets")) {
      if (u.searchParams.has("ids")) {
        if (mode.priceGate) await mode.priceGate;
        if (mode.priceFailure) return route.abort();
        if (mode.priceEmpty) return json(route, []);
        return json(
          route,
          raw.markets.filter((c) =>
            u.searchParams.get("ids").split(",").includes(c.id),
          ),
        );
      }
      if (mode.marketFailure) return route.abort();
      return json(
        route,
        raw.markets.filter((c) => c.id !== "pepe"),
      );
    }
    if (p === "/api/v3/search")
      return json(route, {
        coins: u.searchParams.get("query").includes("Artificial")
          ? [
              {
                id: "fetch-ai",
                name: "Artificial Superintelligence Alliance",
                symbol: "fet",
                large: "",
                market_cap_rank: null,
              },
            ]
          : [],
      });
    if (p.endsWith("/dex/search"))
      return json(route, {
        pairs: u.searchParams.get("q").includes("698250") ? raw.pepe.pairs : [],
      });
    if (p.includes("/dex/tokens/")) {
      if (mode.dexGate) await mode.dexGate;
      if (mode.dexFailure) return route.abort();
      return json(route, { pairs: raw.pepe.pairs });
    }
    if (p.endsWith("/pepe/tickers")) {
      if (mode.tickerFailure) return route.abort();
      return json(route, { tickers: raw.pepe.tickers });
    }
    return route.abort();
  });
}
async function searchContract(page, chain = "ethereum") {
  await page.getByRole("searchbox").fill(raw.pepe.holders.address_hash);
  await page.getByRole("searchbox").press("Enter");
  await page.locator(".search-result code").first().waitFor();
  await page
    .locator(".search-result")
    .filter({ hasText: chain })
    .first()
    .click();
  await page
    .locator(".coin-select strong")
    .filter({ hasText: "Pepe" })
    .waitFor();
}
async function navigateWatchlist(page) {
  if (page.viewportSize().width <= 800)
    await page.getByRole("button", { name: "Buka menu", exact: true }).click();
  await page.getByRole("button", { name: /^Pantauan/ }).click();
}
async function run(browser, engine) {
  async function session(fn, width = 1440) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const mode = {},
      requests = [],
      errors = [],
      missing = [];
    await fixture(context, mode, requests);
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.url().startsWith(url) && r.status() >= 400) missing.push(r.url());
    });
    await page.clock.install();
    try {
      await page.goto(url);
      await page.locator(".refresh-button:not(:disabled)").waitFor();
      await fn(page, mode, requests);
      assert.deepEqual(errors, [], "JavaScript errors");
      assert.deepEqual(missing, [], "Missing local assets");
    } finally {
      await context.close();
    }
  }
  await check(
    `${engine}: saved PEPE refreshes without selection; pending/failure retains its timestamp`,
    () =>
      session(async (page, mode, requests) => {
        await page
          .locator(".featured-coin")
          .filter({ hasText: "Pepe" })
          .click();
        await page.locator(".chart-actions .save-button").click();
        await page
          .locator(".featured-coin")
          .filter({ hasText: "Bitcoin" })
          .click();
        const savedAt = await page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("ehs-watchlist-v1")).find(
              (c) => c.id === "pepe",
            ).provenance.at,
        );
        const release = gate(mode, "priceGate");
        const pending = page.waitForRequest(
          (r) => new URL(r.url()).searchParams.get("ids") === "pepe",
        );
        await page.reload();
        await pending;
        await page.locator(".refresh-button:not(:disabled)").waitFor();
        await navigateWatchlist(page);
        const row = page
          .locator(".coin-table tbody tr")
          .filter({ hasText: "Pepe" });
        const status = row.locator(".data-status");
        assert.match(await status.innerText(), /Snapshot · \d+ Okt/);
        assert.ok((await status.getAttribute("title")).includes("CoinGecko"));
        assert.match(
          await page.locator(".table-footer").innerText(),
          /3 terbaru · 1 snapshot/,
        );
        await page
          .locator(".coin-table")
          .screenshot({ path: `${out}/${engine}-watchlist-pending.png` });
        release();
        await row.locator(".data-status.live").waitFor();
        assert.match(
          await page.locator(".table-footer").innerText(),
          /4 terbaru/,
        );
        assert.equal(
          await page.locator(".coin-select strong").innerText(),
          "Bitcoin",
        );
        measurements[`${engine}-watchlist`] = {
          pendingSnapshotAt: savedAt,
          rowAfterRefresh: await row.innerText(),
        };
        const firstCount = requests.filter(
          (x) => new URL(x).searchParams.get("ids") === "pepe",
        ).length;
        mode.priceEmpty = true;
        await page.clock.fastForward(60000);
        await row.locator(".data-status.snapshot").waitFor();
        assert.match(await status.innerText(), /Snapshot ·/);
        mode.priceEmpty = false;
        await page.clock.fastForward(60000);
        await row.locator(".data-status.live").waitFor();
        mode.priceFailure = true;
        await page.clock.fastForward(60000);
        await row.locator(".data-status.snapshot").waitFor();
        assert.ok(
          requests.filter((x) => new URL(x).searchParams.get("ids") === "pepe")
            .length > firstCount,
        );
        assert.match(await status.innerText(), /Snapshot ·/);
        assert.match(
          await page.locator(".table-footer").innerText(),
          /3 terbaru · 1 snapshot/,
        );
        mode.priceFailure = false;
        const releaseRemoved = gate(mode, "priceGate");
        const next = page.waitForRequest(
          (r) => new URL(r.url()).searchParams.get("ids") === "pepe",
        );
        await page.clock.fastForward(60000);
        await next;
        await row.locator(".save-button").click();
        releaseRemoved();
        await page.locator(".refresh-button:not(:disabled)").waitFor();
        assert.equal(
          await row.count(),
          0,
          "A pending refresh must not restore a removed coin",
        );
      }),
  );
  await check(
    `${engine}: successful per-coin refresh survives a failed top-50 request`,
    () =>
      session(async (page, mode) => {
        await page
          .locator(".featured-coin")
          .filter({ hasText: "Pepe" })
          .click();
        await page.locator(".chart-actions .save-button").click();
        await page
          .locator(".featured-coin")
          .filter({ hasText: "Bitcoin" })
          .click();
        mode.marketFailure = true;
        await page.reload();
        await navigateWatchlist(page);
        await page
          .locator(".coin-table tbody tr")
          .filter({ hasText: "Pepe" })
          .locator(".data-status.live")
          .waitFor();
        assert.match(
          await page.locator(".table-footer").innerText(),
          /4 terbaru/,
        );
      }),
  );
  await check(
    `${engine}: saved DEX price refreshes on reload and polling while Bitcoin is selected`,
    () =>
      session(async (page, mode) => {
        await searchContract(page);
        await page.locator(".chart-actions .save-button").click();
        await page
          .locator(".featured-coin")
          .filter({ hasText: "Bitcoin" })
          .click();
        const release = gate(mode, "dexGate");
        const pending = page.waitForRequest((r) =>
          r.url().includes("/dex/tokens/"),
        );
        await page.reload();
        await pending;
        await navigateWatchlist(page);
        const row = page
          .locator(".coin-table tbody tr")
          .filter({ hasText: "Pepe" });
        assert.match(
          await row.locator(".data-status").innerText(),
          /Snapshot ·/,
        );
        release();
        await row.locator(".data-status.live").waitFor();
        assert.equal(
          await page.locator(".coin-select strong").innerText(),
          "Bitcoin",
        );
        mode.dexFailure = true;
        await page.clock.fastForward(60000);
        await row.locator(".data-status.snapshot").waitFor();
      }),
  );
  for (const width of [390, 1440])
    await check(
      `${engine}: name and Ethereum contract both expose 10 CEX markets at ${width}px`,
      () =>
        session(async (page, mode, requests) => {
          await page
            .locator(".featured-coin")
            .filter({ hasText: "Pepe" })
            .click();
          await page
            .getByRole("button", { name: "Bursa CEX / DEX", exact: true })
            .click();
          await page.locator(".exchange-table").waitFor();
          await page.getByRole("button", { name: "CEX", exact: true }).click();
          const byName = await page
            .locator(".exchange-table tbody tr")
            .allTextContents();
          assert.equal(byName.length, 10);
          await searchContract(page);
          await page.locator(".exchange-table").waitFor();
          const byContract = await page
            .locator(".exchange-table tbody tr")
            .allTextContents();
          assert.deepEqual(byContract, byName);
          assert.match(byContract.join(" "), /Binance/);
          assert.match(byContract.join(" "), /Bybit/);
          assert.ok(requests.some((r) => r.includes("/coins/pepe/tickers")));
          await page
            .locator(".market-section")
            .screenshot({ path: `${out}/${engine}-contract-cex-${width}.png` });
          await page.getByRole("button", { name: "DEX", exact: true }).click();
          assert.ok(
            (await page.locator(".exchange-table tbody tr").count()) > 0,
          );
          assert.ok(
            (
              await page
                .locator(".exchange-table tbody td:nth-child(2)")
                .allTextContents()
            ).every((x) => x === "DEX"),
          );
          measurements[`${engine}-cex-${width}`] = {
            nameCount: byName.length,
            contractCount: byContract.length,
          };
        }, width),
    );
  await check(
    `${engine}: contract selection first requests CoinGecko tickers; ticker failure retains labelled CEX snapshot`,
    () =>
      session(async (page, mode, requests) => {
        mode.tickerFailure = true;
        await searchContract(page);
        await page
          .getByRole("button", { name: "Bursa CEX / DEX", exact: true })
          .click();
        await page.locator(".exchange-table").waitFor();
        await page.getByRole("button", { name: "CEX", exact: true }).click();
        assert.equal(
          await page.locator(".exchange-table tbody tr").count(),
          10,
        );
        assert.ok(requests.some((r) => r.includes("/coins/pepe/tickers")));
        assert.match(
          await page.locator(".table-resource").innerText(),
          /Snapshot/,
        );
      }),
  );
  await check(
    `${engine}: same address on an unresolved chain reports unavailable CEX coverage`,
    () =>
      session(async (page) => {
        await searchContract(page, "pulsechain");
        await page
          .getByRole("button", { name: "Bursa CEX / DEX", exact: true })
          .click();
        await page.locator(".exchange-table").waitFor();
        await page.getByRole("button", { name: "CEX", exact: true }).click();
        assert.equal(await page.locator(".exchange-table tbody tr").count(), 0);
        assert.equal(
          await page.locator(".market-section .empty-state p").innerText(),
          "Cakupan CEX belum tersedia untuk kontrak ini",
        );
        assert.doesNotMatch(
          await page.locator(".market-section").innerText(),
          /Belum ada pasar CEX/,
        );
      }),
  );
  await check(
    `${engine}: long name keeps full text and 40px actions inside chart at 320px`,
    () =>
      session(async (page) => {
        await page
          .getByRole("searchbox")
          .fill("Artificial Superintelligence Alliance");
        await page.getByRole("searchbox").press("Enter");
        await page.locator(".search-result").first().click();
        await page.locator(".chart-heading").scrollIntoViewIfNeeded();
        const rects = await page.locator(".chart-heading").evaluate((el) => ({
          heading: el.getBoundingClientRect().toJSON(),
          select: el
            .querySelector(".coin-select")
            .getBoundingClientRect()
            .toJSON(),
          actions: [...el.querySelectorAll(".chart-actions button")].map((el) =>
            el.getBoundingClientRect().toJSON(),
          ),
          text: el.querySelector(".coin-select strong").innerText,
        }));
        assert.equal(rects.text, "Artificial Superintelligence Alliance");
        for (const b of rects.actions) {
          assert.ok(
            b.left >= rects.heading.left &&
              b.right <= rects.heading.right + 0.5,
          );
          assert.equal(b.width, 40);
          assert.equal(b.height, 40);
          assert.ok(b.top >= rects.select.bottom);
        }
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth),
          320,
        );
        measurements[`${engine}-long-name`] = rects;
        await page.screenshot({ path: `${out}/${engine}-long-name-320.png` });
        await page
          .getByRole("button", { name: "Perbesar grafik", exact: true })
          .click();
        assert.equal(
          await page
            .getByRole("button", { name: "Perkecil grafik", exact: true })
            .count(),
          1,
        );
      }, 320),
  );
  await check(
    `${engine}: compact sidebar/footer and main action visible on first 390px screen`,
    () =>
      session(async (page) => {
        assert.equal(await page.locator(".sidebar-bottom > p").count(), 0);
        assert.doesNotMatch(
          await page.locator(".page-footer").innerText(),
          /Data terbuka untuk keputusan/,
        );
        assert.match(
          await page.locator(".sidebar-bottom").innerText(),
          /API publik tanpa akun\./,
        );
        assert.equal(
          await page
            .getByRole("button", { name: "Tentang data", exact: true })
            .count(),
          1,
        );
        await page.screenshot({
          path: `${out}/${engine}-desktop.png`,
          fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => window.scrollTo(0, 0));
        const search = await page.locator(".search-form").boundingBox();
        assert.ok(search.y >= 0 && search.y + search.height <= 844);
        assert.ok((await page.locator("h1").boundingBox()).y < 844);
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth),
          390,
        );
        await page.getByRole("searchbox").focus();
        await page.keyboard.press("Tab");
        assert.match(
          await page.evaluate(
            () => getComputedStyle(document.activeElement).outlineStyle,
          ),
          /solid/,
        );
        await page.screenshot({ path: `${out}/${engine}-mobile.png` });
      }),
  );
}
async function validateIdentity() {
  // Exercise the general resolver as well as PEPE's existing known mapping.
  // WETH identity comes from CoinGecko's documented contract response; its
  // address/name/symbol come from the recorded pool's quote token. No prices
  // are generated for these metadata-only adapter checks.
  const { build } = req("esbuild"); // Vite's locked compiler dependency.
  const bundle = await build({
    entryPoints: ["src/api.ts"],
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    logLevel: "silent",
  });
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`;
  const pair = raw.pepe.pairs.find((p) => p.chainId === "ethereum");
  const token = pair.quoteToken;
  assert.equal(token.symbol, "WETH");
  const c = {
    id: `ethereum:${token.address}`,
    symbol: token.symbol,
    name: token.name,
    current_price: null,
    market_cap: null,
    total_volume: null,
    price_change_percentage_24h: null,
    dex: {
      chain: "ethereum",
      address: token.address,
      pair: pair.pairAddress,
      quote: "PEPE",
      exchange: pair.dexId,
      url: pair.url,
    },
  };
  const stats = {
    data: {
      holders: null,
      liquidity: null,
      buys: null,
      sells: null,
      pairs: [],
    },
    source: "Metadata-only fixture",
    at: "",
    status: "error",
  };
  const originalFetch = globalThis.fetch;
  try {
    for (const valid of [true, false]) {
      const paths = [];
      globalThis.fetch = async (url) => {
        const path = new URL(url).pathname;
        paths.push(path);
        return new Response(
          JSON.stringify(
            path.includes("/contract/")
              ? {
                  id: "weth",
                  platforms: {
                    ethereum: valid
                      ? token.address.toUpperCase().replace("0X", "0x")
                      : pair.baseToken.address,
                  },
                }
              : { tickers: [] },
          ),
          { status: 200 },
        );
      };
      const api = await import(`${moduleUrl}#${valid}`);
      const result = await api.getExchanges(c, stats);
      assert.ok(paths[0].includes(`/coins/ethereum/contract/${token.address}`));
      assert.equal(result.cexAvailable, valid);
      assert.equal(
        paths.some((p) => p.endsWith("/coins/weth/tickers")),
        valid,
      );
      if (!valid)
        assert.equal(
          result.note,
          "Cakupan CEX belum tersedia untuk kontrak ini",
        );
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
}

try {
  await check(
    "adapter: contract metadata resolves WETH identity; mismatched address is rejected",
    validateIdentity,
  );
  for (const [engine, type] of Object.entries({ chromium, webkit })) {
    let browser;
    try {
      browser = await type.launch({ headless: true });
    } catch (e) {
      limitations.push(`${engine} unavailable: ${String(e).slice(0, 2400)}`);
      continue;
    }
    try {
      await run(browser, engine);
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise((r) => server.close(r));
  const report = {
    at: new Date().toISOString(),
    target: "dist/ at /preview/",
    checks,
    measurements,
    limitations,
  };
  await writeFile(`${out}/results.json`, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        passed: checks.filter((c) => c.passed).length,
        total: checks.length,
        limitations,
      },
      null,
      2,
    ),
  );
}
if (!checks.length || checks.some((c) => !c.passed)) process.exitCode = 1;
