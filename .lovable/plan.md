# Sistem Kepatuhan Obat — Lengkap

## Yang akan dibangun

### 1. Klasifikasi status tiap dosis

Setiap slot jadwal akan punya 4 kemungkinan status:

- **Tepat waktu** — diminum ≤ 30 menit dari jadwal
- **Terlambat** — diminum > 30 menit dari jadwal (masih hari yang sama)
- **Terlewat** — jadwal lewat > 2 jam, belum ditandai → dicatat otomatis sebagai missed
- **Belum waktunya** — jadwal masih di depan

### 2. Cron otomatis "auto-missed"

Job berjalan tiap 30 menit. Untuk tiap obat aktif & approved:

- Cek slot jadwal hari ini yang sudah lewat > 2 jam dari sekarang
- Jika belum ada log → buat log `is_taken=false` (terlewat)

Ini yang membuat statistik "kepatuhan" akurat tanpa pasien harus klik "tidak minum".

### 3. Rekap & grafik untuk pasien (`/pasien/obat`)

- Kartu ringkasan **7 hari terakhir**: % kepatuhan, jumlah dosis tepat / terlambat / terlewat
- Kartu ringkasan **30 hari terakhir**: % kepatuhan + tren naik/turun
- **Grafik batang harian 14 hari** — persentase per hari
- **Riwayat dosis** terakhir 7 hari (list) dengan badge status berwarna

### 4. Dashboard apoteker (`/apoteker/kepatuhan` — menu baru)

- Tabel semua pasien binaan dengan kolom:
  - Nama pasien
  - Jumlah obat aktif
  - Kepatuhan 7 hari (%)
  - Kepatuhan 30 hari (%)
  - Dosis terlewat 7 hari terakhir
  - Indikator warna (hijau ≥ 80%, kuning 50-79%, merah < 50%)
- Klik baris → detail per-obat pasien tersebut

### 5. Pengingat in-app

- Banner di halaman `/pasien` (home) untuk **dosis yang sedang due** (jam jadwal ±15 menit, belum diklik)
- Badge angka di menu "Obat" = jumlah dosis tertunda hari ini
- (Push notification browser ditunda — perlu konfigurasi service-worker terpisah)

---

## Detail teknis

### Database

- Tambah kolom di `adherence_logs`:
  - `status` text: `'on_time' | 'late' | 'missed'`
  - `scheduled_date` date (memudahkan agregasi & dedup)
  - Unique index `(user_id, medication_id, scheduled_date, scheduled_time)` supaya cron tidak duplikat
- Migrasi backfill `status` & `scheduled_date` dari data lama
- Database function `compute_adherence(user_id, days)` → returns % + breakdown
- Database function `daily_adherence_series(user_id, days)` → returns array per hari untuk grafik

### Server functions baru (`src/lib/adherence.functions.ts`)

- `getMyAdherenceSummary({ days })` — pasien
- `getMyAdherenceSeries({ days })` — grafik pasien
- `getPatientsAdherence()` — apoteker (list semua pasien)
- `getPatientAdherenceDetail({ patientId })` — apoteker detail

### Cron auto-missed

- Route `src/routes/api/public/hooks/mark-missed.ts` (verifikasi `apikey` header)
- Logic: untuk tiap medication aktif+approved, generate slot harian, cek log, insert missed bila perlu
- Mark `markTaken` di UI: hitung `status` (`on_time`/`late`) berdasarkan selisih dengan `scheduled_time`
- pg_cron dijadwalkan tiap 30 menit memanggil endpoint via `pg_net`

### UI

- Update `pasien.obat.tsx`: tambah section rekap + grafik (pakai chart sederhana dengan div, tanpa lib tambahan)
- File baru `_authenticated/apoteker.kepatuhan.tsx` + entry di nav apoteker
- Update `pasien.tsx` (home): banner "Saatnya minum obat" untuk dosis due
- Badge angka di menu obat (komponen layout pasien)

### Status di markTaken

```text
selisih = |now - scheduled_today|
selisih ≤ 30 menit → on_time
30 menit < selisih ≤ 2 jam → late (masih boleh ditandai)
selisih > 2 jam → cron sudah / akan mark missed; tombol disable
```

---

## Hasil akhir

Pasien lihat angka kepatuhannya tiap hari/minggu/bulan dengan grafik; apoteker punya dashboard pengawasan lengkap; dosis yang terlewat tercatat otomatis tanpa intervensi pasien.

Setuju saya lanjut bangun semuanya?
