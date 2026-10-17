# Desain Everted Hand Swarm

## Gambaran

Terminal kripto berbahasa Indonesia untuk mencari koin, membaca grafik, dan membandingkan pasar. Identitasnya adalah hitam dengan hijau neon: logo emoji tangan 🖐, angka yang menonjol, grafik nyata, dan permukaan datar dengan garis pemisah tipis. Sumber utama implementasi adalah `src/styles.css`, `src/App.tsx`, dan `src/components/`.

Pencarian adalah aksi utama. Judul dan pencarian muncul sebelum ringkasan global; grafik menjadi fokus berikutnya. Ini adalah dashboard, sehingga tidak ada hero pemasaran yang mendorong alat ke bawah halaman.

## Warna

Token kanonis berada di `:root` pada `src/styles.css`. Komponen memakai token semantik berikut.

| Token                             | Nilai     | Peran                                 |
| --------------------------------- | --------- | ------------------------------------- |
| `--color-bg-page`                 | `#0b0d0c` | Latar halaman                         |
| `--color-bg-sidebar`              | `#0e110f` | Navigasi samping                      |
| `--color-bg-surface`              | `#121613` | Panel dan kolom pencarian             |
| `--color-bg-hover`                | `#191f1a` | Hover dan pilihan netral              |
| `--color-border`                  | `#262d27` | Struktur panel dan tabel              |
| `--color-border-control`          | `#616d60` | Batas pencarian dan pemilih filter    |
| `--color-text`                    | `#eef2ed` | Angka utama dan judul                 |
| `--color-text-muted`              | `#98a299` | Label, sumber, dan keterangan         |
| `--color-accent`, `--color-focus` | `#b7f94d` | Aksi Cari, identitas, dan fokus       |
| `--color-accent-soft`             | `#1d2b13` | Navigasi aktif dan jenis grafik aktif |
| `--color-on-accent`               | `#0b0d0c` | Teks di atas hijau neon               |
| `--color-positive`                | `#b7f94d` | Perubahan positif dan candle naik     |
| `--color-negative`                | `#f47d8c` | Perubahan negatif dan candle turun    |

Aksen dan kenaikan sama-sama hijau sesuai brief. Maknanya juga disampaikan oleh bentuk tombol, tanda +/−, panah, label Beli/Jual, dan status pilihan. Hover tombol utama memakai `#c9ff75`. Warna logo koin berasal dari aset masing-masing, bukan warna interaksi tambahan.

Perhitungan WCAG 2 atas pasangan token permukaan: teks utama 16,14:1, teks sekunder 6,93:1, hijau 14,50:1, merah 7,10:1; teks tombol hitam di hijau 15,48:1. Batas kontrol di permukaan 3,36:1. Probe browser juga meluluskan kontras teks yang dapat diukur. Ini bukan sertifikasi aksesibilitas; cakupan pengukuran ada di `artifacts/validation.md`.

## Tipografi

Font lokal **Plus Jakarta Sans**, `public/fonts/jakarta-latin.woff2`, dengan fallback Arial dan sans-serif. Berkas variabel dipakai pada bobot 400, 500, dan 600; tidak ada font eksternal saat membuka situs. `font-display: swap` dan `font-synthesis: none` digunakan. Alamat kontrak memakai `ui-monospace, monospace`.

| Token            | Ukuran normal | Pemakaian                             |
| ---------------- | ------------- | ------------------------------------- |
| `--text-xs`      | 12 px         | Label data, sumber, angka tabel padat |
| `--text-sm`      | 14 px         | Navigasi, nama koin, isi pendek       |
| `--text-base`    | 16 px         | Heading panel dan input seluler       |
| `--text-lg`      | 20 px         | Identitas dan statistik ringkas       |
| `--text-xl`      | 28 px         | Judul halaman, harga pada layar kecil |
| `--text-display` | 36 px         | Harga utama desktop                   |

Isi memakai line-height 1,5; judul halaman dan harga 1,25. Judul besar memiliki tracking −0,04em hingga −0,045em, judul kecil mengikuti ukuran dan perannya. Teks isi tidak menggunakan huruf kapital berjarak. Ticker aset dipertahankan kapital sebagai identifier pasar. Angka memakai `tabular-nums`.

