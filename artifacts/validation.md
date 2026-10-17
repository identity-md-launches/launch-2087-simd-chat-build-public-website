# Validasi implementasi

Laporan pemeriksaan pekerja untuk export statis Everted Hand Swarm. Pemeriksaan ini bukan sertifikasi perilaku oleh verifier eksternal.

## Revisi atas empat temuan

Revisi mempertahankan implementasi yang diterima dan membatasi perubahan pada provenance/pembaruan pantauan, pencocokan identitas kontrak untuk bursa, kontrol grafik bernama panjang, serta dua slogan. Keempat laporan direproduksi pada export awal dengan respons API tersimpan sebelum sumber diubah. Bukti awal diringkas di `revision/reproduction.json`; keputusan per ID ada di `../.imd-responses.json`.

| Temuan dan sumber final | Bukti sebelum | Perbaikan dan pemeriksaan ulang |
| --- | --- | --- |
| Tinggi, pantauan — `src/App.tsx:207`, `src/App.tsx:376`, `src/App.tsx:1045`, `src/App.tsx:1106`; `src/api.ts:313` | PEPE snapshot bertanggal `2026-10-17T15:49:47.000Z`, tanpa permintaan `ids=pepe`, di bawah footer Terbaru | Siklus refresh meminta koin tersimpan di luar respons pasar, termasuk DEX. Sel harga menampilkan `DataStatus` milik koin; footer menghitung baris terlihat. Request tertunda memperlihatkan waktu Snapshot dan “3 terbaru · 1 snapshot”; sukses menjadi “4 terbaru”; gagal kembali Snapshot dengan waktu sebelumnya. Polling 60 detik diuji memakai waktu virtual. Penghapusan saat request berlangsung tidak menambah koin kembali. |
| Tinggi, cakupan CEX — `src/api.ts:92`, `src/api.ts:679`, `src/App.tsx:1358` | Hasil nama PEPE: 10 CEX; kontrak Ethereum: 0 CEX, tanpa lookup CoinGecko | Identitas diverifikasi melalui pemetaan chain/alamat yang ada atau metadata kontrak CoinGecko. Ticker digabung dengan pasangan DEX. Nama dan kontrak sama-sama menampilkan 10 CEX pada 390/1440 px; filter DEX tetap berfungsi. Kegagalan ticker memakai snapshot CEX berlabel. Pulsechain dengan alamat yang sama tidak dianggap Ethereum dan menampilkan cakupan CEX belum tersedia. Uji adaptor WETH memeriksa resolusi umum dan penolakan alamat metadata yang berbeda. |
| Sedang, salinan — `src/App.tsx:506`, `src/App.tsx:1377` | Paragraf slogan sidebar setinggi 126 px dan slogan footer | Keduanya dihapus bersama CSS yang tidak dipakai. Kelompok sumber/help tetap bottom-aligned dan menyusut tanpa placeholder. Screenshot desktop final diperiksa. |
| Sedang, reflow — `src/styles.css:695`, `src/styles.css:756` | Pada 320 px, tombol expand berakhir di x=315, di luar content edge x=291 dan card border x=304 | Heading membungkus; action group memiliki margin inline otomatis. Nama lengkap tetap tampil. Tombol berukuran 40 × 40 px pada baris kedua, dengan tepi kanan x=249/x=291. Expand berfungsi dan lebar dokumen tetap 320. |

### Cakupan enam domain pada revisi

