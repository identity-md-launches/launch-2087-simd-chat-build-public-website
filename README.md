# Everted Hand Swarm

Dashboard kripto publik berbahasa Indonesia dengan tema hitam dan hijau neon. Situs statis ini menyediakan pencarian nama/simbol/alamat kontrak, grafik candle atau garis, kapitalisasi dan volume, holder token, likuiditas pool, riwayat beli/jual, serta daftar pasar CEX dan DEX.

Hasil siap disajikan berada di **`dist/index.html`** beserta seluruh aset lokalnya. Source, `package.json`, dan `package-lock.json` disertakan. Tidak diperlukan backend, akun, kunci API, atau wallet.

## Instalasi dan pengembangan

Gunakan Node.js **22.12 atau lebih baru**.

```sh
npm ci
npm run dev
```

Untuk membangun dan melihat hasil produksi:

```sh
npm run typecheck
npm run build
npm run preview
```

Buka alamat lokal yang dicetak Vite. Sajikan isi `dist/` dengan server statis apa pun. Konfigurasi `base: './'` menghasilkan URL aset relatif, termasuk font, sehingga halaman bisa berada di subpath gateway. Navigasi berjalan di satu halaman; server tidak memerlukan rewrite route. Gunakan HTTP untuk preview, bukan membuka berkas melalui `file://`.

## Cara memakai

1. Masukkan nama, simbol, atau alamat kontrak, lalu pilih **Cari** atau tekan Enter. Pilih hasil untuk membuka analisis. Ctrl/Cmd+K memfokuskan pencarian.
2. Pilih rentang 24 jam, 7 hari, atau 30 hari dan jenis grafik. Arahkan pointer ke candle, atau fokuskan grafik dan gunakan panah kiri/kanan. Data rinci tersedia melalui **Lihat data candle**.
3. Gunakan **Riwayat transaksi** untuk menyaring Beli/Jual, atau **Bursa CEX / DEX** untuk melihat pasar dan membuka tautan sumber.
4. Simpan koin dengan bintang. **Pantauan** disimpan di browser ini, dimulai dengan Bitcoin, Ethereum, dan Solana; perubahan bertahan setelah muat ulang.
5. Pilih USD/IDR di header. Buka **Sumber & cakupan data** untuk memeriksa definisi metrik dan batas cakupannya.

## Sumber dan batas data