Harga menggunakan format `id-ID`; USD atau IDR dapat dipilih. `src/format.ts` menyediakan `price`, `compact`, `number`, dan `dateTime`. Rb berarti ribu, Jt juta, M miliar, dan T triliun. Nilai sangat kecil menggunakan notasi ilmiah agar tidak berubah menjadi nol; misalnya `$3,92e-6` berarti $0,00000392. Grafik menyediakan tabel OHLC dengan angka lebih rinci. Nilai yang tidak tersedia ditulis jelas, tidak diganti angka nol.

## Tata letak

Token jarak: 4, 8, 12, 16, 24, dan 32 px. Dashboard menggunakan kepadatan khusus: padding panel desktop 24 px, panel samping 18–20 px, dan jarak antarpanel 16–24 px. Lebar konten maksimum 1600 px. Navigasi desktop lebarnya 220 px; konten memiliki margin yang sama dengan lebar navigasi.

| Kondisi viewport | Adaptasi yang diimplementasikan                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Di atas 1700 px  | Proporsi grafik diperluas dan area grafik minimum 330 px                                                                 |
| Maks. 1250 px    | Sidebar 196 px, padding utama 24 px, beberapa kolom tabel disembunyikan                                                  |
| Maks. 1050 px    | Pencarian menjadi satu baris penuh, statistik 2 × 2, grafik satu kolom, panel samping berpasangan                        |
| Maks. 800 px     | Sidebar diganti drawer; merek dan tombol menu ada di header                                                              |
| Maks. 560 px     | Padding 16 px, ringkasan lebih singkat, harga 28 px, panel samping ditumpuk, tabel koin menampilkan nama/harga/perubahan |
| Maks. 359 px     | Badge judul dan ikon kecil tabel dihilangkan untuk memberi ruang angka                                                   |

Pencarian tetap memakai font 16 px di ponsel, dengan tombol Cari minimal 44 px tinggi. Kontrak lengkap dapat dibuka dan disalin; alamat panjang memakai `overflow-wrap`. Tabel transaksi, bursa, dan OHLC memiliki area scroll internal saat kolom lengkap tidak muat. Halaman tidak membutuhkan scroll horizontal pada lebar yang diuji.

Grafik SVG mengukur lebar kontainernya melalui `ResizeObserver`, memakai koordinat dan padding sumbu yang sesuai dengan lebar aktual, bukan mengecilkan semua label dari satu kanvas desktop. Pengaturan Perbesar grafik memperluas panel dalam alur dokumen.

Heading grafik menggunakan flex yang dapat membungkus. Nama koin tetap lengkap; kelompok simpan/perbesar memiliki `margin-inline-start: auto` dan pindah ke baris berikutnya saat tidak muat. Kedua kontrol tetap 40 × 40 px pada ponsel. Kasus Artificial Superintelligence Alliance diperiksa pada 320 px.

Bagian bawah sidebar mengelompokkan ilustrasi jaringan, “API publik tanpa akun.”, Tentang data, dan status sumber tanpa slogan. Footer berisi tombol Sumber & cakupan data dan identitas situs, tanpa ruang pengganti untuk salinan yang dihapus.

Diuji secara rendered pada 320, 390, 800, 1050, dan 1440 px. Pembesaran teks 200% pada 800 px juga diperiksa. Layout di atas 1700 px dijelaskan berdasarkan sumber; browser-native zoom dan perangkat fisik belum diuji.

## Elevasi dan kedalaman

Antarmuka datar, tanpa bayangan pada kartu. Border menandai struktur; warna latar membedakan hover dan pilihan. Dialog sumber memakai backdrop hitam transparan dan blur 5 px, dengan border dan radius 16 px. Drawer seluler menggunakan backdrop, menjadikan ruang kerja `inert`, dan menahan fokus di navigasi.

## Bentuk

Radius token: 6 px (`--radius-sm`), 10 px (`--radius-md`), dan 14 px (`--radius-lg`). Panel utama memakai 14 px; kartu statistik dan pencarian 10 px; tombol ringkas 5–6 px. Ikon koin bulat. Logo adalah persegi membulat 12 px, miring −7°, dengan gambar tangan Twemoji yang ditampilkan hitam. Favicon menggunakan motif yang sama.

## Komponen dan pola