| Domain | Cakupan yang diperiksa | Batas yang belum diverifikasi |
| --- | --- | --- |
| Accessibility — Checked | Tombol native dan nama simpan/perbesar tetap utuh; fokus Cari terlihat di screenshot 390. Pemeriksaan keyboard dialog/drawer awal diulang; axe A/AA melaporkan 0 pelanggaran. Timestamp teks tidak mengandalkan warna. | Screen reader, forced-colors dan perangkat fisik tidak diuji. |
| Layout — Checked | Screenshot export di 320/390/1440; alur nama panjang dan hasil kontrak, sumber/help sidebar, footer, dan tabel pantauan. Suite awal menguji reflow pada 800/1050 juga. | Native zoom 200% dan mirror RTL tidak diulang pada revisi ini. |
| Writing — Checked | Dua slogan dihapus, status per baris dan hitungan campuran sesuai data, pesan cakupan CEX tidak mengklaim tidak ada bursa. Terminologi Indonesia yang ada dipertahankan. | Respons teks dari semua token/provider tidak diaudit satu per satu. |
| Typography — Checked | Nama panjang tetap lengkap; status memakai ukuran 12 px dari skala yang ada, tidak menambah font/ukuran; timestamp dapat membungkus. Probe type-sizes/type-faces/tracking lulus. | Semua kemungkinan nama koin dan sistem font fallback tidak diuji. |
| Colors — Checked | Token hitam/neon dipertahankan. Probe kontras rendered dan axe lulus pada state yang diuji; status menggunakan teks/ikon juga. | Tidak mengklaim pengukuran setiap latar/state atau sertifikasi aksesibilitas. |
| UI — Checked | Snapshot/pending/sukses/gagal, save/remove/reload, filter CEX/DEX dan expand diuji. Kontrol tetap 40 px pada ponsel; reduced-motion aktif pada suite dan probe motion lulus. | Replay animasi 10% di panel Animations tidak dilakukan. |

### Perintah aktual pada revisi

Dependensi dipasang di `test/scratch/toolchain/`; direktori ini tidak diserahkan. Typecheck memakai konfigurasi strict root dengan alias dependency scratch, sama seperti putaran awal.

```sh
node test/scratch/toolchain/node_modules/typescript/bin/tsc --project test/scratch/tsconfig.json --noEmit
# exit 0
EHS_DEPENDENCY_ROOT=test/scratch/toolchain node test/scratch/toolchain/node_modules/vite/bin/vite.js build --configLoader native
# exit 0; final export: CSS 34.57 kB, JS 424.97 kB; build.log
EHS_DEPENDENCY_ROOT=test/scratch/toolchain PLAYWRIGHT_BROWSERS_PATH=/tmp/ehs-revision-browsers node scripts/validate.mjs
# exit 0; 18/18 Chromium, 0 axe violations, 0 JavaScript/local asset errors
EHS_DEPENDENCY_ROOT=test/scratch/toolchain PLAYWRIGHT_BROWSERS_PATH=/tmp/ehs-revision-browsers node scripts/validate-revision.mjs
# exit 0; 9/9 browser regressions + 1/1 metadata adapter check
PLAYWRIGHT_BROWSERS_PATH=/tmp/ehs-revision-browsers IMD_PLAYWRIGHT=./test/scratch/toolchain/node_modules/playwright/index.mjs node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
# exit 0; 15/16, unchanged FIGR_HELOC data-identifier exception
```

Probe dan kedua suite diulang pada export setelah perubahan sumber terakhir; metadata dan URL aset relatif diperiksa lagi. Semua interaksi browser berjalan di export `/preview/`. Respons harga individual kosong juga diuji: nilai lama tetap ada dan berlabel Snapshot sampai respons koin itu sendiri berhasil. Pemeriksaan awal script revisi menemukan dua asumsi test yang keliru (status global dianggap status pasar, dan nama tombol “Kecilkan” alih-alih “Perkecil”); keduanya dikoreksi pada test tanpa perubahan produk untuk menyamarkan hasil. Laporan final `revision/results.json` melaporkan 10/10 lulus.

Screenshot final yang benar-benar dilihat: `revision/chromium-mobile.png`, `revision/chromium-desktop.png`, `revision/chromium-long-name-320.png`, `revision/chromium-watchlist-pending.png`, serta kedua screenshot CEX di `revision/`. Layar 390 × 844 memperlihatkan merek, produk, Cari dan awal grafik. Screenshot probe `test/scratch/taste/shots/1440.png` juga diperiksa langsung. Berkas scratch dihapus oleh proses penyerahan.

