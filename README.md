# Easywork

Easywork frontend built with React, TypeScript, and Vite.

## Atur halaman cetak sertifikat

Menu **Atur Halaman Sertifikat** membaca workbook `.xlsx` yang memiliki sheet `REKAP` dan `Sertifikat`. Centang alat tertentu untuk mengatur halaman khusus; jumlahnya otomatis terisi 4 dan masih bisa diubah untuk alat tersebut. Alat yang tidak dicentang mengikuti total halaman di Excel. Salin pengaturannya ke clipboard.

Jalankan paket **Cetak Sertifikat** di komputer yang sama dan pilih workbook yang sama. Paket lokal membaca pengaturan dari clipboard, memakai nilai di Excel untuk alat yang tidak diatur khusus, lalu membuat satu PDF gabungan. File Excel asli tidak diubah.

## Pengembangan

```sh
npm install
npm run dev
```

`npm run build` membuat build frontend untuk deployment.
