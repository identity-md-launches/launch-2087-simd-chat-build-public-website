// Interaction checks run against the production export at a gateway-like subpath.
// Recorded API responses are used for repeatability; --live also probes public APIs.
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
const { default: AxeBuilder } = req("@axe-core/playwright");
const snapshot = JSON.parse(await readFile("src/data/snapshot.json", "utf8"));
const out = "test/scratch/validation";
await mkdir(out, { recursive: true });
const checks = [],
  limitations = [];
async function check(name, fn) {
  const start = Date.now();
  try {
    await fn();
    checks.push({ name, passed: true, durationMs: Date.now() - start });
    console.log(`PASS ${name}`);
  } catch (e) {
    checks.push({
      name,
      passed: false,
      error: String(e),
      durationMs: Date.now() - start,
    });
    console.error(`FAIL ${name}: ${e}`);
  }
}
const root = resolve("dist");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};
const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    if (!path.startsWith("/preview/")) {
      res.writeHead(404).end();
      return;
    }
    const file = resolve(root, path.slice("/preview/".length) || "index.html");
    if (!file.startsWith(root + "/")) {
      res.writeHead(403).end();
      return;
    }
    res.setHeader(
      "Content-Type",
      mime[extname(file)] ?? "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
function json(route, data) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(data),
    headers: { "Access-Control-Allow-Origin": "*" },
  });
}
async function fixtures(context, mode) {
  await context.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname === "127.0.0.1") return route.continue();
    if (
      !u.hostname.startsWith("api.") &&
      !u.hostname.endsWith("blockscout.com")
    )
      return route.abort();
    if (mode.value === "offline") return route.abort();
    if (mode.value === "rate-limited")
      return route.fulfill({
        status: 429,
        contentType: "application/json",
        body: '{"error":"Rate limit"}',
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    const p = u.pathname,
      q = (
        u.searchParams.get("query") ??
        u.searchParams.get("q") ??
        ""
      ).toLowerCase();
    if (p.endsWith("/global")) return json(route, { data: snapshot.global });
    if (p.endsWith("/coins/markets"))
      return json(
        route,
        u.searchParams.get("ids")
          ? snapshot.markets.filter((c) =>
              u.searchParams.get("ids").split(",").includes(c.id),
            )
          : snapshot.markets,
      );
    if (p === "/api/v3/search")
      return json(route, {
        coins: snapshot.markets
          .filter((c) => `${c.name} ${c.symbol}`.toLowerCase().includes(q))
          .map((c) => ({ ...c, large: c.image })),
      });
    if (p.endsWith("/dex/search"))
      return json(route, {
        pairs:
          q.includes("pepe") || q.includes("6982508145454")
            ? snapshot.pepe.pairs
            : [],
      });
    if (p.includes("/dex/tokens/"))
      return json(route, { pairs: snapshot.pepe.pairs });
    if (p.endsWith("/tickers"))
      return json(route, {
        tickers: p.includes("/pepe/")
          ? snapshot.pepe.tickers
          : snapshot.bitcoin.tickers,
      });
    if (p.includes("BTC-USD/candles")) {
      const k =
        u.searchParams.get("granularity") === "86400"
          ? "30"
          : u.searchParams.get("granularity") === "21600"
            ? "7"
            : "1";
      return json(route, snapshot.bitcoin.candles[k]);
    }
    if (p.includes("BTC-USD/trades"))
      return json(route, snapshot.bitcoin.trades);
    if (p.includes("/api/v2/tokens/"))
      return json(route, snapshot.pepe.holders);
    if (p.includes("/tokens/") && p.endsWith("/pools"))
      return json(route, {
        data: [{ attributes: { address: snapshot.pepe.pool } }],
      });
    if (p.includes("/ohlcv/")) {
      const k = p.endsWith("/day")
        ? "30"
        : u.searchParams.get("aggregate") === "4"
          ? "7"
          : "1";
      return json(route, {
        data: { attributes: { ohlcv_list: snapshot.pepe.candles[k] } },
      });
    }
    if (p.endsWith("/trades"))
      return json(route, { data: snapshot.pepe.trades });
    return route.abort();
  });
}
async function run(browser, name) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const mode = { value: "fixture" };
  await fixtures(context, mode);
  const page = await context.newPage();
  await page.clock.install();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const missing = [];
  page.on("response", (r) => {
    if (r.url().startsWith(url) && r.status() >= 400)
      missing.push([r.status(), r.url()]);
  });
  await check(`${name}: production export loads at /preview/`, async () => {
    await page.goto(url);
    await page.locator(".chart-source .data-status.live").waitFor();
    assert.match(await page.title(), /Everted Hand Swarm/);
    assert.equal(await page.locator(".coin-table tbody tr").count(), 10);
    assert.equal(
      await page.evaluate(() =>
        document.fonts.check('400 16px "Plus Jakarta Sans"'),
      ),
      true,
    );
  });
  await check(`${name}: native buy/sell uses Coinbase taker side`, async () => {
    await page
      .getByRole("button", { name: "Riwayat transaksi", exact: true })
      .click();
    await page.locator(".trade-table tbody tr").first().waitFor();
    const expected =
      snapshot.bitcoin.trades[0].side === "sell" ? "Beli" : "Jual";
    assert.equal(
      (await page.locator(".trade-side").first().innerText()).trim(),
      expected,
    );
    await page.getByRole("button", { name: "Beli", exact: true }).click();
    assert.ok(
      (await page.locator(".trade-side").allTextContents()).every(
        (s) => s.trim() === "Beli",
      ),
    );
  });
  await check(
    `${name}: 7 day range, line chart and accessible candle table`,
    async () => {
      await page.getByRole("button", { name: "7 hari", exact: true }).click();
      await page.locator(".chart-source .data-status.live").waitFor();
      assert.match(
        await page.locator(".chart-canvas svg").getAttribute("aria-label"),
        /7 hari.*28 candle/,
      );
      await page
        .getByRole("button", { name: "Grafik garis", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("button", { name: "Grafik garis", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      await page.locator(".candle-data summary").click();
      assert.equal(await page.locator(".candle-data tbody tr").count(), 28);
      await page.locator(".candle-data summary").click();
      await page
        .getByRole("button", { name: "Grafik candle", exact: true })
        .click();
    },
  );
  await check(
    `${name}: unavailable chart and retry remain honest`,
    async () => {
      await page.getByRole("searchbox").fill("tether");
      await page.getByRole("searchbox").press("Enter");
      await page.locator(".search-result").first().click();
      await page
        .locator(".empty-chart")
        .getByRole("button", { name: "Coba lagi", exact: true })
        .waitFor();
      assert.match(
        await page.locator(".empty-chart").innerText(),
        /Grafik belum tersedia/,
      );
      assert.match(
        await page.locator(".native-note").innerText(),
        /Kontrak koin ini belum tersedia/,
      );
      const retry = page.waitForRequest((r) =>
        r.url().includes("/coins/tether?"),
      );
      await page
        .locator(".empty-chart")
        .getByRole("button", { name: "Coba lagi", exact: true })
        .click();
      await retry;
      await page
        .locator(".empty-chart")
        .getByRole("button", { name: "Coba lagi", exact: true })
        .waitFor();
    },
  );
  await check(
    `${name}: search by name selects Pepe and loads on-chain stats`,
    async () => {
      await page.getByRole("searchbox").fill("pepe");
      await page.getByRole("searchbox").press("Enter");
      await page.getByText("Hasil pencarian", { exact: true }).waitFor();
      await page.locator(".search-result").first().click();
      await page.locator(".token-stats .data-status.live").waitFor();
      await page.locator('.chart-canvas[aria-busy="false"]').waitFor();
      assert.ok(
        (await page.locator(".chart-canvas .axis-label").allTextContents())
          .slice(0, 5)
          .every((t) => t !== "$0"),
      );
      assert.match(
        (await page.locator(".chart-canvas .axis-label").allTextContents())[0],
        /e-6/,
      );
      assert.equal(
        await page.locator(".coin-select strong").innerText(),
        "Pepe",
      );
      assert.match(
        await page.locator(".token-stats").innerText(),
        new RegExp(
          Number(snapshot.pepe.holders.holders_count)
            .toLocaleString("id-ID")
            .replaceAll(".", "\\."),
        ),
      );
      assert.equal(
        await page
          .getByRole("button", { name: "24 jam", exact: true })
          .getAttribute("aria-pressed"),
        "true",
      );
      await page.locator(".contract-details summary").click();
      assert.equal(
        (
          await page.locator(".contract-details code").innerText()
        ).toLowerCase(),
        snapshot.pepe.holders.address_hash.toLowerCase(),
      );
    },
  );
  await check(
    `${name}: DEX buy and sell history match actual token direction`,
    async () => {
      await page
        .getByRole("button", { name: "Riwayat transaksi", exact: true })
        .click();
      await page.getByRole("button", { name: "Semua", exact: true }).click();
      await page.locator(".trade-table tbody tr").first().waitFor();
      const row = await page
        .locator(".trade-table tbody tr")
        .first()
        .innerText();
      const first = snapshot.pepe.trades[0].attributes;
      const buy =
        first.to_token_address.toLowerCase() ===
        snapshot.pepe.holders.address_hash.toLowerCase();
      assert.match(row, new RegExp(buy ? "Beli" : "Jual"));
      const expectedAmount = new Intl.NumberFormat("id-ID", {
        maximumFractionDigits: 6,
      }).format(Number(buy ? first.to_token_amount : first.from_token_amount));
      assert.ok(row.includes(expectedAmount));
      await page.getByRole("button", { name: "Jual", exact: true }).click();
      assert.ok(
        (await page.locator(".trade-side").allTextContents()).every(
          (s) => s.trim() === "Jual",
        ),
      );
    },
  );
  await check(
    `${name}: CEX and DEX exchange filters and external links`,
    async () => {
      await page
        .getByRole("button", { name: "Bursa CEX / DEX", exact: true })
        .click();
      await page.locator(".exchange-table tbody tr").first().waitFor();
      await page.getByRole("button", { name: "CEX", exact: true }).click();
      assert.ok((await page.locator(".exchange-table tbody tr").count()) > 0);
      assert.ok(
        (
          await page
            .locator(".exchange-table tbody td:nth-child(2)")
            .allTextContents()
        ).every((s) => s === "CEX"),
      );
      await page.getByRole("button", { name: "DEX", exact: true }).click();
      assert.ok((await page.locator(".exchange-table tbody tr").count()) > 0);
      assert.ok(
        (
          await page
            .locator(".exchange-table tbody td:nth-child(2)")
            .allTextContents()
        ).every((s) => s === "DEX"),
      );
      assert.ok(
        (
          await page
            .locator(".external-link")
            .evaluateAll((links) => links.map((a) => a.href))
        ).every((href) => href.startsWith("https://")),
      );
    },
  );
  await check(`${name}: save, reload, remove and empty watchlist`, async () => {
    await page
      .getByRole("button", { name: "Simpan Pepe ke pantauan", exact: true })
      .first()
      .click();
    await page.getByRole("button", { name: /^Pantauan/ }).click();
    assert.ok((await page.locator(".coin-table tbody tr").count()) >= 4);
    assert.match(await page.locator(".coin-table").innerText(), /Pepe/);
    await page.reload();
    await page.getByRole("button", { name: /^Pantauan/ }).click();
    assert.match(await page.locator(".coin-table").innerText(), /Pepe/);
    for (let i = 0; i < 4; i++)
      await page.locator(".coin-table .save-button").first().click();
    assert.equal(
      await page.locator(".empty-state h3").innerText(),
      "Belum ada koin dalam pantauan",
    );
    await page
      .getByRole("button", { name: "Jelajahi pasar", exact: true })
      .click();
  });
  await check(`${name}: price filters, sort and load more`, async () => {
    await page.getByRole("button", { name: "Naik", exact: true }).click();
    assert.ok(
      (await page.locator(".coin-table tbody .change").allTextContents()).every(
        (s) => s.includes("+"),
      ),
    );
    await page.getByRole("button", { name: "Semua koin", exact: true }).click();
    await page
      .getByRole("combobox", { name: "Urutkan koin" })
      .selectOption("price");
    assert.equal(
      await page.locator(".table-coin strong").first().innerText(),
      "Bitcoin",
    );
    await page
      .getByRole("button", { name: "Tampilkan lebih banyak", exact: true })
      .click();
    assert.equal(
      await page.locator(".coin-table tbody tr").count(),
      snapshot.markets.length,
    );
  });
  await check(`${name}: contract search and DEX explorer`, async () => {
    await page.getByRole("searchbox").fill(snapshot.pepe.holders.address_hash);
    await page.getByRole("searchbox").press("Enter");
    await page.locator(".search-result code").first().waitFor();
    await page.locator(".search-result").first().click();
    await page.locator(".token-stats .data-status.live").waitFor();
    await page
      .getByRole("button", { name: "Jelajahi DEX", exact: true })
      .click();
    assert.ok((await page.locator(".coin-table tbody tr").count()) > 0);
    assert.match(await page.locator(".coin-table").innerText(), /ethereum/);
    await page
      .getByRole("combobox", { name: "Filter jaringan" })
      .selectOption("ethereum");
  });
  await check(`${name}: empty search recovers`, async () => {
    await page.getByRole("searchbox").fill("zzzz-nonexistent-coin-98765");
    await page.getByRole("searchbox").press("Enter");
    await page
      .getByRole("button", { name: "Bersihkan pencarian", exact: true })
      .waitFor();
    assert.equal(await page.locator(".search-result").count(), 0);
    await page
      .getByRole("button", { name: "Bersihkan pencarian", exact: true })
      .click();
    assert.equal(await page.getByRole("searchbox").inputValue(), "");
    await page.getByRole("searchbox").press("Escape");
  });
  await check(`${name}: IDR conversion is functional`, async () => {
    await page
      .getByRole("combobox", { name: "Mata uang", exact: true })
      .selectOption("IDR");
    assert.match(await page.locator(".coin-price").innerText(), /^Rp/);
    await page
      .getByRole("combobox", { name: "Mata uang", exact: true })
      .selectOption("USD");
  });
  await check(
    `${name}: dialog keyboard dismissal and focus restoration`,
    async () => {
      const trigger = page.getByRole("button", {
        name: "Sumber & cakupan data",
        exact: true,
      });
      await trigger.click();
      await page.getByRole("dialog").waitFor();
      assert.equal(
        await page.getByRole("dialog").evaluate((d) => d.open),
        true,
      );
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.equal(
        await trigger.evaluate((el) => el === document.activeElement),
        true,
      );
    },
  );
  await check(`${name}: mobile layout, first action and menu`, async () => {
    for (const width of [320, 390, 800, 1050, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        true,
        `overflow at ${width}`,
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const b = await page.locator(".search-form").boundingBox();
    assert.ok(b.y + b.height < 844);
    assert.ok((await page.locator("h1").boundingBox()).y < 844);
    await page.getByRole("button", { name: "Buka menu", exact: true }).click();
    assert.equal(await page.locator(".sidebar").isVisible(), true);
    assert.equal(
      await page.locator(".workspace").evaluate((el) => el.inert),
      true,
    );
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press("Tab");
      assert.equal(
        await page
          .locator(".sidebar")
          .evaluate((el) => el.contains(document.activeElement)),
        true,
      );
    }
    await page.keyboard.press("Escape");
    assert.equal(
      await page
        .getByRole("button", { name: "Buka menu", exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.getByRole("button", { name: "Buka menu", exact: true }).click();
    await page.getByRole("button", { name: "Ringkasan", exact: true }).click();
    assert.equal(await page.locator(".sidebar").isVisible(), false);
    await page.getByRole("searchbox").focus();
    await page.keyboard.press("Tab");
    assert.match(
      await page.evaluate(
        () => getComputedStyle(document.activeElement).outlineStyle,
      ),
      /solid/,
    );
  });
  await check(`${name}: WCAG A/AA automated accessibility scan`, async () => {
    await page.getByRole("searchbox").press("Escape");
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    await writeFile(
      `${out}/axe-${name}.json`,
      JSON.stringify(result.violations, null, 2),
    );
    assert.deepEqual(
      result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
      [],
    );
  });
  await check(
    `${name}: automatic refresh after 60 seconds (virtual clock)`,
    async () => {
      const next = page.waitForRequest((r) =>
        r.url().includes("/coins/markets"),
      );
      await page.clock.fastForward(60_000);
      await next;
      await page.locator(".refresh-button:not(:disabled)").waitFor();
    },
  );
  await check(
    `${name}: API failure has honest snapshots and usable search fallback`,
    async () => {
      mode.value = "rate-limited";
      await page.reload();
      await page.locator(".snapshot-caption").waitFor();
      assert.match(
        await page.locator(".market-status").innerText(),
        /Snapshot/,
      );
      await page.getByRole("searchbox").fill("bitcoin");
      await page.getByRole("searchbox").press("Enter");
      await page
        .locator(".search-message")
        .filter({ hasText: "Sebagian sumber" })
        .waitFor();
      assert.ok((await page.locator(".search-result").count()) > 0);
      await page.getByRole("searchbox").press("Escape");
      mode.value = "offline";
      await page.reload();
      await page.locator(".snapshot-caption").waitFor();
      const btc = snapshot.markets.find((c) => c.id === "bitcoin");
      assert.equal(
        await page.locator(".coin-price").innerText(),
        new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(btc.current_price),
      );
      assert.equal(await page.locator(".chart-canvas svg").count(), 1);
    },
  );
  await check(
    `${name}: zero JavaScript errors and missing local assets`,
    async () => {
      assert.deepEqual(errors, []);
      assert.deepEqual(missing, []);
    },
  );
  await context.close();
}
let chromiumBrowser, webkitBrowser;
try {
  chromiumBrowser = await chromium.launch({ headless: true });
  await run(chromiumBrowser, "chromium");
  try {
    webkitBrowser = await webkit.launch({ headless: true });
    await run(webkitBrowser, "webkit");
  } catch (e) {
    limitations.push(`WebKit could not launch: ${String(e).slice(0, 1800)}`);
  }
  if (process.argv.includes("--live")) {
    const page = await chromiumBrowser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const responses = [];
    const failures = [];
    page.on("requestfailed", (r) => {
      if (r.url().startsWith("https://api."))
        failures.push({ url: r.url(), error: r.failure()?.errorText });
    });
    page.on("response", (r) => {
      if (r.url().startsWith("https://api."))
        responses.push({ url: r.url(), status: r.status() });
    });
    await page.goto(url);
    await page
      .locator(".refresh-button:not(:disabled)")
      .waitFor({ timeout: 25000 });
    await page.locator(".chart-source .data-status").waitFor();
    await writeFile(
      `${out}/live.json`,
      JSON.stringify(
        {
          responses,
          failures,
          statuses: await page.locator(".data-status").allTextContents(),
        },
        null,
        2,
      ),
    );
    console.log("LIVE", JSON.stringify(responses));
    await page.close();
  }
} finally {
  await chromiumBrowser?.close();
  await webkitBrowser?.close();
  await new Promise((r) => server.close(r));
  const report = {
    at: new Date().toISOString(),
    snapshotAt: snapshot.capturedAt,
    target: "dist/ at /preview/",
    checks,
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
if (checks.some((c) => !c.passed)) process.exitCode = 1;