| Komponen / sumber                                                                            | Peran dan perilaku                                                                                                                                                           |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Brand` di `src/App.tsx`                                                                     | Nama produk dan tangan; kembali ke ringkasan melalui `onHome`                                                                                                                |
| `Search` di `src/components/Search.tsx`                                                      | Form berlabel, pencarian nama/simbol/kontrak, daftar hasil, status memuat, hasil parsial, kosong, dan tindakan bersihkan; Escape menutup hasil; Ctrl/Cmd+K memfokuskan input |
| `Chart` di `src/components/Chart.tsx`                                                        | Rentang 24 jam/7 hari/30 hari, candle/garis, hover atau panah keyboard, perbesar, simpan, status sumber dan tabel OHLC; gagal memuat memiliki Coba lagi                      |
| `CoinIcon`, `Change`, `DataStatus`, `SaveButton`, `Sparkline` di `src/components/Shared.tsx` | Identitas koin, arah perubahan, sumber/waktu, pantauan, dan tren yang diturunkan dari data API                                                                               |
| `.primary-button`, `.secondary-button`, `.icon-button`, `.text-button`                       | Empat tingkat tindakan. Hanya Cari yang memakai isian neon utama; tombol ikon mempunyai nama aksesibel                                                                       |
| `.filter-pills`, `.segmented`, `.market-tabs`                                                | Pilihan dengan `aria-pressed`; perpindahan tampilan tanpa route server                                                                                                       |
| `.coin-table`, `.trade-table`, `.exchange-table`                                             | Struktur tabel HTML, filter di atas data, keadaan kosong dan sumber di dekat data                                                                                            |
| Drawer dan `.info-dialog` di `src/App.tsx`                                                   | Escape, pemulihan fokus, dan fokus yang tetap di overlay; dialog informasi memakai elemen native `dialog`                                                                    |

Pantauan tersimpan hanya di `localStorage` browser. Pembaruan API terjadi setiap 60 detik selama halaman aktif. Status `Terbaru`, `Snapshot`, dan `Belum tersedia` tidak boleh digabung menjadi klaim bahwa semua modul selalu langsung. Harga dan grafik dapat berasal dari penyedia berbeda; label snapshot harga berdiri sendiri.

Setiap sel harga tabel memakai `.coin-row-price` dan `DataStatus` dari provenance koin itu sendiri. Snapshot menampilkan waktu lengkap di bawah harga; status terbaru ringkas menyimpan sumber/waktu pada atribut judul. Status footer menghitung baris yang sedang ditampilkan, termasuk campuran terbaru/snapshot. Koin tersimpan di luar respons pasar diperbarui tersendiri dalam siklus yang sama, termasuk token DEX. Kegagalan mempertahankan nilai dan waktu sebelumnya dengan label Snapshot.

Hasil kontrak tetap mempertahankan konteks pasangan DEX. Daftar bursa menggabungkan pasangan tersebut dengan ticker CoinGecko setelah identitas koin diketahui dari pemetaan kontrak yang ada atau metadata platform/alamat yang cocok. Jika cakupan CEX belum tersedia, panel menyatakannya secara eksplisit; keadaan itu tidak berarti koin tidak terdaftar di CEX.

Fokus memakai outline 2 px hijau dengan offset 4 px. Hover hanya aktif pada perangkat yang mendukung hover. Transisi hanya warna dan latar, 120 ms. Umpan balik tekan skala 0,96 dan spinner berjalan hanya jika `prefers-reduced-motion: no-preference`.

## Aturan pemakaian

- Mulai halaman tambahan dari `.workspace` dan margin utama yang ada; pertahankan heading dan pencarian dekat bagian atas.
- Gunakan format angka bersama; jangan memangkas alamat atau membulatkan harga kecil menjadi nol.
- Gunakan token warna sesuai peran dan pertahankan label nonwarna untuk status.
- Setiap metrik baru perlu sumber, waktu, dan keadaan tidak tersedia. Jangan membuat grafik atau hitungan acak sebagai pengisi.
- Gunakan tombol native untuk aksi dan tautan untuk tujuan; berikan nama untuk tombol ikon.
- Pertahankan susunan seluler dan scroll lokal pada tabel lengkap. Jangan menambah kartu berbayang di dalam panel.

Panduan desain diadaptasi dari Better Interface (Jakub Krehel, MIT) dan metode dokumentasi Impeccable (Paul Bakaus, Apache-2.0). Atribusi dan lisensi ada di `artifacts/THIRD_PARTY_NOTICES.md` dan `artifacts/licenses/`.
