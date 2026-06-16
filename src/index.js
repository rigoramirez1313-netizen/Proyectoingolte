import { SupabaseClient } from './supabase.js';

export default {
  /**
   * Manejador de peticiones HTTP del Cloudflare Worker.
   * @param {Request} request 
   * @param {Object} env - Variables de entorno de Cloudflare
   * @param {Object} ctx - Contexto de ejecución
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Habilitar CORS para solicitudes de origen cruzado si fuera necesario
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PATCH, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. Endpoint para verificar conexión a Supabase (OpenAPI Schema o Tabla específica)
      if (url.pathname === '/api/test-db') {
        const supabaseUrl = env.SUPABASE_URL;
        const supabaseKey = env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Faltan variables de entorno. Configura SUPABASE_URL y SUPABASE_ANON_KEY." 
            }), 
            { 
              status: 400, 
              headers: { 'Content-Type': 'application/json', ...corsHeaders } 
            }
          );
        }

        const supabase = new SupabaseClient(supabaseUrl, supabaseKey);
        const targetTable = url.searchParams.get('table');

        if (targetTable) {
          // Si solicita una tabla específica, intentamos consultar los primeros 5 registros
          try {
            const data = await supabase.from(targetTable).select('*').limit(5);
            return new Response(
              JSON.stringify({ 
                success: true, 
                message: `Consulta exitosa a la tabla "${targetTable}"`, 
                data 
              }), 
              { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          } catch (err) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: `Error al consultar la tabla "${targetTable}": ${err.message}` 
              }), 
              { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          }
        } else {
          // Prueba general de conexión (obteniendo el esquema raíz de PostgREST)
          try {
            const schema = await supabase.request('', { method: 'GET' });
            return new Response(
              JSON.stringify({ 
                success: true, 
                message: "Conexión exitosa con el servidor Supabase REST API", 
                details: {
                  title: schema.info?.title || "Supabase API",
                  version: schema.info?.version || "Desconocida"
                }
              }), 
              { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          } catch (err) {
            return new Response(
              JSON.stringify({ 
                success: false, 
                error: `Error de autenticación/conexión con Supabase: ${err.message}` 
              }), 
              { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          }
        }
      }

      // 2. Ruta raíz - Servir consola de desarrollo interactiva y visual
      if (url.pathname === '/') {
        const supabaseConfigured = !!(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
        const html = getConsoleHTML(supabaseConfigured, env.SUPABASE_URL);
        return new Response(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // 3. Fallback - 404
      return new Response(
        JSON.stringify({ error: "Ruta no encontrada" }), 
        { 
          status: 404, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );

    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }), 
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }
  }
};

/**
 * Retorna el HTML de la consola interactiva con diseño premium.
 */
function getConsoleHTML(supabaseConfigured, supabaseUrl) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ingolte Workers Console</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-gradient: radial-gradient(circle at 50% 50%, #111424 0%, #080912 100%);
      --accent-color: #5d69eb;
      --accent-glow: rgba(93, 105, 235, 0.4);
      --success-color: #10b981;
      --success-glow: rgba(16, 185, 129, 0.4);
      --error-color: #ef4444;
      --error-glow: rgba(239, 68, 68, 0.4);
      --card-bg: rgba(255, 255, 255, 0.02);
      --card-border: rgba(255, 255, 255, 0.06);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Outfit', sans-serif;
      background: var(--bg-gradient);
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      padding: 2rem 1rem;
      overflow-x: hidden;
    }

    header {
      width: 100%;
      max-width: 900px;
      margin-bottom: 2.5rem;
      text-align: center;
      position: relative;
    }

    /* Efectos decorativos de fondo */
    .glow-sphere {
      position: absolute;
      width: 250px;
      height: 250px;
      border-radius: 50%;
      background: var(--accent-glow);
      filter: blur(100px);
      z-index: -1;
      top: -50px;
      left: 50%;
      transform: translateX(-50%);
    }

    h1 {
      font-size: 2.8rem;
      font-weight: 800;
      letter-spacing: -1px;
      background: linear-gradient(135deg, #fff 30%, #5d69eb 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }

    .subtitle {
      color: #94a3b8;
      font-size: 1.1rem;
      font-weight: 300;
    }

    main {
      width: 100%;
      max-width: 900px;
      display: grid;
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    @media (min-width: 768px) {
      main {
        grid-template-columns: 1.2fr 1.8fr;
      }
    }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 16px;
      padding: 1.5rem;
      transition: transform 0.3s ease, border-color 0.3s ease;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }

    .card:hover {
      border-color: rgba(93, 105, 235, 0.2);
    }

    h2 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 1.2rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #f1f5f9;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.85rem;
      padding: 0.25rem 0.75rem;
      border-radius: 100px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      font-weight: 600;
    }

    .status-badge.online .indicator {
      background-color: var(--success-color);
      box-shadow: 0 0 8px var(--success-glow);
    }

    .status-badge.offline .indicator {
      background-color: var(--error-color);
      box-shadow: 0 0 8px var(--error-glow);
    }

    .indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }

    /* Listas y detalles */
    .detail-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      margin-top: 1rem;
    }

    .detail-item {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      padding-bottom: 0.5rem;
    }

    .detail-label {
      color: #64748b;
    }

    .detail-value {
      color: #cbd5e1;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Consola y outputs */
    .console-box {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      height: 100%;
    }

    .input-group {
      display: flex;
      gap: 0.5rem;
    }

    input {
      flex: 1;
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      color: #fff;
      font-family: inherit;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s;
    }

    input:focus {
      border-color: var(--accent-color);
      box-shadow: 0 0 0 2px var(--accent-glow);
    }

    button {
      background: var(--accent-color);
      color: white;
      border: none;
      border-radius: 8px;
      padding: 0.75rem 1.25rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    button:hover {
      background: #4b57d6;
    }

    button:active {
      transform: scale(0.98);
    }

    .output-area {
      flex: 1;
      min-height: 250px;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 1rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      color: #a7f3d0;
      overflow-y: auto;
      max-height: 400px;
      white-space: pre-wrap;
      box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.8);
    }

    .output-area.error {
      color: #fca5a5;
    }

    /* Enlaces útiles */
    .link-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.8rem;
      margin-top: 1rem;
    }

    .lnk-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.6rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      color: #94a3b8;
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 600;
      transition: all 0.2s;
    }

    .lnk-btn:hover {
      background: rgba(93, 105, 235, 0.1);
      border-color: var(--accent-color);
      color: #fff;
    }

    footer {
      margin-top: auto;
      padding-top: 3rem;
      color: #475569;
      font-size: 0.85rem;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="glow-sphere"></div>

  <header>
    <h1>Ingolte Worker</h1>
    <p class="subtitle">Consola de Desarrollo y Estado de Integración</p>
  </header>

  <main>
    <!-- Columna Izquierda: Información de Estado -->
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      
      <!-- Card Estado Worker -->
      <div class="card">
        <h2>
          <span>Worker</span>
          <span class="status-badge online" style="margin-left: auto;">
            <span class="indicator"></span>Activo
          </span>
        </h2>
        <ul class="detail-list">
          <li class="detail-item">
            <span class="detail-label">Entorno</span>
            <span class="detail-value">Production</span>
          </li>
          <li class="detail-item">
            <span class="detail-label">Endpoint</span>
            <span class="detail-value">https://proyectoingolte.rigo-ramirez-1313.workers.dev/</span>
          </li>
          <li class="detail-item">
            <span class="detail-label">Ubicación</span>
            <span class="detail-value">Cloudflare Edge</span>
          </li>
        </ul>
      </div>

      <!-- Card Estado Supabase -->
      <div class="card">
        <h2>
          <span>Supabase</span>
          <span class="status-badge ${supabaseConfigured ? 'online' : 'offline'}" style="margin-left: auto;" id="supabase-status-badge">
            <span class="indicator"></span>${supabaseConfigured ? 'Configurado' : 'Sin Configurar'}
          </span>
        </h2>
        <ul class="detail-list">
          <li class="detail-item">
            <span class="detail-label">URL del Proyecto</span>
            <span class="detail-value" title="${supabaseUrl || ''}">${supabaseUrl ? supabaseUrl.replace('https://', '') : 'No configurado'}</span>
          </li>
          <li class="detail-item">
            <span class="detail-label">Método Conexión</span>
            <span class="detail-value">Fetch API REST</span>
          </li>
        </ul>
        <div style="margin-top: 1.2rem;">
          <button id="btn-test-connection" style="width: 100%; justify-content: center; background: rgba(255,255,255,0.05); border: 1px solid var(--card-border); color: #cbd5e1;">
            Probar Conexión
          </button>
        </div>
      </div>

      <!-- Enlaces del proyecto -->
      <div class="card">
        <h2>Enlaces de Interés</h2>
        <div class="link-grid">
          <a class="lnk-btn" href="https://github.com/rigoramirez1313-netizen/Proyectoingolte" target="_blank">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>
            GitHub Repo
          </a>
          <a class="lnk-btn" href="https://supabase.com/dashboard" target="_blank">
            Supabase Console
          </a>
        </div>
      </div>

    </div>

    <!-- Columna Derecha: Consola Interactiva -->
    <div class="card" style="display: flex; flex-direction: column;">
      <div class="console-box">
        <h2>Consola de Consultas Supabase</h2>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-top: -0.5rem; margin-bottom: 0.5rem;">
          Ingresa el nombre de una tabla de tu base de datos para intentar traer registros mediante Fetch API directa.
        </p>
        <div class="input-group">
          <input type="text" id="table-input" placeholder="Nombre de tabla (ej. users, posts, tareas)" value="todos">
          <button id="btn-run-query">
            Consultar
          </button>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
          <span style="font-size: 0.8rem; color: #64748b;">Resultado de la consulta:</span>
          <span style="font-size: 0.8rem; color: #64748b;" id="execution-time"></span>
        </div>
        
        <pre class="output-area" id="console-output">Listo para ejecutar consultas...
Haz clic en "Probar Conexión" o ingresa una tabla y pulsa "Consultar".</pre>
      </div>
    </div>
  </main>

  <footer>
    <p>Proyecto Ingolte &copy; 2026. Creado con JS Moderno en Cloudflare Workers.</p>
  </footer>

  <script>
    const btnTest = document.getElementById('btn-test-connection');
    const btnQuery = document.getElementById('btn-run-query');
    const tableInput = document.getElementById('table-input');
    const consoleOutput = document.getElementById('console-output');
    const timeSpan = document.getElementById('execution-time');

    async function runTest() {
      consoleOutput.classList.remove('error');
      consoleOutput.textContent = 'Enviando petición de verificación a Supabase...';
      const start = performance.now();
      try {
        const res = await fetch('/api/test-db');
        const data = await res.json();
        const end = performance.now();
        timeSpan.textContent = \`\${Math.round(end - start)} ms\`;
        
        if (data.success) {
          consoleOutput.textContent = JSON.stringify(data, null, 2);
          updateBadge(true);
        } else {
          consoleOutput.classList.add('error');
          consoleOutput.textContent = 'Error en respuesta:\\n' + JSON.stringify(data, null, 2);
          updateBadge(false);
        }
      } catch (err) {
        consoleOutput.classList.add('error');
        consoleOutput.textContent = 'Error de Red / Worker:\\n' + err.message;
        updateBadge(false);
      }
    }

    async function runQuery() {
      const table = tableInput.value.trim();
      if (!table) {
        alert('Por favor introduce el nombre de una tabla.');
        return;
      }
      consoleOutput.classList.remove('error');
      consoleOutput.textContent = \`Consultando tabla "\${table}"... Por favor espera...\`;
      const start = performance.now();
      try {
        const res = await fetch(\`/api/test-db?table=\${encodeURIComponent(table)}\`);
        const data = await res.json();
        const end = performance.now();
        timeSpan.textContent = \`\${Math.round(end - start)} ms\`;

        if (data.success) {
          consoleOutput.textContent = JSON.stringify(data.data, null, 2);
        } else {
          consoleOutput.classList.add('error');
          consoleOutput.textContent = 'Error:\\n' + (data.error || JSON.stringify(data, null, 2));
        }
      } catch (err) {
        consoleOutput.classList.add('error');
        consoleOutput.textContent = 'Error de Red / Worker:\\n' + err.message;
      }
    }

    function updateBadge(configured) {
      const badge = document.getElementById('supabase-status-badge');
      if (configured) {
        badge.className = 'status-badge online';
        badge.innerHTML = '<span class="indicator"></span>Conectado';
      } else {
        badge.className = 'status-badge offline';
        badge.innerHTML = '<span class="indicator"></span>Error de Conexión';
      }
    }

    btnTest.addEventListener('click', runTest);
    btnQuery.addEventListener('click', runQuery);
  </script>
</body>
</html>`;
}
