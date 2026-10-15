# Skenario uji coba: Ombak Surf School

Skenario role-play untuk mencoba ScopeMatch sendiri dengan dua peran. Semua orang dan bisnis di sini **fiktif**. Hasil uji ini adalah **uji sintetis** oleh pembuat aplikasi, bukan uji pengguna nyata, jadi jangan dicatat di `user-test.md` atau dipakai sebagai bukti dampak.

## Latar cerita

**Nadia** (klien) membuka *Ombak Surf School*, sekolah selancar kecil di Canggu, Bali. Muridnya kebanyakan turis Australia dan Eropa, ditambah sebagian warga lokal. Selama ini semua booking lewat DM Instagram, dan Nadia sering kewalahan.

**Raka** (freelancer) adalah web developer di Denpasar. Nadia mengirim pesan WhatsApp ke Raka:

> Ombak is a small surf school in Canggu. We need a website where tourists can book surf lessons, in English and Indonesian. We want to update our lesson schedule and prices ourselves. Most of our photos are on Instagram.

Raka sudah membaca brief ini dan merasa sudah paham. Nadia juga merasa briefnya sudah jelas.

## Isi kepala masing-masing (rahasia)

Baca bagian **Raka** saat menjawab sebagai freelancer, lalu bagian **Nadia** saat menjawab sebagai klien. Jangan menyesuaikan jawaban dengan pihak lain. Inti aplikasinya justru menguji perbedaan ini.

**Raka (freelancer) membayangkan:**
- *Booking:* tombol WhatsApp saja. Murah, cepat, dan Nadia sudah terbiasa chat. → **A**
- *Bahasa:* cukup halaman utama yang dwibahasa, karena halaman lain jarang dibuka. → **C**
- *Konten yang bisa diedit:* Nadia cukup bisa mengubah daftar kelas dan harga. → **B**
- *Konten saat launch:* Raka menulis teks, foto diambil dari Instagram Nadia. → **B**

**Nadia (klien) membayangkan:**
- *Booking:* turis memilih jam dan langsung terkunci, seperti di Airbnb. → **C**
- *Bahasa:* semua halaman harus dua bahasa, dan Raka yang menerjemahkan. → **B**
- *Konten yang bisa diedit:* Nadia belum yakin. Ia ingin bisa mengubah jadwal, tetapi tidak tahu sebatas apa. → **Not sure yet**
- *Konten saat launch:* foto dari Instagram, teks ditulis Raka. → **B**

## Persiapan

1. Pastikan server berjalan, lalu buka http://127.0.0.1:8090.
2. **Raka:** pakai jendela Chrome biasa.
3. **Nadia:** pakai jendela **Incognito**, atau HP di WiFi yang sama. Untuk HP, ganti `127.0.0.1` di client link dengan IP laptop. Saat ini IP-nya `192.168.1.5`, tetapi bisa berubah, jadi cek dengan `ipconfig getifaddr en0`.

## Langkah dan yang harus terlihat

### 1. Raka membuat proyek
- Buka **New project**. Isi Project name `Ombak surf school website`, Your name `Raka`, Client's name `Nadia`, dan tempel brief di atas.
- Coba dulu klik **Read the brief** dengan brief kosong.
  - ✅ Muncul pesan error di bawah kolom brief.
- Isi brief, lalu klik **Read the brief**.
  - ✅ Empat kata ditandai §1–§4 di brief: *book*, *English*, *update*, dan *photos*.
  - ✅ Arahkan kursor ke setiap kartu. Garis tinta tergambar dari tepi brief ke kartu itu, dan kata asalnya terstabilo.
  - ✅ Panel progres menunjukkan *Stage 1 of 5*, dan kedua nama berstatus *Not invited yet*.

### 2. Raka mengunci pertanyaan
- Biarkan keempat kartu tercentang. Coba lepas satu kartu lalu centang lagi.
  - ✅ Urutannya berpindah dengan animasi.
- Klik **Lock questions & get links**.
  - ✅ Muncul dua tautan. Simpan tautan Raka, dan salin client link.

### 3. Raka menjawab lebih dulu
- Klik **Answer the questions**, lalu jawab sesuai isi kepala Raka.
- Coba klik **Seal my answers** sebelum semua pertanyaan dijawab.
  - ✅ Tombolnya tidak aktif.
- Jawab semua pertanyaan, lalu segel.
  - ✅ Muncul dua segel: segel Raka tertutup, segel Nadia berdenyut. Teks: *Sealed. Waiting for Nadia.*
  - ✅ Panel progres: Raka *Answers sealed*, Nadia *Answering…*

