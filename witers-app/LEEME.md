# WITERS — App independiente (sin Higgsfield)

Tu aplicación completa: landing, registro, login, checkout, panel de clientes
y consola de administración (`/admin`). Corre en tu compu y se despliega en tu
propia cuenta de **Cloudflare** (el plan gratuito alcanza de sobra para empezar).

## Requisitos

- [Node.js](https://nodejs.org) 20 o superior
- Una cuenta gratuita de [Cloudflare](https://dash.cloudflare.com/sign-up)

## 1. Instalar dependencias

```bash
cd witers-app
npm install
```

## 2. Conectar tu cuenta de Cloudflare

```bash
npx wrangler login
```

## 3. Crear la base de datos y el almacenamiento (una sola vez)

```bash
npx wrangler d1 create witers-db
```

Copia el `database_id` que imprime y pégalo en `wrangler.jsonc` donde dice
`REEMPLAZA-CON-TU-DATABASE-ID`. Luego:

```bash
npx wrangler r2 bucket create witers-assets
npx wrangler d1 migrations apply witers-db --remote
```

## 4. Correr en tu compu

```bash
npm run build:dev   # compila
npx wrangler dev    # sirve en http://localhost:8787 con tu D1/R2 reales
```

(Para desarrollo de interfaz con recarga en vivo: `npm run dev`, pero las rutas
que usan base de datos necesitan `wrangler dev`.)

## 5. Publicar en internet

```bash
npm run deploy
```

Te dará una URL `witers.<tu-subdominio>.workers.dev`. Puedes conectar tu
dominio propio desde el panel de Cloudflare → Workers → Custom Domains.

## 6. Convertirte en administrador

1. Regístrate normalmente en la web (`/registro`).
2. Promueve tu cuenta con este comando:

```bash
npx wrangler d1 execute witers-db --remote \
  --command "UPDATE users SET role = 'admin' WHERE email = 'tu@correo.com'"
```

3. Entra a `/admin` con esa cuenta: ahí verás usuarios, pagos y solicitudes.

## 7. (Opcional) Generación de imágenes con IA

La consola de admin puede generar creatividades con **Google Gemini**:

1. Crea una API key gratis en <https://aistudio.google.com/apikey>
2. Guárdala como secreto:

```bash
npx wrangler secret put GEMINI_API_KEY
```

Sin la clave, todo lo demás funciona igual — puedes entregar los diseños
subiendo archivos manualmente desde el admin (botón "Entregar archivo").

## Pendiente por conectar: pagos reales

`/api/checkout` hoy simula el pago (activa la membresía directamente). Para
cobrar de verdad, intégralo con Stripe o Mercado Pago — pídeselo a Claude Code:
"integra Mercado Pago en src/routes/api/checkout.ts".

## Qué se cambió respecto a la versión de Higgsfield

- Sin paquetes privados `@higgsfield/*`: estilos y componentes propios.
- Login del admin: tu propia sesión + rol `admin` en la tabla `users`
  (antes dependía de la cuenta Higgsfield).
- Generación de IA: Google Gemini con tu propia clave (antes SDK interno).
- `wrangler.jsonc` configurado para desplegar desde TU cuenta de Cloudflare.
