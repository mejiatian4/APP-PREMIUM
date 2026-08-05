# KROTON — Aplicación Premium

Aplicación web premium de **KROTON**: se desbloquea con un código de activación de 6 caracteres pegado en la tirilla de una prenda física comprada en KROTON. Una vez activada la cuenta, permite registrar hábitos día a día, planear metas de corto/mediano/largo plazo, hablar con un coach de IA que conoce tu progreso real, y generar un plan de entrenamiento y nutrición personalizado (**FitPlan**). Los datos se guardan en **Supabase**, así que puedes verlos desde cualquier dispositivo iniciando sesión.

Pensada para desplegarse **gratis**: el sitio en **GitHub Pages** (con dominio propio), la base de datos y las funciones de servidor en el plan gratuito de **Supabase**, y el modelo de IA en el plan gratuito de **Groq**.

---

## Características

**Acceso premium**
- Registro e inicio de sesión con correo y contraseña (Supabase Auth), con sesión persistente y recuperación de contraseña por correo.
- Antes de ver el tablero, cada cuenta debe canjear un **código de 6 caracteres** (3 letras + 3 números, ej. `KRT482`) pegado en la tirilla de la prenda comprada. Un código solo se puede canjear una vez, y una cuenta solo puede tener un código activo.
- Límite de 5 intentos fallidos cada 10 minutos por cuenta, para que no se puedan adivinar códigos por prueba y error.
- La regla se aplica también en la base de datos (RLS): sin un código canjeado no hay acceso a hábitos ni metas, aunque se llame directo a la API con el token de la sesión.

**Hábitos**
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

**FitPlan**
- Calculadora paso a paso: edad, estatura (cm o ft/in), peso (kg o lb), sexo, somatotipo, días de entrenamiento a la semana, objetivo, nivel y equipo disponible.
- Calcula IMC, categoría, gasto calórico (TDEE), peso ideal y % de grasa corporal estimado, con una explicación de cada métrica.
- Genera un prompt detallado y listo para copiar (al portapapeles) y pegar en un chat de IA, para pedir un plan de entrenamiento y nutrición personalizado con esos datos.

**Configuración**
- Exportar todas tus metas a PDF, con el logo de la marca.
- Eliminar la cuenta (y todos tus datos) con una confirmación explícita de lo que se va a borrar.
- Correos con diseño propio de la marca: confirmación de cuenta y recuperación de contraseña.