### 4. Nadia membuka tautannya (Incognito atau HP)
- Buka client link.
  - ✅ Tidak ada tab Setup, dan tidak ada petunjuk apa pun tentang jawaban Raka.
- Jawab sesuai isi kepala Nadia, satu pertanyaan per halaman di HP. Untuk *Editable content*, pilih **Not sure yet**.
- Klik **Seal my answers**.
  - ✅ **Reveal:** kartu-kartu terbalik bergantian.
  - ✅ Di jendela Raka, Compare muncul sendiri dalam beberapa detik tanpa reload.

### 5. Membaca hasil reveal
- ✅ Header bento menunjukkan *0 / 4 decided*. Komposisinya: **2 need discussion** (Booking, Languages), **1 need clarification** (Editable), **1 same answer** (Launch content).
- ✅ Booking ditandai **≠** dengan pratinjau A (WhatsApp) dan C (slot langsung).
- ✅ Klik chip pertanyaan di header bento. Halaman meloncat ke pertanyaan itu.

### 6. Menyepakati Booking (counter-proposal)
- **Raka** mengusulkan **A** dengan alasan `Cheapest to build and you already use WhatsApp.`
- **Nadia** mengklik **Counter-propose** dan memilih **C**, dengan alasan `Tourists book from abroad at night; they won't wait for a chat reply.`
- **Raka** mengklik **Counter-propose** dan memilih **B**, dengan alasan `Lessons depend on swell and tides — staff must confirm each slot, so instant booking would promise times you can't keep.`
- **Nadia** mengklik **Confirm decision**.
  - ✅ Setiap usulan baru menggantikan yang lama.
  - ✅ Simbol berubah menjadi **✓** dan penghitung naik ke *1 / 4*.

### 7. Menyepakati sisanya
- **Languages:** Nadia mengusulkan **B**. Raka melakukan counter-propose dengan **custom decision**: `Every page in both languages; Nadia translates the class descriptions, Raka translates the rest.` Nadia mengonfirmasi.
- **Editable content:** Nadia mengusulkan **custom decision** `Lesson schedule and prices only`, lalu Raka mengonfirmasi.
- **Launch content:** keduanya cukup klik **Confirm decision**.
  - ✅ Setelah konfirmasi pertama, pertanyaan ini **belum** decided. Jawaban yang sama tetap butuh konfirmasi kedua pihak.
- ✅ Akhirnya *4 / 4 decided*, dan muncul tombol **Review scope →**.
- *Opsional:* coba usulkan "Not sure yet". Opsi itu memang tidak tersedia sebagai keputusan.

### 8. Scope v1, lalu revisi v2
- **Raka** klik **Review scope**, periksa isi Included, Excluded, dan lainnya, lalu klik **Send for confirmation**.
- Raka konfirmasi dengan namanya.
- Ceritanya: lewat telepon, Nadia bertanya *"Kalau ombak jelek, siapa yang membatalkan lesson?"*
- **Raka** klik **Edit as a new version**, lalu tambahkan di *Open questions*: `Who cancels lessons when the swell is too big or too flat, and how are customers told?`, kemudian kirim.
  - ✅ Sekarang versinya **v2**, dan konfirmasi Raka atas v1 tidak berlaku lagi.
- Raka konfirmasi v2. Lalu **Nadia** klik **View scope** dan konfirmasi v2 dengan namanya.
  - ✅ Cap **AGREED** muncul, dan panel progres menunjukkan *Stage 5 of 5*.

### 9. Ekspor dan halaman Projects
- Klik **Download Markdown** di kedua jendela.
  - ✅ Kedua file identik, berisi v2, keputusan custom, open question tadi, dan label *recorded, not identity-verified*.
- Buka halaman utama di jendela Raka.
  - ✅ Proyek muncul sebagai tile berbingkai ganda dengan status AGREED.

## Uji iseng (opsional)
- Buka `http://127.0.0.1:8090/c/ngawur`. ✅ Muncul *This link isn't valid* tanpa info proyek apa pun.
- Reload halaman di tengah jalan, misalnya saat menunggu atau saat Compare. ✅ Statusnya tetap sama.
- Di HP, perhatikan apakah ada teks yang terpotong atau perlu geser ke samping.
- Aktifkan *Reduce motion* di macOS (System Settings → Accessibility → Display). ✅ Animasi flip dan cap berganti menjadi fade.

## Catatan setelah mencoba
- Apa yang membingungkan?
- Animasi mana yang membantu, dan mana yang mengganggu?
- Apa yang ingin diubah sebelum video final?
