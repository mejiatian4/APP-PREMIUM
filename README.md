# KROTON HABITOS — Rastreador de hábitos

Aplicación web para registrar hábitos día a día, planear metas de corto/mediano/largo plazo y hablar con un coach de IA que conoce tu progreso real. Los datos se guardan en **Supabase**, así que puedes verlos desde cualquier dispositivo iniciando sesión.

Pensada para desplegarse **gratis**: el sitio en **GitHub Pages**, la base de datos y las funciones de servidor en el plan gratuito de **Supabase**, y el modelo de IA en el plan gratuito de **Groq**.

---

## Características

**Hábitos**
- Registro e inicio de sesión con correo y contraseña (Supabase Auth), con sesión persistente.
- Crear, editar y eliminar hábitos, cada uno con su color.
- Tabla semanal (lunes a domingo) con una casilla por día; en móvil se convierte en tarjetas para que el check sea fácil de tocar.
- Navegación entre semanas y botón para volver a la semana actual.
- Gráfica de dona con el progreso de hoy y gráfica de barras con el cumplimiento de la semana.
- Métricas extendidas: racha actual, mejor racha histórica, % de cumplimiento del mes, mapa de calor de 10 semanas y % de éxito por hábito (últimos 30 días).
- Frases estoicas/motivadoras sobre disciplina y constancia, rotando cada 7 segundos.

**Metas**
- Tablero de metas de corto, mediano y largo plazo, con descripción opcional.
- Selección de fecha de inicio y fin con un calendario integrado (no se escribe a mano).
- Cronograma tipo Gantt con las metas ubicadas en el tiempo.

**Coach de IA**
- Chat con un coach de hábitos (modelo Llama 3.3 vía **Groq**, gratis).
- Antes de responder, el coach consulta tus hábitos, tu racha y tus metas reales (con tu propia sesión, nunca ve datos de otro usuario) para dar consejos concretos, no genéricos.

**Configuración**
- Exportar todas tus metas a PDF, con el logo de la marca.
- Eliminar la cuenta (y todos tus datos) con una confirmación explícita de lo que se va a borrar.
- Correo de confirmación de cuenta con diseño propio de la marca.

**General**
- Diseño de marca (negro + dorado), responsive y accesible.
- Cada usuario solo ve sus propios datos (seguridad por fila en la base de datos).

---

## Stack

- **Vite** + **TypeScript** (sin framework de UI; CSS propio).
- **Chart.js** para las gráficas.
- **jsPDF** para exportar las metas a PDF (se carga solo cuando se usa).
- **@supabase/supabase-js** para datos, autenticación y llamado a la Edge Function del coach.
- **Supabase Edge Functions** (Deno) + **Groq** (API compatible con OpenAI) para el coach de IA.

---

## Requisitos previos