Browser MCP dicoba dan menjawab bahwa Chromium `chrome` tidak tersedia. Pengujian berhasil memakai Playwright Chromium 141 langsung dengan server yang hanya hidup selama script foreground. WebKit diunduh dan dicoba, tetapi launcher menolak karena pustaka GTK/GStreamer dan pustaka sistem lain tidak tersedia; Safari tetap **belum diverifikasi**. Pemeriksaan HTTP langsung baru pada endpoint identitas WETH dan ticker PEPE sama-sama menghasilkan HTTP 200 (`revision/live-api.json`); ini adalah smoke dari pekerja, bukan bukti CORS/browser untuk semua kontrak. Fixture WETH hanya metadata dari quote token pool tersimpan dan identitas yang didokumentasikan CoinGecko; tidak membuat harga pasar.

**Complete for the stated revision scope.** Empat temuan direproduksi dan diperbaiki; batas browser/provider di atas tetap berlaku. `DESIGN.md`, README, export dan laporan ukuran telah diperbarui. Bagian di bawah adalah catatan putaran awal; screenshot/referensi baris lama di sana merupakan bukti historis, bukan gambar revisi.

---

## Ringkasan

| Area                                              | Hasil                                                                            |
| ------------------------------------------------- | -------------------------------------------------------------------------------- |
| Brief                                             | Fitur diimplementasikan; cakupan data mengikuti API dan ditampilkan jujur        |
| Build produksi                                    | Lulus, Vite 7.1.12, exit 0                                                       |
| Typecheck                                         | Lulus, TypeScript 5.9.3 strict, exit 0                                           |
| Interaksi produksi Chromium                       | 18/18 lulus                                                                      |
| axe WCAG A/AA                                     | 0 pelanggaran pada keadaan yang dipindai                                         |
| Produk dan pencarian pada layar pertama 390 × 844 | Ya; screenshot diperiksa                                                         |
| taste@1                                           | 15/16; penanda tersisa adalah ticker data `FIGR_HELOC`                           |
| Metadata                                          | Title, favicon, description, og:title, og:image tersedia; share card PNG lokal   |
| WebKit                                            | Tidak dijalankan: launcher menolak karena pustaka sistem tidak tersedia          |
| API langsung                                      | Sukses dan rate limit/kegagalan jaringan teramati; fallback bertanggal berfungsi |

Bukti mesin: `interaction-results.json`, `interaction-live.json`, `design-probe.json`, `live-smoke.json`, `axe-chromium.json`, dan `build.log`. Screenshot final: `desktop.jpg`, `mobile.jpg`, `token-analysis.jpg`. Screenshot ini merekam data yang tersedia saat pengambilan, bukan janji tentang kondisi API selanjutnya.

## Cakupan brief

| Permintaan                                   | Implementasi                                                                     |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| Website publik “Everted Hand Swarm”          | Satu halaman React dengan export statis lengkap                                  |
| Desain modern hitam dan hijau neon           | Token hitam/hijau, panel datar, identitas tangan, grafik dan tabel               |
| Logo tangan 🖐                               | Artwork emoji lokal pada header, sidebar, favicon dan share card                 |
| Data koin real-time dari API gratis          | Polling 60 detik, waktu/sumber per modul; bukan stream tick per tick             |
| Candle charts                                | OHLC Coinbase, GeckoTerminal dan fallback CoinGecko; tiga rentang dan mode garis |
| Holder counts                                | Blockscout untuk token di lima jaringan yang didukung; bukan jumlah orang        |
| Liquidity                                    | Data satu pool DEX utama; tidak disamakan dengan volume                          |
| Market cap dan price listings                | CoinGecko/DEX Screener; FDV tidak dipakai sebagai kapitalisasi pengganti         |
| Historical buy/sell data                     | Maksimal 20 transaksi terbaru dengan waktu, sisi, harga, jumlah, total           |
| CEX dan DEX exchange listings                | Tabel, filter, pasangan dan tautan HTTPS; jenis yang belum dikenal ditandai      |
| Manual search by name or contract            | Form nama/simbol/kontrak; hasil global dan DEX dengan jaringan/alamat lengkap    |
| Reliable free APIs                           | Integrasi anonim benar-benar diuji; 429/CORS/timeout tidak disembunyikan         |
| Indonesian interface                         | Label, instruksi, sumber dan keadaan kesalahan berbahasa Indonesia               |
| Working primary interactions / responsive    | 18 uji interaksi dan pemeriksaan viewport yang disebutkan di bawah               |
| dist/index.html + assets + source + lockfile | Disertakan; base relatif, diuji di `/preview/`                                   |
| Build, typecheck, interaction validation     | Dijalankan sendiri, hasil aktual direkam                                         |
| Better Interface / six domains / repairs     | Diterapkan sejak implementasi; cakupan dan perbaikan di bawah                    |
| First screen, metadata, DESIGN.md, README    | Tersedia dan diperiksa                                                           |

