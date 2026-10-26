# Control Economía

App web (PWA) para registrar ingresos, gastos personales y viáticos por guardia. Funciona **100 % sin señal**: todo se guarda en el celular (IndexedDB) y se respalda en tu Google Drive cuando vuelve la conexión.

- Registro rápido con el botón **+**: el área se asigna sola según la descripción.
- Inicio con ingresos, gastos, saldo, monto por cobrar, gasto por área y por medio de pago, y comparación con el mes anterior.
- Presupuesto por área (amarillo desde el 80 %, rojo al pasarte).
- Rendición de viáticos por guardia: factura, boleta, **sin sustento** y checklist de comprobantes. Exporta a Excel.
- Respaldo automático en Drive, más exportación e importación manual en JSON y Excel.

Stack: React + TypeScript + Vite, Dexie (IndexedDB), Tailwind CSS, vite-plugin-pwa, SheetJS y Vitest.

---

## 1. Correrla en local

Necesitas [Node.js](https://nodejs.org) 20 o superior.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests del clasificador, totales, rendición, merge y sync
npm run build      # versión de producción en dist/
```

Sin Client ID de Google, la app funciona igual; solo queda desactivado el respaldo en Drive.

---

## 2. Configurar Google Drive (una sola vez)

La app usa únicamente el permiso `drive.file`: **solo puede ver los archivos que ella misma crea**, no el resto de tu Drive. Guarda `Control Economía/control-economia.json` y, una vez por semana, una copia `backup-AAAA-MM-DD.json` (conserva las 8 últimas).

1. **Crear el proyecto.** Entra a <https://console.cloud.google.com>, abre el selector de proyectos (arriba) y elige **Nuevo proyecto**. Ponle, por ejemplo, `control-economia` y créalo.
2. **Habilitar la Drive API.** Ve a **APIs y servicios → Biblioteca**, busca **Google Drive API** y pulsa **Habilitar**.
3. **Pantalla de consentimiento en modo "Testing".** Ve a **APIs y servicios → Pantalla de consentimiento de OAuth** (en la consola nueva se llama **Google Auth Platform**).
   - Tipo de usuario: **Externo**. Nombre de la app: `Control Economía`. Pon tu correo como correo de asistencia y de contacto.
   - En **Permisos de acceso a los datos** (*Data access → Scopes*) agrega `.../auth/drive.file`.
   - En **Público** (*Audience*), deja el estado de publicación en **Testing** y, en **Usuarios de prueba**, agrega tu Gmail.
   - En modo Testing, Google muestra el aviso "Google no verificó esta app". Es normal: toca **Continuar**. Solo los usuarios de prueba pueden entrar.
4. **Crear el Client ID.** Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth** (o **Clientes → Crear cliente**). En tipo de aplicación elige **Aplicación web**.
5. **Orígenes JavaScript autorizados.** En ese mismo formulario agrega:
   - `http://localhost:5173`
   - `https://TU-USUARIO.github.io` (solo el dominio, sin `/control-economia/`)

   No hace falta llenar "URI de redireccionamiento". Guarda y copia el **ID de cliente** (termina en `.apps.googleusercontent.com`).
6. **Dónde pegar el Client ID.** No va escrito en el código; se pasa como variable de entorno:
   - **En local:** copia `.env.example` como `.env.local` y pega el valor:
     ```
     VITE_GOOGLE_CLIENT_ID=1234...apps.googleusercontent.com
     ```
     Reinicia `npm run dev`. El archivo `.env.local` no se sube a Git.
   - **En GitHub Pages:** en tu repo ve a **Settings → Secrets and variables → Actions → pestaña Variables → New repository variable**. Nombre: `VITE_GOOGLE_CLIENT_ID`. Valor: tu ID. El workflow la usa al compilar.

Luego, en la app: **Más → Respaldo y datos → Conectar Google Drive**.

**Cómo funciona la sincronización**
- Cada cambio se guarda primero en el celular y queda en una cola. Arriba a la derecha ves el estado: *Sincronizado*, *Pendiente (n cambios)* o *Sin conexión*.
- La sincronización se hace registro por registro: si editaste lo mismo en dos dispositivos, gana el cambio más reciente. Los borrados viajan como marcas (`deleted: true`), así un celular desactualizado no los "resucita".
- **Celular nuevo o perdido:** instala la app, toca *Conectar Google Drive* y se descarga todo.
- Sin servidor, Google entrega sesiones de aproximadamente 1 hora. Cuando vence, la app muestra **Reconectar**; tus cambios pendientes no se pierden.

---

## 3. Publicarla gratis en GitHub Pages

1. Crea un repositorio en GitHub, por ejemplo `control-economia`, y sube este proyecto:
   ```bash
   git init
   git add .
   git commit -m "Control Economía"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/control-economia.git
   git push -u origin main
   ```
2. En el repo ve a **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Agrega la variable `VITE_GOOGLE_CLIENT_ID` (paso 6 de arriba).
4. Cada `git push` a `main` corre los tests, compila y publica. Tu app queda en `https://TU-USUARIO.github.io/control-economia/`. El avance se ve en la pestaña **Actions**.

---

## 4. Instalarla en el celular

Abre la URL de GitHub Pages **con señal, una sola vez**. Después funciona sin conexión.

- **Android (Chrome):** menú ⋮ → **Agregar a pantalla de inicio** (o **Instalar app**).
- **iPhone (Safari):** botón Compartir → **Agregar a inicio**.

Consejos:
- Conecta Google Drive desde el primer día. Si el navegador borra sus datos, o pierdes el celular, recuperas todo desde Drive.
- Para tener un plan B, exporta de vez en cuando el JSON (**Más → Respaldo y datos**).
- Las actualizaciones se instalan solas la próxima vez que abras la app con señal.

---

## Estructura

```
src/
  domain/    lógica pura y testeada: clasificador, totales, rendición, presupuesto, merge
  db/        IndexedDB (Dexie), cola de pendientes, semillas, datos de ejemplo
  sync/      Google Identity Services, cliente de Drive v3, motor de sincronización y backups
  export/    Excel (rendición y movimientos) y JSON
  components/ y pages/   interfaz
```

Las áreas y las reglas iniciales están en `src/domain/seeds.ts`. Las reglas se pueden editar desde la app en **Más → Reglas de clasificación**.