| Penyedia                                                                                                            | Pemakaian                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [CoinGecko](https://docs.coingecko.com/reference/coins-markets)                                                     | Daftar hingga 50 koin utama, harga agregat, kapitalisasi, volume, global, pencarian, metadata kontrak, serta ticker bursa |
| [Coinbase Exchange](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-candles) | Candle pasangan USD yang didukung, dengan fallback OHLC CoinGecko untuk koin lain                                         |
| [Coinbase trades](https://docs.cdp.coinbase.com/api-reference/exchange-api/rest-api/products/get-product-trades)    | Transaksi terkini; sisi maker API dibalik untuk menampilkan Beli/Jual dari sisi taker                                     |
| [DEX Screener](https://docs.dexscreener.com/api/reference)                                                          | Pencarian token lintas jaringan, harga pasangan, likuiditas, transaksi 24 jam, dan daftar DEX                             |
| [GeckoTerminal](https://www.geckoterminal.com/dex-api)                                                              | Pool, candle OHLCV dan riwayat swap DEX                                                                                   |
| [Blockscout](https://docs.blockscout.com/devs/apis)                                                                 | Jumlah alamat holder token pada jaringan yang didukung                                                                    |

API dipanggil langsung dari browser tanpa kredensial. Pembaruan otomatis setiap **60 detik ketika halaman aktif**, cache respons 55 detik, dan timeout permintaan 12 detik. Ini adalah polling berkala, bukan feed tick per tick. Penyedia bisa menerapkan rate limit atau pembatasan CORS/lokasi; 200, 429, dan kegagalan jaringan benar-benar teramati saat pengujian.

Snapshot **nyata** hasil API disimpan di `src/data/snapshot.json`: 14 koin, ringkasan global, serta candle/transaksi Bitcoin dan PEPE, pasar CEX, pool dan holder PEPE. Snapshot bukan data contoh acak. Saat sumber tidak dapat diakses, modul berlabel **Snapshot** dengan tanggal pengambilan. Koin tanpa data pengganti menampilkan keadaan tidak tersedia. Harga, grafik, dan data on-chain mempunyai status masing-masing; keberhasilan satu sumber tidak menjamin sumber lain berhasil.

Batas cakupan:

- Pencarian menjangkau katalog API di luar daftar awal. Kontrak diidentifikasi dari metadata CoinGecko atau hasil DEX; data bergantung pada indeks penyedia.
- Holder berarti jumlah **alamat**, bukan orang. Integrasi Blockscout mencakup Ethereum, Base, Optimism, Arbitrum, dan Polygon; koin native dan jaringan lain dapat tidak memiliki hitungan holder.
- Likuiditas menunjukkan satu pool utama, bukan total pasar. Kapitalisasi tidak pernah diganti secara diam-diam dengan FDV. Grafik pool GeckoTerminal dan harga agregat CoinGecko bisa berbeda.
- Riwayat menampilkan maksimal 20 transaksi terbaru dari respons sumber; bukan arsip semua transaksi sejak peluncuran.
- Ticker CEX/DEX diklasifikasikan dengan daftar nama/identifier yang dikenali. Bursa lain ditulis **Belum dikenali**. Tautan pasar dibatasi ke HTTPS.
- Nilai dan volume upstream ditampilkan sesuai laporan penyedia, bukan hasil audit independen. Waktu label adalah waktu pengambilan; penyedia bisa mempunyai jeda. Konversi IDR berasal dari rasio USD/IDR pada data global CoinGecko.
- Pantauan hanya milik browser setempat; tidak ada sinkronisasi akun. Ikon koin awal dan font dibundel lokal; ikon hasil baru dapat berasal dari penyedia, dengan fallback huruf jika gagal.

Perbarui snapshot secara opsional:

```sh
npm run refresh:snapshot
npm run build
```

Skrip mengambil data nyata dan hanya mengganti berkas setelah seluruh respons yang diperlukan berhasil. API yang gagal menyebabkan skrip berhenti, tanpa mengisi nilai palsu. Setelah memperbarui snapshot, jalankan validasi lagi. Artwork share card ada di `src/assets/social-card.svg`; PNG runtime di `public/social-card.png` disertakan.

## Pemeriksaan yang dijalankan

Produksi dibangun dengan Vite 7.1.12; typecheck TypeScript strict berhasil. Validasi interaksi menjalankan export sebenarnya di **`/preview/`**, bukan development server.

```sh
npx playwright install chromium
npm run validate
# Regresi untuk temuan revisi:
npm run validate:revision
# Tambahkan smoke test API langsung:
npm run validate -- --live
```

Skrip `scripts/validate.mjs` memakai respons API tersimpan yang nyata untuk uji deterministik, menguji 18 alur/keadaan, termasuk pencarian kontrak, angka kecil pada grafik, retry, filter, bursa, penyimpanan, keyboard, drawer, dialog, polling dengan waktu virtual, HTTP 429, dan offline. Jaringan langsung diperiksa terpisah. Hasil sementara ditulis ke `test/scratch/validation/`.

Hasil pekerja, cakupan enam domain Better Interface, temuan, perbaikan, batas browser, screenshot, dan perintah aktual tercatat dalam **[artifacts/validation.md](artifacts/validation.md)**. Desain final didokumentasikan di **[DESIGN.md](DESIGN.md)**. Probe taste@1 terakhir meluluskan 15/16 pemeriksaan; satu penanda adalah ticker pasar asli `FIGR_HELOC`, yang dipertahankan sebagai identifier data. WebKit tidak dapat dijalankan karena dependensi sistem belum tersedia; pemeriksaan Chromium dan pemindaian axe dijalankan.

Revisi ini memperbaiki keempat temuan yang berhasil direproduksi. Pantauan kini memperbarui harga koin tersimpan di luar 50 besar, menampilkan provenance per baris beserta waktu snapshot, dan menghitung status footer dari baris yang terlihat. Pencarian kontrak Ethereum PEPE menyediakan 10 pasar CEX yang sama dengan pencarian nama; kontrak lain menggunakan [metadata platform/alamat CoinGecko](https://docs.coingecko.com/demo/reference/coins-contract-address) bila tersedia. Identitas harus cocok dengan alamat dan jaringan; simbol saja tidak dipakai untuk mencocokkan koin. Kegagalan resolusi menampilkan “Cakupan CEX belum tersedia untuk kontrak ini”. Kontrol grafik membungkus untuk nama panjang pada 320 px, dan slogan sidebar/footer dihapus.

Pemeriksaan revisi menggunakan respons tersimpan, permintaan tertunda/gagal, dan waktu virtual; ini bukan bukti ketersediaan API untuk semua kontrak. Hasil akhir dan screenshot revisi berada di `artifacts/revision/`; jawaban per temuan berada di `.imd-responses.json`. Pemeriksaan interaksi awal diulang dan lulus 18/18 di Chromium. Keterbatasan WebKit dan perangkat fisik tetap dicatat, tanpa klaim lulus Safari.

Dependensi saat pengerjaan dipasang hanya di `test/scratch/`, lalu build menggunakan `EHS_DEPENDENCY_ROOT` agar direktori yang dilindungi tidak disentuh. Override ini opsional dan tidak diperlukan setelah `npm ci` biasa. Tidak ada dependency, cache, registry vendor, sourcemap, atau submodule dalam hasil yang diserahkan. `.gitignore` mengecualikan dependency/cache pada setiap tingkat dan secara eksplisit menyertakan `dist/` serta `artifacts/`. Anggaran path: artifacts maksimal 2 MiB, dist 1 MiB, seluruh berkas lain 3 MiB (termasuk ignore file maksimal 1 KiB), dan cadangan metadata bundle 2 MiB; total maksimum 8 MiB. Ukuran aktual ada di `artifacts/package-audit.json`.

## Berkas penting

- `src/App.tsx`: susunan dashboard, navigasi, polling dan pantauan.
- `src/api.ts`: adaptor API, sumber/waktu, fallback dan normalisasi data.
- `src/components/`: pencarian, grafik dan pola data bersama.
- `src/format.ts`: angka Indonesia, mata uang, dan notasi ilmiah harga kecil.
- `src/styles.css`: token, komponen dan perilaku responsif.
- `public/`: font, logo, favicon, ikon dan share card lokal.
- `dist/`: export produksi yang siap disajikan.
- `artifacts/`: bukti pemeriksaan, dokumentasi dan atribusi.