Tidak ada wallet, transaksi blockchain, backend, kredensial, publikasi atau akun bersama yang ditambahkan. Pilihan ini sesuai dengan website pembaca pasar. Default pantauan lokal berisi tiga aset dan bisa dihapus; bukan daftar pengguna jaringan.

## Cakupan enam domain Better Interface

| Domain        | Diperiksa                                                                                                                                                                                                     | Batas pemeriksaan                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aksesibilitas | Elemen native, nama kontrol, label pencarian/select, skip link, focus-visible, input 16 px seluler, Tab/Escape, dialog native, trap fokus drawer dan inert pada latar, status dinamis, gerakan berkurang, axe | Bukan sesi screen reader; perangkat fisik dan forced-colors visual belum diuji. axe memindai keadaan dashboard, bukan setiap kombinasi data/overlay |
| Layout        | Export pada subpath, 320/390/800/1050/1440, tampilan pertama seluler, tabel dengan scroll internal, alamat panjang, keadaan kosong/gagal, pembesaran teks 200% di 800                                         | Tidak mengklaim browser-native zoom atau semua ukuran; breakpoint >1700 berdasarkan sumber                                                          |
| Writing       | Istilah Indonesia konsisten, tombol sesuai aksi, source/status dekat data, kosong dengan jalan keluar, pembeda native/token dan alamat/orang                                                                  | Nama aset, simbol dan nama bursa berasal dari penyedia; tidak diterjemahkan atau diubah                                                             |
| Typography    | Enam token ukuran, bobot 400/500/600, font lokal benar-benar loaded, angka tabular, wrapping dan detail kontrak; label grafik responsif dan notasi ilmiah                                                     | Tidak ada klaim pengukuran pada setiap font/glyph di seluruh perangkat                                                                              |
| Colors        | Token semantik, source palette, kontras teks probe lulus, perhitungan pasangan token, batas kontrol 3,36:1, arah panah/tanda selain warna                                                                     | Logo gambar tidak diaudit sebagai teks; probe melewatkan lettering di SVG. Rasio tertera untuk pasangan tertentu, bukan jaminan semua keadaan       |
| UI            | Hover, focus, pressed, active, busy, empty, unavailable, retry; grafik garis/candle, sumber tersimpan, desktop/mobile drawer/dialog; tidak ada border+shadow atau kartu berlapis                              | WebKit dan inspeksi Animations panel pada kecepatan 10% tidak dilakukan. Animasi hanya spinner/press, berhenti pada reduced motion                  |

Arah visual: terminal pasar dengan ruang hitam yang tenang dan hijau neon yang mengarahkan mata ke aksi serta data. Tidak ada hero besar, ticker bergerak, grafik acak, atau hitungan live buatan.

## Temuan dan perbaikan

Semua lokasi menunjuk sumber final. Perbaikan diperiksa ulang pada export produksi, bukan hanya pada development server.