- **Node.js 18 o superior** y npm.
- Una cuenta gratuita en **[Supabase](https://supabase.com)**.
- Una cuenta gratuita en **[Groq](https://console.groq.com)** (para el coach de IA — no pide tarjeta).
- Una cuenta en **GitHub** (para el despliegue).

---

## 1. Configurar Supabase

1. Entra a [supabase.com](https://supabase.com) y crea un proyecto nuevo (el plan gratuito es suficiente).
2. Abre **SQL Editor** → **New query**, pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**. Esto crea las tablas (`habits`, `habit_logs`, `goals`), los índices, las políticas de seguridad (RLS) y la función `delete_my_account`.
3. Ve a **Project Settings → API** y copia dos valores:
   - **Project URL** → será tu `VITE_SUPABASE_URL`.
   - **anon public key** → será tu `VITE_SUPABASE_ANON_KEY`.

> La `anon key` está diseñada para viajar en el frontend; es pública por diseño. La seguridad real la dan las políticas de *Row Level Security* del esquema, no el ocultamiento de esa clave.

### Correo de confirmación (opcional)

Por defecto, Supabase pide confirmar el correo al registrarse. Para pruebas puedes desactivarlo en **Authentication → Providers → Email → Confirm email**. Si lo dejas activado:

- En **Authentication → URL Configuration**, agrega la URL de tu sitio (local y/o la de GitHub Pages) a **Site URL** y **Redirect URLs**, para que el enlace del correo no apunte a `localhost`.
- Opcionalmente, pega la plantilla [`supabase/email-templates/confirm-signup.html`](supabase/email-templates/confirm-signup.html) en **Authentication → Email Templates → Confirm signup** para un correo con el diseño de la marca (requiere tener configurado un SMTP propio en **Project Settings → Auth**, ya que Supabase no permite editar la plantilla con su SMTP por defecto).

---

## 2. Configurar el Coach de IA (Groq)

El coach corre en una **Supabase Edge Function** (`supabase/functions/ai-coach`), no en el frontend: así la API key del modelo nunca queda expuesta en el navegador. Se despliega una sola vez desde tu computador con la Supabase CLI (no requiere Docker para esta función).

1. Crea una API key gratis en **[console.groq.com/keys](https://console.groq.com/keys)** (inicia sesión, "Create API Key"). No pide tarjeta.
2. Instala/usa la Supabase CLI con `npx` (no hace falta instalarla globalmente) y autentícate:
   ```bash
   npx supabase login
   ```
3. Vincula este proyecto local con tu proyecto de Supabase (el *project ref* está en la URL de tu proyecto, o en la parte antes de `.supabase.co` de tu `VITE_SUPABASE_URL`):
   ```bash
   npx supabase link --project-ref TU_PROJECT_REF
   ```
4. Guarda la API key de Groq como secret (nunca va en `.env` ni en el repositorio):
   ```bash
   npx supabase secrets set GROQ_API_KEY=tu_api_key_de_groq
   ```
5. Despliega la función:
   ```bash
   npx supabase functions deploy ai-coach
   ```

Con eso, la pestaña **Coach** de la app ya puede responder. Si necesitas ver el detalle de un error, revisa **Project → Edge Functions → ai-coach → Logs** en el dashboard de Supabase (el CLI no trae comando de logs en esta versión).

> El coach solo lee los hábitos, registros y metas del usuario que está haciendo la pregunta (usa su propio token de sesión, así que las políticas de RLS aplican igual que en el resto de la app). Nunca inventa datos que no estén en ese contexto.

---

## 3. Correr en local

```bash
# 1. Instalar dependencias
npm install

# 2. Crear el archivo .env a partir del ejemplo
cp .env.example .env
#    y editar .env con tus valores de Supabase

# 3. Levantar el servidor de desarrollo (recarga en caliente)
npm run dev
```

Abre la dirección que muestra la terminal (por defecto `http://localhost:5173`). Cualquier cambio en el código se refleja al instante.

El `.env` local **solo necesita las variables de Supabase** (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`); la key de Groq vive únicamente como secret de Supabase (paso 2), nunca en el frontend.

> **¿Solo quieres ver el diseño sin configurar nada?** Abre el archivo [`vista-previa.html`](vista-previa.html) con doble clic en tu navegador. Es una maqueta estática con datos de ejemplo que usa los estilos reales del proyecto.

### Otros comandos

```bash
npm run build     # genera el sitio estático en dist/
npm run preview   # sirve el build de producción para revisarlo antes de desplegar
```

---

## 4. Desplegar en GitHub Pages

El repositorio incluye un workflow en [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) que construye y publica la app automáticamente.

**Pasos:**

1. Sube el proyecto a un repositorio de GitHub (la rama debe llamarse `main`).
2. En el repositorio, ve a **Settings → Secrets and variables → Actions → New repository secret** y crea dos secretos:
   - `VITE_SUPABASE_URL` con tu Project URL.
   - `VITE_SUPABASE_ANON_KEY` con tu anon key.
3. Ve a **Settings → Pages** y, en **Build and deployment → Source**, selecciona **GitHub Actions**.
4. Haz un push a `main` (o lanza el workflow manualmente desde la pestaña **Actions**). Al terminar, la pestaña Pages mostrará la URL pública.

> Este workflow solo publica el **frontend estático**. La Edge Function del coach (`ai-coach`) vive en Supabase y se despliega aparte con `supabase functions deploy` (ver sección 2) — no hace falta repetirlo en cada push, solo cuando cambies el código de esa función.

### Sobre el `base` de Vite

GitHub Pages publica en una subruta (`https://usuario.github.io/nombre-del-repo/`). El workflow detecta el nombre del repositorio automáticamente y lo pasa como `BASE_PATH`, así que **no necesitas configurar nada a mano**.

Si corres `npm run build` localmente y quieres probar esa subruta, pásala tú:

```bash
BASE_PATH=/nombre-del-repo/ npm run build
```

Para un dominio propio o publicación en la raíz (`usuario.github.io`), usa `BASE_PATH=/`.

---

## Variables de entorno y secrets — resumen

| Nombre | Dónde vive | Para qué sirve |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `.env` local **y** secret de GitHub Actions | URL del proyecto Supabase; viaja al navegador (es pública por diseño). |
| `VITE_SUPABASE_ANON_KEY` | `.env` local **y** secret de GitHub Actions | Clave anónima de Supabase; también pública, la seguridad la da RLS. |
| `GROQ_API_KEY` | Secret de Supabase (`supabase secrets set`) | Solo la usa la Edge Function `ai-coach`, en el servidor. **Nunca** debe ir en `.env`, en el código del frontend ni en GitHub. |

---

## Estructura del proyecto

```
constancia-habit-tracker/
├── .github/workflows/deploy.yml   # despliegue automático a GitHub Pages
├── public/
│   ├── logo-kroton.jpg
│   └── favicon-kroton.png
├── src/
│   ├── lib/
│   │   ├── supabase.ts            # cliente de Supabase
│   │   ├── types.ts               # tipos de dominio
│   │   └── dates.ts               # utilidades de fechas (semana lun–dom)
│   ├── auth/auth.ts               # login / registro / sesión
│   ├── habits/
│   │   ├── api.ts                 # acceso a datos (CRUD + registros)
│   │   └── dashboard.ts           # tablero: pestañas, tabla, gráficas y métricas
│   ├── goals/
│   │   ├── api.ts                 # CRUD de metas
│   │   ├── board.ts               # tablero kanban por plazo
│   │   ├── gantt.ts               # cronograma de metas
│   │   └── pdf.ts                 # exportar metas a PDF
│   ├── coach/
│   │   ├── api.ts                 # llama a la Edge Function ai-coach
│   │   └── chat.ts                # interfaz del chat
│   ├── settings/
│   │   ├── api.ts                 # eliminar cuenta
│   │   └── panel.ts               # panel de configuración
│   ├── charts/
│   │   ├── daily.ts                # gráfica de dona (hoy)
│   │   └── weekly.ts               # gráfica de barras (semana)
│   ├── ui/
│   │   ├── dom.ts                  # helpers de DOM
│   │   ├── icons.ts                # iconos SVG
│   │   ├── modal.ts                # modales (crear/editar, confirmar)
│   │   ├── calendar.ts             # selector de fecha por calendario
│   │   ├── quotes.ts               # tarjeta de frases rotativas
│   │   └── toast.ts                # notificaciones
│   ├── styles/main.css             # tema y estilos (marca Kroton)
│   └── main.ts                     # punto de entrada y enrutado
├── supabase/
│   ├── schema.sql                  # tablas, RLS y función delete_my_account
│   ├── config.toml                 # configuración de la Supabase CLI
│   ├── email-templates/
│   │   └── confirm-signup.html     # plantilla de correo de confirmación
│   └── functions/
│       └── ai-coach/index.ts       # Edge Function del coach (Groq)
├── .env.example
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Cómo usar la app

1. Crea una cuenta o inicia sesión.
2. En la pestaña **Hábitos**: pulsa **Hábito** para agregar el primero, elige un color y marca las casillas de los días que lo cumpliste. Revisa tu racha, el mapa de calor y el % por hábito en las tarjetas de métricas.
3. En la pestaña **Metas**: crea metas de corto, mediano o largo plazo con fecha de inicio y fin elegidas en el calendario; visualízalas en el cronograma tipo Gantt.
4. En la pestaña **Coach**: pregúntale al coach cómo vas, pídele un consejo o su opinión sobre tus metas — responde con tus datos reales.
5. Desde el ícono de configuración (⚙): descarga tus metas en PDF o elimina tu cuenta si lo necesitas.

---

## Notas

- En el plan gratuito de Supabase, un proyecto se pausa tras un periodo de inactividad; con el uso diario de la app esto no ocurre, y si llegara a pausarse se reactiva desde el panel de Supabase.
- El plan gratuito de Groq tiene límites de peticiones por minuto/día, de sobra para un uso personal.
- El bundle incluye Chart.js, jsPDF y el SDK de Supabase; jsPDF se carga de forma diferida (solo al pedir el PDF) para no engordar la carga inicial.

Licencia MIT.
