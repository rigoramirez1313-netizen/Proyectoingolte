# Proyecto Ingolte - Cloudflare Worker

Este proyecto está construido desde cero utilizando **JavaScript Puro Moderno (ES Modules)**, sin frameworks ni dependencias pesadas de `node_modules`, ideal para ejecutarse de manera ultra-rápida y ligera en la red de borde (Edge) de **Cloudflare Workers**.

La conexión a la base de datos de **Supabase** se realiza directamente a través de llamadas de red nativas optimizadas usando la API estándar `fetch`, prescindiendo de dependencias externas.

---

## 🛠️ Estructura del Proyecto

- [`src/index.js`](file:///home/rrr/Documents/ProyectoIngolte/src/index.js): Entrada principal del Worker. Maneja las solicitudes HTTP, el enrutamiento básico y sirve la consola interactiva.
- [`src/supabase.js`](file:///home/rrr/Documents/ProyectoIngolte/src/supabase.js): Cliente ligero de Supabase escrito en JavaScript moderno. Implementa un constructor de consultas (Query Builder) fluido mediante `fetch`.
- [`wrangler.toml`](file:///home/rrr/Documents/ProyectoIngolte/wrangler.toml): Configuración oficial de Wrangler para Cloudflare Workers.
- [`.gitignore`](file:///home/rrr/Documents/ProyectoIngolte/.gitignore): Archivo para evitar subir archivos temporales y secretos de entorno a GitHub.
- [`.dev.vars.example`](file:///home/rrr/Documents/ProyectoIngolte/.dev.vars.example): Plantilla para la configuración de las variables de entorno de Supabase de manera local.

---

## 🚀 Guía de Desarrollo Local

### 1. Configurar variables de entorno
Crea un archivo llamado `.dev.vars` en la raíz del proyecto (este archivo está configurado en tu `.gitignore` para que nunca se suba a GitHub):

```ini
SUPABASE_URL="https://tu-proyecto.supabase.co"
SUPABASE_ANON_KEY="tu-clave-anon-de-supabase"
```

*Nota: Puedes obtener estos valores desde el panel de control de Supabase en **Project Settings** > **API**.*

### 2. Iniciar el Servidor de Desarrollo
Para arrancar el Worker localmente usando Wrangler:

```bash
wrangler dev
```

Esto abrirá un servidor local en `http://localhost:8787`. Al abrir esta dirección en tu navegador, verás una interfaz visual interactiva que te permitirá probar la conexión a Supabase y hacer consultas a tus tablas en tiempo real.

---

## ☁️ Despliegue en Cloudflare Workers

Dado que ya tienes configurado el worker `proyectoingolte` en tu cuenta de Cloudflare, puedes subir tu código ejecutando:

### 1. Configurar Secretos en Producción
Para que tu Worker en la nube pueda conectarse a Supabase, debes configurar las variables de entorno en producción.

Establece la clave de Supabase de manera segura como un secreto cifrado:
```bash
wrangler secret put SUPABASE_ANON_KEY
```
*(Te solicitará ingresar el valor. Pega allí tu clave anónima).*

Establece la URL de Supabase como una variable normal. Puedes hacerlo añadiendo la línea directamente en tu `wrangler.toml` o de forma rápida por línea de comandos:
```bash
wrangler secret put SUPABASE_URL
```
*(Ingresa allí tu URL de Supabase).*

### 2. Publicar el Worker
Una vez que las variables de entorno/secretos estén listas, despliega tu código a producción con:

```bash
wrangler deploy
```

Tu código se compilará y subirá automáticamente al endpoint:
👉 **[https://proyectoingolte.rigo-ramirez-1313.workers.dev/](https://proyectoingolte.rigo-ramirez-1313.workers.dev/)**

---

## 🐙 Sincronización con GitHub

Dado que ya tienes configurado tu repositorio remoto de GitHub, puedes enviar tus cambios iniciales con los siguientes comandos:

```bash
# Agregar todos los archivos creados al control de versiones
git add .

# Crear el primer commit
git commit -m "feat: estructura base de worker e integración fetch con supabase"

# Enviar los cambios a la rama principal
git push -u origin main
```