| Keparahan / domain        | Lokasi dan kondisi awal                                                                                                 | Perubahan, alasan, bukti pemeriksaan ulang                                                                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tinggi / identitas, UI    | `src/App.tsx:101`, logo emoji tidak digambar dengan benar dalam browser pengujian                                       | Emoji dirender sebagai artwork Twemoji lokal dan siluet hitam; tangan kini terlihat pada screenshot desktop/seluler dan favicon. Tidak bergantung font emoji sistem                                  |
| Sedang / layout           | `src/styles.css:2284`, ringkasan global seluler memakan ruang terlalu banyak                                            | Keterangan tambahan kartu disembunyikan di ponsel, informasi utama tetap ada; screenshot 390 memperlihatkan produk, pencarian, harga dan grafik pada layar pertama                                   |
| Tinggi / typography       | `src/components/Chart.tsx:38`, satu viewBox desktop mengecilkan label sumbu di layar sempit                             | `ResizeObserver` mengatur koordinat sesuai lebar grafik. Label terlihat pada screenshot 390; reflow dan probe layout lulus                                                                           |
| Sedang / writing          | `src/App.tsx`, salinan awal menghasilkan empat baris slogan dua ketukan                                                 | Deskripsi utama menjadi satu kalimat faktual, teks sidebar dikurangi. Probe `slogans` kini lulus dengan satu baris dua ketukan                                                                       |
| Tinggi / data, writing    | `src/api.ts:61`, `src/App.tsx:811`, koin tanpa pemetaan kontrak semula dapat dianggap native                            | Resolver metadata dan daftar native membedakan kondisi diketahui/tidak diketahui. Tether pada uji API tidak tersedia menampilkan “Kontrak koin ini belum tersedia”, bukan klaim native yang salah    |
| Tinggi / data, typography | `src/format.ts:36`, sumbu PEPE semula membulatkan nilai sangat kecil ke `$0`                                            | Formatter memakai notasi ilmiah; harga/jumlah sangat kecil juga mempertahankan signifikansinya. Uji grafik PEPE memeriksa label `e-6` dan bukan `$0`; screenshot analisis token diperiksa            |
| Sedang / data, UI         | `src/components/Chart.tsx:138`, `src/App.tsx:246`, snapshot harga dan pembaruan grafik dapat berasal dari waktu berbeda | Provenance harga ditampilkan sendiri, harga DEX diperbarui dari respons pasangan dan koin di luar daftar utama di-hydrate. Screenshot menunjukkan label harga snapshot terpisah dari candle terbaru  |
| Sedang / UI               | `src/App.tsx:213`, `src/App.tsx:227`, polling semula mengosongkan panel sebelum respons                                 | Data yang sudah ada dipertahankan selama pembaruan koin/rentang yang sama; pergantian identitas tetap mereset panel. Pembaruan 60 detik diuji memakai waktu virtual, tanpa menunggu satu menit nyata |
| Sedang / writing, data    | `src/api.ts:616`, bursa selain DEX yang dikenali semula otomatis disebut CEX                                            | Hanya identifier CEX/DEX yang dikenali diberi klasifikasi itu; sisanya “Belum dikenali”. Uji filter CEX dan DEX lulus; data tidak dipaksa ke kategori tebakan                                        |
| Tinggi / accessibility    | `src/App.tsx:402`, `src/App.tsx:516`, drawer awal belum membatasi fokus keyboard                                        | Latar dibuat inert, Tab/Shift+Tab berputar dalam drawer, Escape menutup dan fokus kembali. Uji berjalan melalui sembilan perpindahan Tab, penutupan dan navigasi                                     |
| Sedang / colors           | `src/styles.css:24`, batas input/filter terlalu lemah untuk identifikasi kontrol                                        | Token batas kontrol `#616d60` dipakai pada permukaan `#121613`, rasio terhitung 3,36:1. Fokus 2 px neon tetap terpisah; screenshot dan probe kontras diperiksa                                       |

Satu penanda probe yang dipertahankan: `FIGR_HELOC` pada simbol aset dari CoinGecko, di sel data `.table-coin .muted`. Ini adalah identifier pasar asli dalam daftar, bukan judul atau salinan antarmuka. Mengubah kapitalisasinya hanya untuk meluluskan probe tidak tepat. Ticker dan nama seperti BTC, USDC, dan CEX/DEX juga sengaja dipertahankan.

## Perintah aktual dan hasil

Dependensi dipasang ke direktori scratch yang diizinkan. `test/scratch/tsconfig.json` memperluas konfigurasi root dan hanya menambahkan jalur resolusi dependency sementara; opsi strict tetap sama.

