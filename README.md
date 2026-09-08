# Loopar - AR Postcard App

Aplicación de postales AR que permite a los usuarios crear experiencias de realidad aumentada personalizadas.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3001](http://localhost:3001) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

# AR Postcard: Configuración y Pruebas

## Variables de entorno

- __Supabase__
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

- __App__
  - `NEXT_PUBLIC_APP_URL` (ej. http://localhost:3001)

- __Uploads__
  - `MAX_FILE_SIZE_MB` (backend, default 50)
  - `NEXT_PUBLIC_MAX_FILE_SIZE_MB` (frontend, default 50)
  - `NEXT_PUBLIC_UPLOAD_TIMEOUT_MS` (frontend, default 120000)

## Flujo de creación de postal

1. POST `/api/postcards` crea el registro y devuelve `imageUploadUrl` y `videoUploadUrl`.
2. El frontend sube imagen/video usando esas URLs firmadas.
3. La firma GET de lectura se genera bajo demanda; si aún no existen los objetos, no bloquea el POST.

## Pruebas rápidas

- __Validación de tamaño__
  - Ajusta `NEXT_PUBLIC_MAX_FILE_SIZE_MB` y prueba archivos mayores/menores.

- __Cancelación de subida__
  - Inicia la subida y cancela desde la UI.
  - Esperado: estado vuelve a idle, progreso detenido, sin "Step is still running".

- __Timeout de subida__
  - Temporalmente baja `NEXT_PUBLIC_UPLOAD_TIMEOUT_MS` (p.ej. 5000).
  - Esperado: error de timeout visible y reset limpio del estado de UI.

## Troubleshooting

- __500 en POST /api/postcards por firmar GET__
  - Ahora se captura el error al firmar lectura si los objetos no existen aún; el POST sigue con éxito y `image_url`/`video_url` pueden venir vacíos hasta que se firmen bajo demanda.

- __Buckets/Políticas__
  - Buckets: `postcard-images`, `postcard-videos`.
  - Revisa migraciones en `supabase/migrations/` para creación y políticas RLS.

## Cómo reproducir

1. Crea `.env.local` copiando `.env.example` y completa claves.
2. `npm run dev` y abre `/dashboard/new`.
3. Sube imagen y video, cancela/relanza para probar cancelación y timeout.
