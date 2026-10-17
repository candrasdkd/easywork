# React + TypeScript + Vite

## Cetak Sertifikat PDF

Pengguna membuka menu **Cetak Sertifikat PDF** dari `https://easywork.vercel.app`, lalu mengunggah workbook. File diproses oleh API Python yang memakai LibreOffice dan file sementara dihapus setelah PDF selesai dibuat.

Frontend Vercel dan API PDF berjalan terpisah. API dideploy dari `render.yaml` menggunakan Dockerfile `scripts/Dockerfile.certificate-api`. Setelah Render memberi URL layanan, atur environment variable Vercel `VITE_CERTIFICATE_API_URL` ke URL itu lalu redeploy frontend. API memverifikasi Firebase ID token dan hanya mengizinkan origin `https://easywork.vercel.app`.

Untuk pengembangan lokal, `npm run dev` tetap menyalakan Vite dan API Python di komputer sendiri. Jika `VITE_CERTIFICATE_API_URL` tidak diatur, frontend memakai proxy lokal Vite.

Render Free dapat membuat backend tidur setelah 15 menit tanpa trafik dan perlu sekitar satu menit untuk bangun lagi. File Excel dan PDF dikirim melalui HTTPS ke layanan renderer; file sementara hanya disimpan selama proses pembuatan PDF.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