```sh
node test/scratch/toolchain/node_modules/typescript/bin/tsc --project test/scratch/tsconfig.json --noEmit
# exit 0

EHS_DEPENDENCY_ROOT=test/scratch/toolchain node test/scratch/toolchain/node_modules/vite/bin/vite.js build --configLoader native
# exit 0; rincian ukuran di build.log

EHS_DEPENDENCY_ROOT=test/scratch/toolchain PLAYWRIGHT_BROWSERS_PATH=/tmp/ehs-browsers XDG_CONFIG_HOME=/tmp/ehs-browser-config XDG_CACHE_HOME=/tmp/ehs-browser-cache node scripts/validate.mjs --live
# exit 0; 18/18 interaksi Chromium

PLAYWRIGHT_BROWSERS_PATH=/tmp/ehs-browsers XDG_CONFIG_HOME=/tmp/ehs-browser-config XDG_CACHE_HOME=/tmp/ehs-browser-cache IMD_PLAYWRIGHT=./test/scratch/toolchain/node_modules/playwright/index.mjs node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
# exit 0; 15/16 checks, satu penanda identifier data
```

Versi biasa yang dapat dijalankan setelah `npm ci` ada di README. Dependensi browser dipasang hanya untuk pengujian; tidak menjadi aset runtime. Probe asli menghasilkan screenshot pada `test/scratch/taste/shots/390.png`, `1440.png`, dan versi full; gambar dilihat langsung sebelum perbaikan dan setelahnya. Scratch tidak diserahkan. Ringkasan probe dan screenshot final disimpan di artifacts.

Delapan belas pemeriksaan mencakup pemuatan export di subpath, sisi taker Coinbase, rentang/jenis/tabel candle, grafik tidak tersedia dan retry, pencarian nama dan kontrak, data holder/likuiditas, arah swap token, filter bursa dan tautan, pantauan persisten dan kosong, filter/sort/paginasi koin, kosong pencarian, konversi IDR, keyboard dialog/drawer, reflow, axe, timer virtual, 429/offline, dan ketiadaan error JavaScript/aset lokal.

Fixture berasal dari snapshot API nyata untuk hasil yang dapat diulang. Pemeriksaan online berdiri sendiri dan **tidak** disamakan dengan fixture. API langsung pernah merespons 200 untuk data pasar, candle, transaksi, DEX, holder, dan pool; sebagian permintaan juga mengalami 429, gagal jaringan, atau timeout. Catatan respons aktual terakhir ada di `live-smoke.json` dan `interaction-live.json`. Tidak ada error JavaScript pada smoke test terakhir. Berkas font lokal terdeteksi loaded.

Tool browser MCP gagal memulai Chromium karena masalah launcher crashpad. Pemeriksaan berhasil memakai Playwright Chromium langsung dalam server foreground terbatas yang ditutup pada akhir skrip. WebKit diunduh dan peluncurannya dicoba, tetapi gagal karena pustaka GTK/GStreamer dan pustaka sistem terkait tidak tersedia. Ini dicatat sebagai **belum diverifikasi**, bukan lulus Safari.

Pembesaran teks diuji terpisah dari native zoom: root font 200% pada viewport 800, lebar dokumen tetap 800; screenshot diperiksa. Tabel lengkap tetap memiliki scroll internal. Tidak dilakukan pengujian screen reader, native zoom, mirror RTL, perangkat fisik, atau setiap token/jaringan yang mungkin diberikan penyedia.

## Penyerahan dan batas akhir

Lengkap untuk cakupan website statis dan validasi Chromium yang dilaporkan. Akses data publik bergantung penyedia; tidak ada janji semua metrik tersedia untuk semua koin. Cakupan holder, riwayat pendek, konversi IDR, dan klasifikasi bursa dijelaskan pada antarmuka/README. WebKit dan pengujian aksesibilitas manual lintas perangkat tetap menjadi batas pengujian.

Source, manifest, lockfile, aset runtime, dokumentasi dan export disertakan. Tidak ada submodule, sourcemap, dependency/cache/registry vendor, atau arsip paket yang diserahkan. `.gitignore` ditambahkan untuk memasukkan export/laporan dan mengecualikan dependency/cache di setiap tingkat. Anggaran eksplisit: `artifacts/**` ≤2 MiB, `dist/**` ≤1 MiB, seluruh deliverable lain ≤3 MiB (termasuk `.gitignore` ≤1 KiB), dan cadangan overhead Git/bundle 2 MiB; total ≤8 MiB. Dependency/cache mempunyai anggaran nol byte pada penyerahan. Pemeriksaan ukuran dan integritas final disimpan dalam `package-audit.json`.