**Tienda Kroton**
- Carrusel de productos de la tienda debajo del tablero, con scroll infinito, que enlaza a [krotonoficial.com](https://krotonoficial.com).
- Barra superior con enlace a Instagram ([@krotonoficial](https://www.instagram.com/krotonoficial/)).

**General**
- Diseño de marca (negro + dorado), responsive y accesible.
- El header se oculta al bajar el scroll y reaparece al subir, para dar más espacio al contenido.
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
2. Abre **SQL Editor** → **New query**, pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**. Esto crea las tablas (`habits`, `habit_logs`, `goals`, `access_codes`, `access_code_attempts`), los índices, las políticas de seguridad (RLS, incluida la que exige un código de activación ya canjeado), las funciones `delete_my_account` y `redeem_access_code`, y **genera automáticamente los 1000 códigos de activación** (3 letras + 3 números, ej. `KRT482`).
3. Ve a **Project Settings → API** y copia dos valores:
   - **Project URL** → será tu `VITE_SUPABASE_URL`.
   - **anon public key** → será tu `VITE_SUPABASE_ANON_KEY`.

> La `anon key` está diseñada para viajar en el frontend; es pública por diseño. La seguridad real la dan las políticas de *Row Level Security* del esquema, no el ocultamiento de esa clave.

> Los 1000 códigos quedan en la tabla `access_codes` sin dueño (`user_id` en null) hasta que alguien los canjea. Para obtener la lista y pegarla en las tirillas de las prendas, corre en el **SQL Editor**: `select code from public.access_codes where user_id is null order by code;`.

### Correos de la cuenta (opcional)

Por defecto, Supabase pide confirmar el correo al registrarse. Para pruebas puedes desactivarlo en **Authentication → Providers → Email → Confirm email**. Si lo dejas activado, o si quieres que el correo de recuperación de contraseña también tenga el diseño de la marca:

- En **Authentication → URL Configuration**, agrega la URL de tu sitio (local y/o la de producción) a **Site URL** y **Redirect URLs**, para que los enlaces del correo no apunten a `localhost`.
- Opcionalmente, pega las plantillas [`supabase/email-templates/confirm-signup.html`](supabase/email-templates/confirm-signup.html) y [`supabase/email-templates/reset-password.html`](supabase/email-templates/reset-password.html) en **Authentication → Email Templates** (en **Confirm signup** y **Reset password**, respectivamente) para correos con el diseño de la marca (requiere tener configurado un SMTP propio en **Project Settings → Auth**, ya que Supabase no permite editar la plantilla con su SMTP por defecto).

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

Con eso, la pestaña **Coach** de la aplicación ya puede responder. Si necesitas ver el detalle de un error, revisa **Project → Edge Functions → ai-coach → Logs** en el dashboard de Supabase (el CLI no trae comando de logs en esta versión).

> El coach solo lee los hábitos, registros y metas del usuario que está haciendo la pregunta (usa su propio token de sesión, así que las políticas de RLS aplican igual que en el resto de la aplicación). Nunca inventa datos que no estén en ese contexto.

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

Para pasar la pantalla de "Activa tu cuenta" en desarrollo, canjea cualquiera de los códigos generados en el paso 1 (`select code from public.access_codes where user_id is null limit 1;`).

> **¿Solo quieres ver el diseño sin configurar nada?** Abre el archivo [`vista-previa.html`](vista-previa.html) con doble clic en tu navegador. Es una maqueta estática con datos de ejemplo que usa los estilos reales del proyecto.

### Otros comandos

```bash
npm run build     # genera el sitio estático en dist/
npm run preview   # sirve el build de producción para revisarlo antes de desplegar
```

---

## 4. Desplegar en GitHub Pages

El repositorio incluye un workflow en [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) que construye y publica la aplicación automáticamente.

**Pasos:**

1. Sube el proyecto a un repositorio de GitHub (la rama debe llamarse `main`).
2. En el repositorio, ve a **Settings → Secrets and variables → Actions → New repository secret** y crea dos secretos:
   - `VITE_SUPABASE_URL` con tu Project URL.
   - `VITE_SUPABASE_ANON_KEY` con tu anon key.
3. Ve a **Settings → Pages** y, en **Build and deployment → Source**, selecciona **GitHub Actions**.
4. Haz un push a `main` (o lanza el workflow manualmente desde la pestaña **Actions**). Al terminar, la pestaña Pages mostrará la URL pública.

> Este workflow solo publica el **frontend estático**. La Edge Function del coach (`ai-coach`) vive en Supabase y se despliega aparte con `supabase functions deploy` (ver sección 2) — no hace falta repetirlo en cada push, solo cuando cambies el código de esa función.

> El repositorio incluye [`public/CNAME`](public/CNAME) apuntando al dominio propio `app-premium.krotonoficial.com`. Si despliegas en tu propio dominio o en `usuario.github.io`, edita o elimina ese archivo.

### Sobre el `base` de Vite

GitHub Pages publica en una subruta (`https://usuario.github.io/nombre-del-repo/`) salvo que uses un dominio propio (como este proyecto, vía `CNAME`), en cuyo caso se publica en la raíz. El workflow detecta el nombre del repositorio automáticamente y lo pasa como `BASE_PATH`, así que **no necesitas configurar nada a mano**.

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
├── .github/workflows/deploy.yml   # despliegue automático a GitHub Pages
├── public/
│   ├── CNAME                      # dominio propio: app-premium.krotonoficial.com
│   ├── logo-kroton-naranja.png
│   ├── favicon-kroton.png
│   └── tienda/                    # imágenes del carrusel "Tienda Kroton"
├── src/
│   ├── lib/
│   │   ├── supabase.ts            # cliente de Supabase
│   │   ├── types.ts               # tipos de dominio
│   │   └── dates.ts               # utilidades de fechas (semana lun–dom)
│   ├── auth/
│   │   ├── auth.ts                # login / registro / sesión / reglas de contraseña
│   │   └── resetPassword.ts       # pantalla de "nueva contraseña" (link de recuperación)
│   ├── access/
│   │   ├── api.ts                 # consultar/canjear el código de activación
│   │   └── gate.ts                # pantalla "Activa tu cuenta" (código de 6 caracteres)
│   ├── habits/
│   │   ├── api.ts                 # acceso a datos (CRUD + registros)
│   │   └── dashboard.ts           # tablero: subnav Hábitos/FitPlan, pestañas, tabla, gráficas y métricas
│   ├── goals/
│   │   ├── api.ts                 # CRUD de metas
│   │   ├── board.ts               # tablero kanban por plazo
│   │   ├── gantt.ts               # cronograma de metas
│   │   └── pdf.ts                 # exportar metas a PDF
│   ├── coach/
│   │   ├── api.ts                 # llama a la Edge Function ai-coach
│   │   └── chat.ts                # interfaz del chat
│   ├── fitplan/
│   │   ├── types.ts               # tipos del estado y las métricas de FitPlan
│   │   ├── calc.ts                # cálculo de IMC/TDEE/peso ideal/% grasa y del prompt para IA
│   │   ├── template.ts            # HTML de los pasos de la calculadora
│   │   └── render.ts               # monta e interactúa con la calculadora FitPlan
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
│   │   ├── scrollHeader.ts         # ocultar/mostrar el header según el scroll
│   │   ├── shopCarousel.ts         # carrusel infinito de la "Tienda Kroton"
│   │   └── toast.ts                # notificaciones
│   ├── styles/
│   │   ├── main.css                # tema y estilos (marca Kroton)
│   │   └── fitplan.css             # estilos de la calculadora FitPlan
│   └── main.ts                     # punto de entrada, sesión y enrutado (auth → acceso → tablero)
├── supabase/
│   ├── schema.sql                  # tablas, RLS, códigos de activación y función delete_my_account
│   ├── config.toml                 # configuración de la Supabase CLI
│   ├── email-templates/
│   │   ├── confirm-signup.html     # plantilla de correo de confirmación
│   │   └── reset-password.html     # plantilla de correo de recuperación de contraseña
│   └── functions/
│       └── ai-coach/index.ts       # Edge Function del coach (Groq)
├── .env.example
├── index.html
├── vista-previa.html                # maqueta estática con datos de ejemplo
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Cómo usar la aplicación

1. Crea una cuenta o inicia sesión.
2. **Activa tu cuenta**: introduce el código de 6 caracteres pegado en la tirilla de la prenda KROTON que compraste. Este paso solo aparece una vez; después la cuenta queda activada para siempre.
3. En la pestaña **Hábitos**: pulsa **Hábito** para agregar el primero, elige un color y marca las casillas de los días que lo cumpliste. Revisa tu racha, el mapa de calor y el % por hábito en las tarjetas de métricas.
4. En la pestaña **Metas**: crea metas de corto, mediano o largo plazo con fecha de inicio y fin elegidas en el calendario; visualízalas en el cronograma tipo Gantt.
5. En la pestaña **Coach**: pregúntale al coach cómo vas, pídele un consejo o su opinión sobre tus metas — responde con tus datos reales.
6. En la sección **FitPlan**: ingresa tus datos (edad, estatura, peso, objetivo, nivel, equipo) para ver tu IMC y demás métricas, y genera un prompt para pedirle a una IA tu plan de entrenamiento y nutrición.
7. Desde el ícono de configuración (⚙): descarga tus metas en PDF o elimina tu cuenta si lo necesitas.
8. Debajo del tablero, el carrusel **Tienda Kroton** enlaza directo a la tienda oficial.

---

## Notas

- En el plan gratuito de Supabase, un proyecto se pausa tras un periodo de inactividad; con el uso diario de la aplicación esto no ocurre, y si llegara a pausarse se reactiva desde el panel de Supabase.
- El plan gratuito de Groq tiene límites de peticiones por minuto/día, de sobra para un uso personal.
- El bundle incluye Chart.js, jsPDF y el SDK de Supabase; jsPDF se carga de forma diferida (solo al pedir el PDF) para no engordar la carga inicial.
- El pool de códigos de activación es de 1000; si se agota, vuelve a correr el bloque de generación en [`supabase/schema.sql`](supabase/schema.sql) (es idempotente, no borra los códigos ya canjeados) o ajusta el número de iteraciones ahí mismo.

Licencia MIT.
