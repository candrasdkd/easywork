# Easywork

Easywork frontend built with React, TypeScript, and Vite.

## PDF sertifikat gabungan

Menu **PDF Sertifikat Gabungan** membaca workbook `.xlsx` yang memiliki sheet `REKAP` dan `Sertifikat`. Easywork mengisi template Sertifikat untuk setiap alat, lalu menyatukan semuanya menjadi satu PDF. Proses pembuatan PDF berjalan di browser dan tidak mengubah atau mengunggah workbook.

Pengguna dapat mengatur total halaman khusus per alat; alat lainnya mengikuti angka di workbook. Setiap file Excel dapat diunggah ulang saat data berubah.

## Pengembangan

```sh
npm install
npm run dev
```

`npm run build` membuat build frontend untuk deployment.
