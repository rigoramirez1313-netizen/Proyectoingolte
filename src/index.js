import { SupabaseClient } from './supabase.js';

export default {
  /**
   * Manejador de peticiones HTTP del Cloudflare Worker.
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Habilitar CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PATCH, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. Endpoint para enviar las respuestas a la base de datos de Supabase
      if (url.pathname === '/api/submit' && request.method === 'POST') {
        const supabaseUrl = env.SUPABASE_URL;
        const supabaseKey = env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Faltan variables de entorno en el Worker para conectar con Supabase." 
            }), 
            { 
              status: 500, 
              headers: { 'Content-Type': 'application/json', ...corsHeaders } 
            }
          );
        }

        const supabase = new SupabaseClient(supabaseUrl, supabaseKey);
        const data = await request.json();

        // Limpiar campos ramificados no utilizados para evitar conflictos en la BD
        if (data.dinamica_trabajo === '100% Oficina') {
          data.reto_alternar_hibrido = null;
          data.dificultad_registro_campo = null;
        } else if (data.dinamica_trabajo === 'Híbrido') {
          data.horas_busqueda_datos_oficina = null;
          data.dificultad_registro_campo = null;
        } else if (data.dinamica_trabajo === 'Trabajo de Campo/Externo') {
          data.horas_busqueda_datos_oficina = null;
          data.reto_alternar_hibrido = null;
        }

        const result = await supabase.from('respuestas_formulario').insert(data);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "¡Formulario guardado con éxito en Supabase!", 
            data: result 
          }), 
          { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      // 2. Endpoint para verificar conexión a Supabase (de la versión anterior)
      if (url.pathname === '/api/test-db') {
        const supabaseUrl = env.SUPABASE_URL;
        const supabaseKey = env.SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
          return new Response(
            JSON.stringify({ 
              success: false, 
              error: "Faltan variables de entorno." 
            }), 
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        const supabase = new SupabaseClient(supabaseUrl, supabaseKey);
        const targetTable = url.searchParams.get('table');

        if (targetTable) {
          try {
            const data = await supabase.from(targetTable).select('*').limit(5);
            return new Response(
              JSON.stringify({ success: true, message: `Consulta exitosa a "${targetTable}"`, data }), 
              { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          } catch (err) {
            return new Response(
              JSON.stringify({ success: false, error: err.message }), 
              { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          }
        } else {
          try {
            const schema = await supabase.request('', { method: 'GET' });
            return new Response(
              JSON.stringify({ 
                success: true, 
                message: "Conectado a Supabase", 
                details: { title: schema.info?.title, version: schema.info?.version }
              }), 
              { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          } catch (err) {
            return new Response(
              JSON.stringify({ success: false, error: err.message }), 
              { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          }
        }
      }

      // 3. Consola de pruebas/administración del Worker (guardada en /console)
      if (url.pathname === '/console') {
        const supabaseConfigured = !!(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
        const html = getConsoleHTML(supabaseConfigured, env.SUPABASE_URL);
        return new Response(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // 4. Ruta raíz (/) - Servir el Formulario Interactivo GSAP
      if (url.pathname === '/') {
        const html = getFormularioHTML();
        return new Response(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }

      // Fallback 404
      return new Response(JSON.stringify({ error: "Ruta no encontrada" }), { 
        status: 404, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });

    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      });
    }
  }
};

/**
 * Retorna el HTML del Formulario de Diagnóstico Interactivo.
 */
function getFormularioHTML() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Diagnóstico de Adopción de IA - INGOLTE S.A.</title>
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  
  <!-- GSAP Core -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
  
  <!-- Canvas Confetti -->
  <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"></script>

  <style>
    :root {
      --bg: #090b11;
      --card-bg: #111625; /* Fondo sólido oscuro para evitar parpadeos en Android Chrome */
      --card-border: rgba(255, 255, 255, 0.08);
      --accent: #10b981;
      --accent-rgb: 16, 185, 129;
      --accent-glow: rgba(16, 185, 129, 0.15);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --error: #f43f5e;
      --font-sans: 'Outfit', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }

    body {
      font-family: var(--font-sans);
      background-color: var(--bg);
      background-image: radial-gradient(circle at 50% 20%, #131b2e 0%, var(--bg) 100%);
      color: var(--text-main);
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      overflow-x: hidden;
    }

    /* Contenedor principal con limitación de ancho */
    .form-wrapper {
      width: 100%;
      max-width: 500px;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      position: relative;
    }

    /* Barra de Progreso Superior */
    .progress-container {
      width: 100%;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 100px;
      height: 6px;
      overflow: hidden;
      position: relative;
    }

    .progress-bar {
      height: 100%;
      width: 0%;
      background: linear-gradient(90deg, var(--accent) 0%, #34d399 100%);
      border-radius: 100px;
      box-shadow: 0 0 8px rgba(16, 185, 129, 0.5);
    }

    .progress-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
      color: var(--text-muted);
      padding: 0 0.25rem;
    }

    .logo-container {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: #fff;
    }

    .logo-badge {
      background: var(--accent);
      color: var(--bg);
      padding: 0.15rem 0.4rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    /* Contenedor de Tarjetas (GSAP Slider) */
    .cards-viewport {
      position: relative;
      width: 100%;
      min-height: 480px;
      display: grid;
      grid-template-columns: 1fr;
      grid-template-rows: 1fr;
    }

    .step-card {
      grid-area: 1 / 1 / 2 / 2;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 24px;
      padding: 2rem 1.5rem;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
      display: none; /* Ocultar físicamente por defecto */
      flex-direction: column;
      justify-content: space-between;
      gap: 1.5rem;
      opacity: 0;
      pointer-events: none;
      transform: scale(0.95) translateY(20px);
      transition: border-color 0.3s;
      will-change: transform, opacity;
      -webkit-backface-visibility: hidden;
      backface-visibility: hidden;
    }

    .step-card.active {
      display: flex !important; /* Mostrar físicamente solo la tarjeta activa */
      opacity: 1;
      pointer-events: auto;
      transform: scale(1) translateY(0);
      position: relative;
      z-index: 10;
    }

    /* Cabecera de la Tarjeta */
    .card-header {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .block-tag {
      font-size: 0.75rem;
      font-family: var(--font-mono);
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-weight: 600;
    }

    .question-title {
      font-size: 1.35rem;
      font-weight: 600;
      line-height: 1.3;
      color: var(--text-main);
    }

    .question-desc {
      font-size: 0.9rem;
      color: var(--text-muted);
      line-height: 1.4;
    }

    /* Cuerpo de la Tarjeta (Inputs/Opciones) */
    .card-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.75rem;
      width: 100%;
    }

    /* Campos de Entrada de Texto */
    .text-input-wrapper {
      position: relative;
      width: 100%;
    }

    input[type="text"], textarea {
      width: 100%;
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 1rem;
      color: #fff;
      font-family: inherit;
      font-size: 1rem;
      outline: none;
      transition: all 0.2s;
    }

    input[type="text"]:focus, textarea:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px var(--accent-glow);
      background: rgba(0, 0, 0, 0.35);
    }

    textarea {
      resize: none;
      min-height: 120px;
    }

    .char-counter {
      position: absolute;
      right: 0.75rem;
      bottom: 0.75rem;
      font-size: 0.75rem;
      color: var(--text-dim);
    }

    /* Opciones tipo Tarjeta Selectable (Radio / Checkbox) */
    .option-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 14px;
      padding: 1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      user-select: none;
    }

    .option-card:hover {
      background: rgba(255, 255, 255, 0.04);
      border-color: rgba(255, 255, 255, 0.12);
      transform: translateY(-1px);
    }

    .option-card:active {
      transform: scale(0.98);
    }

    .option-card.selected {
      border-color: var(--accent);
      background: rgba(var(--accent-rgb), 0.08);
      box-shadow: 0 0 12px rgba(var(--accent-rgb), 0.05);
    }

    /* Indicador Circular de Selección */
    .checkbox-indicator {
      width: 20px;
      height: 20px;
      border-radius: 6px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      flex-shrink: 0;
    }

    .radio-indicator {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      flex-shrink: 0;
    }

    .option-card.selected .checkbox-indicator {
      border-color: var(--accent);
      background: var(--accent);
    }

    .option-card.selected .radio-indicator {
      border-color: var(--accent);
    }

    .option-card.selected .radio-indicator::after {
      content: "";
      width: 10px;
      height: 10px;
      background: var(--accent);
      border-radius: 50%;
      display: block;
    }

    .checkbox-indicator::after {
      content: "✓";
      color: var(--bg);
      font-size: 0.8rem;
      font-weight: 800;
      opacity: 0;
      transition: opacity 0.15s;
    }

    .option-card.selected .checkbox-indicator::after {
      opacity: 1;
    }

    .option-text {
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--text-muted);
      line-height: 1.35;
      transition: color 0.2s;
    }

    .option-card.selected .option-text {
      color: var(--text-main);
    }

    /* Escala Likert (Botones Circulares) */
    .likert-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      width: 100%;
      margin: 0.5rem 0;
    }

    .likert-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }

    .likert-btn {
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.06);
      color: var(--text-muted);
      font-family: var(--font-sans);
      font-size: 1.15rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      user-select: none;
    }

    .likert-btn:hover {
      border-color: rgba(255, 255, 255, 0.2);
      color: var(--text-main);
      transform: scale(1.08);
    }

    .likert-btn:active {
      transform: scale(0.95);
    }

    .likert-btn.selected {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--bg);
      box-shadow: 0 0 15px var(--accent-glow);
      transform: scale(1.12);
    }

    .likert-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      color: var(--text-dim);
      font-weight: 500;
      padding: 0 0.25rem;
      line-height: 1.3;
    }

    .likert-label-end {
      text-align: right;
    }

    /* Botones de Navegación */
    .navigation-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
    }

    .nav-btn {
      font-family: var(--font-sans);
      font-size: 0.95rem;
      font-weight: 600;
      padding: 0.9rem 1.5rem;
      border-radius: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      transition: all 0.2s;
      border: none;
      outline: none;
      user-select: none;
    }

    .btn-back {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      color: var(--text-muted);
      flex: 1;
    }

    .btn-back:hover {
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-main);
      border-color: rgba(255, 255, 255, 0.15);
    }

    .btn-next {
      background: var(--accent);
      color: var(--bg);
      flex: 2;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.2);
    }

    .btn-next:hover {
      background: #34d399;
      transform: translateY(-1px);
    }

    .btn-next:active, .btn-back:active {
      transform: scale(0.98);
    }

    .btn-next:disabled {
      opacity: 0.3;
      cursor: not-allowed;
      background: var(--text-dim);
      color: var(--bg);
      box-shadow: none;
      transform: none;
    }

    /* Mensaje de Error de Validación */
    .validation-error {
      color: var(--error);
      font-size: 0.8rem;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 0.35rem;
      opacity: 0;
      transform: translateY(-5px);
      transition: all 0.2s;
      margin-top: 0.25rem;
      min-height: 1.2rem;
    }

    .validation-error.visible {
      opacity: 1;
      transform: translateY(0);
    }

    /* Pantalla de Carga (Skeletal o Spinner) */
    .loader-overlay {
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      position: absolute;
      inset: 0;
      background: rgba(9, 11, 17, 0.9);
      border-radius: 24px;
      z-index: 100;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(16, 185, 129, 0.1);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Resumen de respuestas antes de enviar */
    .summary-scroll {
      max-height: 250px;
      overflow-y: auto;
      padding-right: 0.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .summary-scroll::-webkit-scrollbar {
      width: 4px;
    }

    .summary-scroll::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.1);
    }

    .summary-scroll::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
    }

    .summary-item {
      background: rgba(0, 0, 0, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.03);
      padding: 0.75rem;
      border-radius: 8px;
    }

    .summary-q {
      font-size: 0.8rem;
      color: var(--text-dim);
      margin-bottom: 0.2rem;
    }

    .summary-a {
      font-size: 0.9rem;
      color: var(--text-main);
      font-weight: 500;
    }

    /* Clases de animación GSAP */
    .animate-fade-up {
      opacity: 0;
      transform: translateY(15px);
    }

    footer {
      text-align: center;
      font-size: 0.8rem;
      color: var(--text-dim);
      margin-top: 1rem;
      padding: 1rem 0;
    }
  </style>
</head>
<body>

  <div class="form-wrapper">
    <!-- Cabecera e Integración Visual -->
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div class="logo-container">
        <span>INGOLTE</span>
        <span class="logo-badge">IA</span>
      </div>
      <div class="progress-info">
        <span id="step-number-text">Cargando...</span>
      </div>
    </div>

    <!-- Barra de progreso -->
    <div class="progress-container">
      <div class="progress-bar" id="progress-bar-el"></div>
    </div>

    <!-- Tarjetas del Formulario (GSAP Viewport) -->
    <div class="cards-viewport" id="cards-container">
      
      <!-- CARD 0: INTRODUCCIÓN -->
      <div class="step-card active" id="step-intro">
        <div class="card-header">
          <span class="block-tag">BIENVENIDO</span>
          <h1 class="question-title">Evolucionamos Juntos</h1>
          <p class="question-desc" style="margin-top: 0.5rem;">
            En <strong>INGOLTE S.A.</strong> queremos conocer cómo interactúas con la tecnología hoy para brindarte las mejores herramientas y potenciar tu día a día en la administración y gestión con nuestros asociados.
          </p>
          <p class="question-desc" style="margin-top: 0.5rem;">
            Tus respuestas nos ayudarán a diseñar un programa de innovación a tu medida. No hay respuestas correctas o incorrectas.
          </p>
        </div>
        <div class="card-body">
          <!-- Ilustración estética simple -->
          <div style="display: flex; justify-content: center; align-items: center; padding: 1.5rem 0;">
            <img src="data:image/png;base64,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" alt="Logo INGOLTE" style="width: 120px; height: 120px; object-fit: contain;">
          </div>
        </div>
        <div class="navigation-row">
          <button class="btn-next" id="btn-start-form">Comenzar Diagnóstico</button>
        </div>
      </div>

      <!-- CARD 1: NOMBRE COMPLETO -->
      <div class="step-card" id="step-nombre">
        <div class="card-header">
          <span class="block-tag">Bloque 1 / Perfil</span>
          <h2 class="question-title">¿Cuál es tu nombre completo y/o número de identificación?</h2>
        </div>
        <div class="card-body">
          <div class="text-input-wrapper animate-fade-up">
            <input type="text" id="input-nombre" placeholder="Nombre completo o ID" autocomplete="name">
          </div>
          <div class="validation-error" id="error-nombre">Por favor ingresa tu nombre o identificación.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 2: DINÁMICA DE TRABAJO (PREGUNTA RAMIFICACIÓN) -->
      <div class="step-card" id="step-dinamica">
        <div class="card-header">
          <span class="block-tag">Bloque 1 / Perfil</span>
          <h2 class="question-title">¿Cuál opción describe mejor tu dinámica de trabajo diario en INGOLTE?</h2>
          <p class="question-desc">Esta pregunta personalizará algunas preguntas más adelante.</p>
        </div>
        <div class="card-body" style="gap: 0.6rem;">
          <div class="option-card animate-fade-up" data-value="100% Oficina">
            <div class="radio-indicator"></div>
            <span class="option-text"><strong>100% Oficina:</strong> Principalmente frente al computador gestionando inversiones o administración.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Híbrido">
            <div class="radio-indicator"></div>
            <span class="option-text"><strong>Híbrido:</strong> Entre oficina (computador) y gestiones externas con asociados (celular/tablet).</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Trabajo de Campo/Externo">
            <div class="radio-indicator"></div>
            <span class="option-text"><strong>Campo/Externo:</strong> Principalmente en la calle con asociados, mi principal herramienta es el celular.</span>
          </div>
          <div class="validation-error" id="error-dinamica">Por favor selecciona una opción.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 3: DISPOSITIVOS -->
      <div class="step-card" id="step-dispositivos">
        <div class="card-header">
          <span class="block-tag">Bloque 1 / Perfil</span>
          <h2 class="question-title">¿Qué dispositivos utilizas habitualmente para tus funciones?</h2>
          <p class="question-desc">Puedes seleccionar varias opciones.</p>
        </div>
        <div class="card-body" style="gap: 0.5rem;">
          <div class="option-card animate-fade-up" data-value="Computador de escritorio/Portátil corporativo" data-multiple="true">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Computador de escritorio/Portátil corporativo</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Computador personal" data-multiple="true">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Computador personal</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Teléfono celular corporativo" data-multiple="true">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Teléfono celular corporativo</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Teléfono celular personal" data-multiple="true">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Teléfono celular personal</span>
          </div>
          <div class="validation-error" id="error-dispositivos">Selecciona al menos un dispositivo.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 4: INFORMACIÓN FRECUENTE -->
      <div class="step-card" id="step-informacion">
        <div class="card-header">
          <span class="block-tag">Bloque 1 / Perfil</span>
          <h2 class="question-title">¿Con qué tipo de información interactúas con mayor frecuencia en tu día a día?</h2>
          <p class="question-desc">Selección múltiple.</p>
        </div>
        <div class="card-body" style="gap: 0.5rem;">
          <div class="option-card animate-fade-up" data-value="Datos financieros y portafolios de inversión" data-multiple="true">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Datos financieros y portafolios de inversión</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Documentación legal, contratos y firmas" data-multiple="true">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Documentación legal, contratos y firmas</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Correos electrónicos y atención general" data-multiple="true">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Correos electrónicos y atención general</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Bases de datos internas y contabilidad" data-multiple="true">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Bases de datos internas y contabilidad</span>
          </div>
          <div class="validation-error" id="error-informacion">Selecciona al menos un tipo de información.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 5: DEPENDENCIA DEL PAPEL -->
      <div class="step-card" id="step-dependencia_papel">
        <div class="card-header">
          <span class="block-tag">Bloque 1 / Perfil</span>
          <h2 class="question-title">¿Qué tan dependiente es tu trabajo actual del manejo de documentos físicos (papel)?</h2>
        </div>
        <div class="card-body">
          <div class="likert-container animate-fade-up">
            <div class="likert-row">
              <div class="likert-btn" data-value="1">1</div>
              <div class="likert-btn" data-value="2">2</div>
              <div class="likert-btn" data-value="3">3</div>
              <div class="likert-btn" data-value="4">4</div>
              <div class="likert-btn" data-value="5">5</div>
            </div>
            <div class="likert-labels">
              <span>1<br>Nada dependiente<br>(Todo es digital)</span>
              <span class="likert-label-end">5<br>Totalmente<br>dependiente</span>
            </div>
          </div>
          <div class="validation-error" id="error-dependencia_papel">Selecciona una calificación de la escala.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 6: CONOCIMIENTO IA -->
      <div class="step-card" id="step-nivel_conocimiento">
        <div class="card-header">
          <span class="block-tag">Bloque 2 / IA</span>
          <h2 class="question-title">¿Cómo calificarías tu nivel de conocimiento sobre Inteligencia Artificial Generativa?</h2>
        </div>
        <div class="card-body">
          <div class="likert-container animate-fade-up">
            <div class="likert-row">
              <div class="likert-btn" data-value="1">1</div>
              <div class="likert-btn" data-value="2">2</div>
              <div class="likert-btn" data-value="3">3</div>
              <div class="likert-btn" data-value="4">4</div>
              <div class="likert-btn" data-value="5">5</div>
            </div>
            <div class="likert-labels">
              <span>1<br>No sé nada</span>
              <span class="likert-label-end">5<br>La entiendo y la<br>aplico constantemente</span>
            </div>
          </div>
          <div class="validation-error" id="error-nivel_conocimiento">Selecciona una calificación de la escala.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 7: HERRAMIENTAS UTILIZADAS -->
      <div class="step-card" id="step-herramientas" style="padding-top: 1.5rem; padding-bottom: 1.5rem;">
        <div class="card-header">
          <span class="block-tag">Bloque 2 / IA</span>
          <h2 class="question-title" style="font-size: 1.25rem;">Durante el último mes, ¿cuáles herramientas has utilizado (personal o laboral)?</h2>
        </div>
        <div class="card-body" style="gap: 0.45rem; max-height: 280px; overflow-y: auto;">
          <div class="option-card" data-value="ChatGPT" data-multiple="true">
            <div class="checkbox-indicator"></div>
            <span class="option-text">ChatGPT (OpenAI)</span>
          </div>
          <div class="option-card" data-value="Microsoft Copilot" data-multiple="true">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Microsoft Copilot</span>
          </div>
          <div class="option-card" data-value="Gemini" data-multiple="true">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Gemini (Google)</span>
          </div>
          <div class="option-card" data-value="Claude" data-multiple="true">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Claude (Anthropic)</span>
          </div>
          <div class="option-card" data-value="Perplexity" data-multiple="true">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Perplexity AI</span>
          </div>
          <div class="option-card" data-value="NotebookLM" data-multiple="true">
            <div class="checkbox-indicator"></div>
            <span class="option-text">NotebookLM (Análisis de documentos)</span>
          </div>
          <div class="option-card" data-value="Asistentes de reunión" data-multiple="true">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Transcripción (Fireflies, Otter, Teams)</span>
          </div>
          <div class="option-card" data-value="Ninguna de las anteriores" data-multiple="true" id="opt-ninguna-herramienta">
            <div class="checkbox-indicator"></div>
            <span class="option-text" style="color: var(--error);">Ninguna de las anteriores</span>
          </div>
          <div class="validation-error" id="error-herramientas">Selecciona al menos una opción.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 8: FRECUENCIA DE USO -->
      <div class="step-card" id="step-frecuencia_uso">
        <div class="card-header">
          <span class="block-tag">Bloque 2 / IA</span>
          <h2 class="question-title">¿Con qué frecuencia utilizas herramientas de Inteligencia Artificial en tu día a día?</h2>
        </div>
        <div class="card-body" style="gap: 0.6rem;">
          <div class="option-card animate-fade-up" data-value="Todos los días">
            <div class="radio-indicator"></div>
            <span class="option-text">Todos los días.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Varias veces a la semana">
            <div class="radio-indicator"></div>
            <span class="option-text">Varias veces a la semana.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Rara vez (1 o 2 veces al mes)">
            <div class="radio-indicator"></div>
            <span class="option-text">Rara vez (1 o 2 veces al mes).</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Nunca las he utilizado">
            <div class="radio-indicator"></div>
            <span class="option-text">Nunca las he utilizado.</span>
          </div>
          <div class="validation-error" id="error-frecuencia_uso">Por favor selecciona una frecuencia.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 9: DISPOSITIVO PRINCIPAL IA -->
      <div class="step-card" id="step-dispositivo_principal">
        <div class="card-header">
          <span class="block-tag">Bloque 2 / IA</span>
          <h2 class="question-title">Cuando utilizas herramientas de IA, ¿desde qué dispositivo lo haces principalmente?</h2>
        </div>
        <div class="card-body" style="gap: 0.6rem;">
          <div class="option-card animate-fade-up" data-value="Exclusivamente desde mi computador">
            <div class="radio-indicator"></div>
            <span class="option-text">Exclusivamente desde mi computador (oficina/casa).</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Principalmente desde mi celular">
            <div class="radio-indicator"></div>
            <span class="option-text">Principalmente desde mi celular (aplicaciones).</span>
          </div>
          <div class="option-card animate-fade-up" data-value="De forma mixta">
            <div class="radio-indicator"></div>
            <span class="option-text">De forma mixta (computador y celular).</span>
          </div>
          <div class="option-card animate-fade-up" data-value="No aplica (no las uso)">
            <div class="radio-indicator"></div>
            <span class="option-text">No aplica (no las uso).</span>
          </div>
          <div class="validation-error" id="error-dispositivo_principal">Por favor selecciona una opción.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 10: USO TAREAS EMPRESA -->
      <div class="step-card" id="step-uso_tareas">
        <div class="card-header">
          <span class="block-tag">Bloque 2 / IA</span>
          <h2 class="question-title">¿Has utilizado alguna de estas herramientas para una tarea específica en INGOLTE S.A.?</h2>
        </div>
        <div class="card-body" style="gap: 0.6rem;">
          <div class="option-card animate-fade-up" data-value="Sí, me ahorró mucho tiempo">
            <div class="radio-indicator"></div>
            <span class="option-text">Sí, me ahorró mucho tiempo.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Sí, pero el resultado no fue lo que esperaba">
            <div class="radio-indicator"></div>
            <span class="option-text">Sí, pero el resultado no fue lo esperado.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="No, no sé cómo aplicarlo a mi trabajo">
            <div class="radio-indicator"></div>
            <span class="option-text">No, no sé cómo aplicarlo a mi trabajo.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="No, me preocupa infringir normas de la empresa">
            <div class="radio-indicator"></div>
            <span class="option-text">No, me preocupa infringir normas internas.</span>
          </div>
          <div class="validation-error" id="error-uso_tareas">Por favor selecciona una opción.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 11: TAREAS DE AHORRO DE TIEMPO (MAX 3) -->
      <div class="step-card" id="step-tareas_ahorro">
        <div class="card-header">
          <span class="block-tag">Bloque 3 / Productividad</span>
          <h2 class="question-title">¿En qué tareas consideras que la IA podría ahorrarte más tiempo hoy en día?</h2>
          <p class="question-desc">Selecciona <strong>hasta 3 opciones</strong>.</p>
        </div>
        <div class="card-body" style="gap: 0.5rem;">
          <div class="option-card animate-fade-up" data-value="Redactar correos, comunicados" data-multiple="true" data-max="3">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Redactar correos o respuestas a asociados.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Resumir documentos extensos, contratos" data-multiple="true" data-max="3">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Resumir documentos extensos y contratos.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Analizar datos financieros, Excel" data-multiple="true" data-max="3">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Analizar datos financieros o tablas Excel.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Buscar información sobre procedimientos" data-multiple="true" data-max="3">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Buscar información de procedimientos internos.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Organizar agenda y recordatorios" data-multiple="true" data-max="3">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Organizar mi agenda y seguimientos.</span>
          </div>
          <div class="validation-error" id="error-tareas_ahorro">Selecciona entre 1 y 3 opciones máximo.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 12: IMPACTO PRODUCTIVIDAD -->
      <div class="step-card" id="step-impacto_productividad">
        <div class="card-header">
          <span class="block-tag">Bloque 3 / Productividad</span>
          <h2 class="question-title">¿Cuánto impacto positivo crees que tendría la IA en tu productividad diaria?</h2>
        </div>
        <div class="card-body">
          <div class="likert-container animate-fade-up">
            <div class="likert-row">
              <div class="likert-btn" data-value="1">1</div>
              <div class="likert-btn" data-value="2">2</div>
              <div class="likert-btn" data-value="3">3</div>
              <div class="likert-btn" data-value="4">4</div>
              <div class="likert-btn" data-value="5">5</div>
            </div>
            <div class="likert-labels">
              <span>1<br>Ninguno</span>
              <span class="likert-label-end">5<br>Transformaría mi<br>forma de trabajar</span>
            </div>
          </div>
          <div class="validation-error" id="error-impacto_productividad">Selecciona una calificación de la escala.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 13A: RAMIFICACIÓN OFICINA -->
      <div class="step-card" id="step-ramificada_oficina">
        <div class="card-header">
          <span class="block-tag">Bloque 3 / Oficina</span>
          <h2 class="question-title">¿Aproximadamente cuántas horas a la semana dedicas exclusivamente a buscar datos en documentos o reportes?</h2>
        </div>
        <div class="card-body" style="gap: 0.6rem;">
          <div class="option-card animate-fade-up" data-value="Menos de 2h">
            <div class="radio-indicator"></div>
            <span class="option-text">Menos de 2 horas.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Entre 2h y 5h">
            <div class="radio-indicator"></div>
            <span class="option-text">Entre 2 y 5 horas.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Más de 5h">
            <div class="radio-indicator"></div>
            <span class="option-text">Más de 5 horas a la semana.</span>
          </div>
          <div class="validation-error" id="error-ramificada_oficina">Selecciona una opción.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 13B: RAMIFICACIÓN HÍBRIDO -->
      <div class="step-card" id="step-ramificada_hibrido">
        <div class="card-header">
          <span class="block-tag">Bloque 3 / Híbrido</span>
          <h2 class="question-title">¿Cuál es tu mayor reto al alternar entre la oficina y el trabajo externo con asociados?</h2>
        </div>
        <div class="card-body" style="gap: 0.6rem;">
          <div class="option-card animate-fade-up" data-value="Mantener la información sincronizada">
            <div class="radio-indicator"></div>
            <span class="option-text">Mantener la información sincronizada.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Responder rápido cuando estoy en la calle">
            <div class="radio-indicator"></div>
            <span class="option-text">Responder rápido estando en la calle.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Tomar notas en movimiento">
            <div class="radio-indicator"></div>
            <span class="option-text">Tomar notas en pleno movimiento.</span>
          </div>
          <div class="validation-error" id="error-ramificada_hibrido">Selecciona una opción.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 13C: RAMIFICACIÓN CAMPO -->
      <div class="step-card" id="step-ramificada_campo">
        <div class="card-header">
          <span class="block-tag">Bloque 3 / Campo</span>
          <h2 class="question-title">¿Qué tanta dificultad tienes para registrar visitas o consultar datos usando solo tu celular?</h2>
        </div>
        <div class="card-body">
          <div class="likert-container animate-fade-up">
            <div class="likert-row">
              <div class="likert-btn" data-value="1">1</div>
              <div class="likert-btn" data-value="2">2</div>
              <div class="likert-btn" data-value="3">3</div>
              <div class="likert-btn" data-value="4">4</div>
              <div class="likert-btn" data-value="5">5</div>
            </div>
            <div class="likert-labels">
              <span>1<br>Muy fácil</span>
              <span class="likert-label-end">5<br>Muy difícil<br>y frustrante</span>
            </div>
          </div>
          <div class="validation-error" id="error-ramificada_campo">Selecciona una opción de la escala.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 14: ASPECTO VALORADO -->
      <div class="step-card" id="step-aspecto_valorado">
        <div class="card-header">
          <span class="block-tag">Bloque 3 / Atención</span>
          <h2 class="question-title">Pensando en la gestión con asociados, ¿qué aspecto valoran ellos más de tu atención?</h2>
        </div>
        <div class="card-body" style="gap: 0.6rem;">
          <div class="option-card animate-fade-up" data-value="Rapidez de respuesta">
            <div class="radio-indicator"></div>
            <span class="option-text">Rapidez de respuesta.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Precisión de los datos">
            <div class="radio-indicator"></div>
            <span class="option-text">Precisión y veracidad de los datos.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Trato personalizado">
            <div class="radio-indicator"></div>
            <span class="option-text">Trato personalizado y humano.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Claridad en la información">
            <div class="radio-indicator"></div>
            <span class="option-text">Claridad y sencillez en la información.</span>
          </div>
          <div class="validation-error" id="error-aspecto_valorado">Por favor selecciona una opción.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 15: ASISTENTE VIRTUAL DELEGABLE -->
      <div class="step-card" id="step-asistente_virtual">
        <div class="card-header">
          <span class="block-tag">Bloque 3 / Delegación</span>
          <h2 class="question-title">Si pudieras tener un "asistente virtual", ¿qué tarea repetitiva le delegarías para siempre?</h2>
          <p class="question-desc">Describe brevemente la tarea que te gustaría automatizar.</p>
        </div>
        <div class="card-body">
          <div class="text-input-wrapper animate-fade-up">
            <textarea id="input-asistente" placeholder="Escribe aquí la tarea repetitiva o aburrida..." maxlength="500"></textarea>
            <span class="char-counter" id="char-counter-el">0 / 500</span>
          </div>
          <div class="validation-error" id="error-asistente">Por favor describe una tarea para continuar.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 16: CONFIANZA REVISIÓN -->
      <div class="step-card" id="step-confianza_revision">
        <div class="card-header">
          <span class="block-tag">Bloque 4 / Seguridad</span>
          <h2 class="question-title">Si una IA te genera un informe o respuesta, ¿qué confianza tendrías en enviarla sin revisarla?</h2>
        </div>
        <div class="card-body" style="gap: 0.6rem;">
          <div class="option-card animate-fade-up" data-value="Confianza total, la enviaría directo">
            <div class="radio-indicator"></div>
            <span class="option-text">Confianza total, la enviaría de inmediato.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Confianza parcial, le daría una lectura rápida">
            <div class="radio-indicator"></div>
            <span class="option-text">Confianza parcial, le daría una lectura rápida.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Poca confianza, revisaría cada dato cuidadosamente">
            <div class="radio-indicator"></div>
            <span class="option-text">Poca confianza, revisaría cada dato a detalle.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Ninguna confianza, prefiero hacerlo yo mismo">
            <div class="radio-indicator"></div>
            <span class="option-text">Ninguna confianza, prefiero redactarlo yo mismo.</span>
          </div>
          <div class="validation-error" id="error-confianza_revision">Por favor selecciona una opción.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 17: PREOCUPACIONES USO IA -->
      <div class="step-card" id="step-preocupaciones" style="padding-top: 1.5rem; padding-bottom: 1.5rem;">
        <div class="card-header">
          <span class="block-tag">Bloque 4 / Seguridad</span>
          <h2 class="question-title" style="font-size: 1.25rem;">Dado que manejamos inversiones, ¿cuál es tu mayor preocupación al usar IA?</h2>
          <p class="question-desc">Selección múltiple.</p>
        </div>
        <div class="card-body" style="gap: 0.45rem;">
          <div class="option-card" data-value="Filtrar información confidencial de asociados" data-multiple="true">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Filtrar por error datos confidenciales de asociados.</span>
          </div>
          <div class="option-card" data-value="Que la IA alucine y cometa error legal" data-multiple="true">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Alucinaciones de la IA (datos falsos o errores legales).</span>
          </div>
          <div class="option-card" data-value="Perder el toque humano con el asociado" data-multiple="true">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Perder el toque humano en la atención.</span>
          </div>
          <div class="option-card" data-value="Que las herramientas reemplacen mi labor" data-multiple="true">
            <div class="checkbox-indicator"></div>
            <span class="option-text">Que terminen reemplazando mi puesto.</span>
          </div>
          <div class="option-card" data-value="No tengo ninguna preocupación" data-multiple="true" id="opt-ninguna-preocupacion">
            <div class="checkbox-indicator"></div>
            <span class="option-text" style="color: #34d399;">No tengo ninguna preocupación.</span>
          </div>
          <div class="validation-error" id="error-preocupaciones">Selecciona al menos una preocupación.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 18: CONOCE RIESGOS PÚBLICAS -->
      <div class="step-card" id="step-conoce_riesgos">
        <div class="card-header">
          <span class="block-tag">Bloque 4 / Privacidad</span>
          <h2 class="question-title">¿Conoces los riesgos de subir documentos internos o correos corporativos a ChatGPT gratuito?</h2>
        </div>
        <div class="card-body" style="gap: 0.6rem;">
          <div class="option-card animate-fade-up" data-value="Sí, los entiendo">
            <div class="radio-indicator"></div>
            <span class="option-text">Sí, los entiendo y evito hacerlo.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="He escuchado algo pero no estoy seguro">
            <div class="radio-indicator"></div>
            <span class="option-text">He escuchado algo al respecto, pero no estoy seguro.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="No conocía que existiera un riesgo">
            <div class="radio-indicator"></div>
            <span class="option-text">No conocía que existiera un riesgo asociado.</span>
          </div>
          <div class="validation-error" id="error-conoce_riesgos">Por favor selecciona una opción.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 19: BARRERA DIGITAL GRANDE -->
      <div class="step-card" id="step-barrera_grande">
        <div class="card-header">
          <span class="block-tag">Bloque 4 / Barreras</span>
          <h2 class="question-title">¿Cuál consideras que es la barrera más grande que tienes hoy para aprovechar mejor las herramientas digitales?</h2>
        </div>
        <div class="card-body" style="gap: 0.5rem;">
          <div class="option-card animate-fade-up" data-value="Falta de capacitación formal">
            <div class="radio-indicator"></div>
            <span class="option-text">Falta de capacitación formal.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Falta de tiempo para aprender a usarlas">
            <div class="radio-indicator"></div>
            <span class="option-text">Falta de tiempo en el día para aprender.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Limitaciones en equipos (PC lento, red)">
            <div class="radio-indicator"></div>
            <span class="option-text">Equipos lentos o restricciones de red de la empresa.</span>
          </div>
          <div class="option-card animate-fade-up" data-value="Miedo a cometer errores">
            <div class="radio-indicator"></div>
            <span class="option-text">Miedo o temor a cometer un error digital.</span>
          </div>
          <div class="validation-error" id="error-barrera_grande">Por favor selecciona una opción.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 20: RESPALDO LÍDERES -->
      <div class="step-card" id="step-respaldo_lideres">
        <div class="card-header">
          <span class="block-tag">Bloque 4 / Apoyo</span>
          <h2 class="question-title">¿Sientes que cuentas con el respaldo de tus líderes para experimentar y automatizar tareas?</h2>
        </div>
        <div class="card-body">
          <div class="likert-container animate-fade-up">
            <div class="likert-row">
              <div class="likert-btn" data-value="1">1</div>
              <div class="likert-btn" data-value="2">2</div>
              <div class="likert-btn" data-value="3">3</div>
              <div class="likert-btn" data-value="4">4</div>
              <div class="likert-btn" data-value="5">5</div>
            </div>
            <div class="likert-labels">
              <span>1<br>Ningún respaldo</span>
              <span class="likert-label-end">5<br>Respaldo total</span>
            </div>
          </div>
          <div class="validation-error" id="error-respaldo_lideres">Selecciona una calificación de la escala.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" disabled>Siguiente</button>
        </div>
      </div>

      <!-- CARD 21: RESUMEN Y ENVÍO -->
      <div class="step-card" id="step-resumen">
        <div class="card-header">
          <span class="block-tag">Confirmación</span>
          <h2 class="question-title">Revisa tus respuestas</h2>
          <p class="question-desc">Estás listo para enviar tu diagnóstico. Desliza hacia abajo para revisar.</p>
        </div>
        <div class="card-body">
          <div class="summary-scroll" id="summary-content">
            <!-- Se llena dinámicamente con JS -->
          </div>
          <div class="validation-error" id="error-submit">Hubo un error al enviar el formulario. Intenta nuevamente.</div>
        </div>
        <div class="navigation-row">
          <button class="nav-btn btn-back">Atrás</button>
          <button class="nav-btn btn-next" id="btn-submit-form" style="background: linear-gradient(135deg, var(--accent) 0%, #059669 100%); font-weight: 700;">
            Enviar Diagnóstico
          </button>
        </div>
      </div>

      <!-- PANTALLA DE ÉXITO -->
      <div class="step-card" id="step-success">
        <div class="card-header" style="text-align: center; align-items: center; justify-content: center; height: 100%; gap: 1.5rem;">
          <div style="width: 80px; height: 80px; border-radius: 50%; background: rgba(16,185,129,0.1); border: 2px solid var(--accent); display: flex; align-items: center; justify-content: center;">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 6L9 17L4 12" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h1 class="question-title" style="font-size: 1.8rem; background: linear-gradient(135deg, #fff 0%, var(--accent) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">¡Diagnóstico Completado!</h1>
          <p class="question-desc" style="font-size: 1.05rem; line-height: 1.5;">
            Muchas gracias por compartir tus respuestas. Tus valiosos aportes nos ayudarán a construir el futuro digital en <strong>INGOLTE S.A.</strong> a tu medida.
          </p>
        </div>
      </div>

      <!-- Overlay de Carga -->
      <div class="loader-overlay" id="loading-overlay">
        <div class="spinner"></div>
        <p style="color: var(--accent); font-weight: 600; font-size: 0.95rem;">Guardando respuestas en Supabase...</p>
      </div>

    </div>

    <footer>
      <span>INGOLTE S.A. &copy; 2026. Absolutamente privado y seguro.</span>
    </footer>
  </div>

  <script>
    // --- ESTADO LOCAL DEL FORMULARIO ---
    const formData = {
      nombre_completo: '',
      dinamica_trabajo: '',
      dispositivos: [],
      informacion_frecuente: [],
      dependencia_papel: 0,
      nivel_conocimiento_ia: 0,
      herramientas_utilizadas: [],
      frecuencia_uso_ia: '',
      dispositivo_principal_ia: '',
      uso_tareas_empresa: '',
      tareas_ahorro_tiempo: [],
      impacto_productividad: 0,
      horas_busqueda_datos_oficina: null,
      reto_alternar_hibrido: null,
      dificultad_registro_campo: null,
      aspecto_valorado_atencion: '',
      asistente_virtual_tarea: '',
      nivel_confianza_revision: '',
      preocupaciones_uso_ia: [],
      conoce_riesgos_herramientas_publicas: '',
      barrera_digital_grande: '',
      respaldo_lideres_experimentar: 0
    };

    // Secuencia total teórica de pasos
    const baseSteps = [
      'intro',
      'nombre',
      'dinamica',
      'dispositivos',
      'informacion',
      'dependencia_papel',
      'nivel_conocimiento',
      'herramientas',
      'frecuencia_uso',
      'dispositivo_principal',
      'uso_tareas',
      'tareas_ahorro',
      'impacto_productividad',
      'ramificada_oficina',
      'ramificada_hibrido',
      'ramificada_campo',
      'aspecto_valorado',
      'asistente_virtual',
      'confianza_revision',
      'preocupaciones',
      'conoce_riesgos',
      'barrera_grande',
      'respaldo_lideres',
      'resumen'
    ];

    let currentStep = 'intro';

    // Retorna los pasos activos dinámicamente según la ramificación de 'dinamica'
    function getActiveSteps() {
      const dinamica = formData.dinamica_trabajo;
      return baseSteps.filter(step => {
        if (step === 'ramificada_oficina' && dinamica !== '100% Oficina') return false;
        if (step === 'ramificada_hibrido' && dinamica !== 'Híbrido') return false;
        if (step === 'ramificada_campo' && dinamica !== 'Trabajo de Campo/Externo') return false;
        return true;
      });
    }

    // --- MANEJO DE NAVEGACIÓN ---
    
    function updateProgressBar() {
      const activeSteps = getActiveSteps();
      const currentIndex = activeSteps.indexOf(currentStep);
      const progressBar = document.getElementById('progress-bar-el');
      const stepText = document.getElementById('step-number-text');

      if (currentStep === 'intro') {
        gsap.to(progressBar, { width: '0%', duration: 0.3 });
        stepText.textContent = 'Inicio';
        return;
      }

      if (currentStep === 'resumen') {
        gsap.to(progressBar, { width: '100%', duration: 0.3 });
        stepText.textContent = 'Paso Final';
        return;
      }

      // Porcentaje de progreso sin contar intro ni resumen
      const totalProcessSteps = activeSteps.length - 2;
      const progressPercent = Math.min(100, Math.round(((currentIndex) / (activeSteps.length - 1)) * 100));

      gsap.to(progressBar, { width: \`\${progressPercent}%\`, duration: 0.4, ease: "power1.out" });
      stepText.textContent = \`Pregunta \${currentIndex} de \${totalProcessSteps}\`;
    }

    function validateStep(stepId) {
      const errorDiv = document.getElementById(\`error-\${stepId}\`);
      if (errorDiv) errorDiv.classList.remove('visible');

      switch(stepId) {
        case 'intro':
          return true;
        case 'nombre':
          const isNombreValid = formData.nombre_completo.trim().length >= 3;
          if (!isNombreValid) showValidationError('nombre');
          return isNombreValid;
        case 'dinamica':
          const isDinamicaValid = formData.dinamica_trabajo !== '';
          if (!isDinamicaValid) showValidationError('dinamica');
          return isDinamicaValid;
        case 'dispositivos':
          const isDispositivosValid = formData.dispositivos.length > 0;
          if (!isDispositivosValid) showValidationError('dispositivos');
          return isDispositivosValid;
        case 'informacion':
          const isInfoValid = formData.informacion_frecuente.length > 0;
          if (!isInfoValid) showValidationError('informacion');
          return isInfoValid;
        case 'dependencia_papel':
          const isPapelValid = formData.dependencia_papel > 0;
          if (!isPapelValid) showValidationError('dependencia_papel');
          return isPapelValid;
        case 'nivel_conocimiento':
          const isConocimientoValid = formData.nivel_conocimiento_ia > 0;
          if (!isConocimientoValid) showValidationError('nivel_conocimiento');
          return isConocimientoValid;
        case 'herramientas':
          const isHerramientasValid = formData.herramientas_utilizadas.length > 0;
          if (!isHerramientasValid) showValidationError('herramientas');
          return isHerramientasValid;
        case 'frecuencia_uso':
          const isFrecuenciaValid = formData.frecuencia_uso_ia !== '';
          if (!isFrecuenciaValid) showValidationError('frecuencia_uso');
          return isFrecuenciaValid;
        case 'dispositivo_principal':
          const isDispIaValid = formData.dispositivo_principal_ia !== '';
          if (!isDispIaValid) showValidationError('dispositivo_principal');
          return isDispIaValid;
        case 'uso_tareas':
          const isUsoTareasValid = formData.uso_tareas_empresa !== '';
          if (!isUsoTareasValid) showValidationError('uso_tareas');
          return isUsoTareasValid;
        case 'tareas_ahorro':
          const isTareasAhorroValid = formData.tareas_ahorro_tiempo.length >= 1 && formData.tareas_ahorro_tiempo.length <= 3;
          if (!isTareasAhorroValid) showValidationError('tareas_ahorro');
          return isTareasAhorroValid;
        case 'impacto_productividad':
          const isImpactoValid = formData.impacto_productividad > 0;
          if (!isImpactoValid) showValidationError('impacto_productividad');
          return isImpactoValid;
        case 'ramificada_oficina':
          const isOficinaValid = formData.horas_busqueda_datos_oficina !== null;
          if (!isOficinaValid) showValidationError('ramificada_oficina');
          return isOficinaValid;
        case 'ramificada_hibrido':
          const isHibridoValid = formData.reto_alternar_hibrido !== null;
          if (!isHibridoValid) showValidationError('ramificada_hibrido');
          return isHibridoValid;
        case 'ramificada_campo':
          const isCampoValid = formData.dificultad_registro_campo > 0;
          if (!isCampoValid) showValidationError('ramificada_campo');
          return isCampoValid;
        case 'aspecto_valorado':
          const isAspectoValid = formData.aspecto_valorado_atencion !== '';
          if (!isAspectoValid) showValidationError('aspecto_valorado');
          return isAspectoValid;
        case 'asistente_virtual':
          const isAsistenteValid = formData.asistente_virtual_tarea.trim().length >= 5;
          if (!isAsistenteValid) showValidationError('asistente');
          return isAsistenteValid;
        case 'confianza_revision':
          const isConfianzaValid = formData.nivel_confianza_revision !== '';
          if (!isConfianzaValid) showValidationError('confianza_revision');
          return isConfianzaValid;
        case 'preocupaciones':
          const isPreocupaValid = formData.preocupaciones_uso_ia.length > 0;
          if (!isPreocupaValid) showValidationError('preocupaciones');
          return isPreocupaValid;
        case 'conoce_riesgos':
          const isRiesgosValid = formData.conoce_riesgos_herramientas_publicas !== '';
          if (!isRiesgosValid) showValidationError('conoce_riesgos');
          return isRiesgosValid;
        case 'barrera_grande':
          const isBarreraValid = formData.barrera_digital_grande !== '';
          if (!isBarreraValid) showValidationError('barrera_grande');
          return isBarreraValid;
        case 'respaldo_lideres':
          const isRespaldoValid = formData.respaldo_lideres_experimentar > 0;
          if (!isRespaldoValid) showValidationError('respaldo_lideres');
          return isRespaldoValid;
        default:
          return true;
      }
    }

    function showValidationError(stepId) {
      const errorDiv = document.getElementById(\`error-\${stepId}\`);
      if (errorDiv) {
        errorDiv.classList.add('visible');
        // Pequeño temblor GSAP en la tarjeta para denotar error
        const activeCard = document.querySelector('.step-card.active');
        gsap.to(activeCard, { x: 8, repeat: 5, yoyo: true, duration: 0.05, ease: "power1.inOut", onComplete: () => gsap.set(activeCard, { x: 0 }) });
      }
    }

    function checkActiveButtonState(stepId) {
      const card = document.getElementById(\`step-\${stepId}\`);
      if (!card) return;
      const nextBtn = card.querySelector('.btn-next');
      if (!nextBtn) return;
      
      const isValid = validateStep(stepId);
      nextBtn.disabled = !isValid;
    }

    function buildSummary() {
      const summaryDiv = document.getElementById('summary-content');
      summaryDiv.innerHTML = '';

      const items = [
        { q: 'Nombre / ID', a: formData.nombre_completo },
        { q: 'Dinámica de Trabajo', a: formData.dinamica_trabajo },
        { q: 'Dispositivos', a: formData.dispositivos.join(', ') },
        { q: 'Información diaria', a: formData.informacion_frecuente.join(', ') },
        { q: 'Dependencia del Papel', a: \`\${formData.dependencia_papel} / 5\` },
        { q: 'Conocimiento en IA', a: \`\${formData.nivel_conocimiento_ia} / 5\` },
        { q: 'Herramientas usadas', a: formData.herramientas_utilizadas.join(', ') },
        { q: 'Frecuencia uso IA', a: formData.frecuencia_uso_ia },
        { q: 'Dispositivo principal IA', a: formData.dispositivo_principal_ia },
        { q: 'Uso en INGOLTE', a: formData.uso_tareas_empresa },
        { q: 'Tareas para ahorro', a: formData.tareas_ahorro_tiempo.join(', ') },
        { q: 'Impacto Productividad', a: \`\${formData.impacto_productividad} / 5\` }
      ];

      // Pregunta ramificada
      if (formData.dinamica_trabajo === '100% Oficina') {
        items.push({ q: 'Horas de búsqueda', a: formData.horas_busqueda_datos_oficina });
      } else if (formData.dinamica_trabajo === 'Híbrido') {
        items.push({ q: 'Mayor Reto', a: formData.reto_alternar_hibrido });
      } else if (formData.dinamica_trabajo === 'Trabajo de Campo/Externo') {
        items.push({ q: 'Dificultad registro', a: \`\${formData.dificultad_registro_campo} / 5\` });
      }

      items.push(
        { q: 'Aspecto valorado atención', a: formData.aspecto_valorado_atencion },
        { q: 'Delegación a asistente', a: formData.asistente_virtual_tarea },
        { q: 'Confianza en IA', a: formData.nivel_confianza_revision },
        { q: 'Preocupaciones', a: formData.preocupaciones_uso_ia.join(', ') },
        { q: 'Conocimiento de riesgos', a: formData.conoce_riesgos_herramientas_publicas },
        { q: 'Barrera principal', a: formData.barrera_digital_grande },
        { q: 'Respaldo líderes', a: \`\${formData.respaldo_lideres_experimentar} / 5\` }
      );

      items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'summary-item';
        itemDiv.innerHTML = \`<div class="summary-q">\${item.q}</div><div class="summary-a">\${item.a || 'No aplica'}</div>\`;
        summaryDiv.appendChild(itemDiv);
      });
    }

    function transition(direction) {
      const activeSteps = getActiveSteps();
      const currentIndex = activeSteps.indexOf(currentStep);
      let targetIndex;

      if (direction === 'next') {
        if (!validateStep(currentStep)) return;
        targetIndex = currentIndex + 1;
      } else {
        targetIndex = currentIndex - 1;
      }

      if (targetIndex < 0 || targetIndex >= activeSteps.length) return;
      
      const targetStep = activeSteps[targetIndex];
      const currentCard = document.getElementById(\`step-\${currentStep}\`);
      const targetCard = document.getElementById(\`step-\${targetStep}\`);

      if (targetStep === 'resumen') {
        buildSummary();
      }

      // Bloquear interacciones durante la animación
      document.body.style.pointerEvents = 'none';

      // Configuración de direcciones para la transición GSAP
      const xOut = direction === 'next' ? -50 : 50;
      const xIn = direction === 'next' ? 50 : -50;
      const rotateOut = direction === 'next' ? -3 : 3;
      const rotateIn = direction === 'next' ? 3 : -3;

      // Animación de salida de la tarjeta actual
      gsap.to(currentCard, {
        x: xOut,
        opacity: 0,
        scale: 0.95,
        rotation: rotateOut,
        duration: 0.35,
        ease: "power2.inOut",
        onComplete: () => {
          currentCard.classList.remove('active');
          currentCard.style.display = 'none'; // Ocultar físicamente para liberar memoria GPU
          
          // Establecer estado inicial de la tarjeta entrante
          targetCard.style.display = 'flex'; // Mostrar físicamente antes de animar
          targetCard.classList.add('active');
          gsap.set(targetCard, { x: xIn, opacity: 0, scale: 0.95, rotation: rotateIn });
          
          // Habilitar los controles activos de la tarjeta entrante
          checkActiveButtonState(targetStep);

          // Animación de entrada de la nueva tarjeta
          gsap.to(targetCard, {
            x: 0,
            opacity: 1,
            scale: 1,
            rotation: 0,
            duration: 0.45,
            ease: "power2.out",
            onComplete: () => {
              document.body.style.pointerEvents = 'auto';
              // Stagger de las opciones dentro de la nueva tarjeta
              const animateElements = targetCard.querySelectorAll('.animate-fade-up');
              if (animateElements.length > 0) {
                gsap.set(animateElements, { y: 15, opacity: 0 });
                gsap.to(animateElements, {
                  y: 0,
                  opacity: 1,
                  duration: 0.35,
                  stagger: 0.05,
                  ease: "power1.out"
                });
              }
            }
          });
        }
      });

      currentStep = targetStep;
      updateProgressBar();
    }

    // --- CONTROLADORES DE EVENTOS ---

    // Inicializar navegación al cargar
    document.addEventListener('DOMContentLoaded', () => {
      updateProgressBar();
      
      // Botón "Comenzar"
      document.getElementById('btn-start-form').addEventListener('click', () => {
        transition('next');
      });

      // Botón Enviar
      document.getElementById('btn-submit-form').addEventListener('click', enviarRespuestas);

      // Vincular botones Atrás / Siguiente de las tarjetas
      document.querySelectorAll('.btn-back').forEach(btn => {
        btn.addEventListener('click', () => transition('back'));
      });

      document.querySelectorAll('.step-card .btn-next').forEach(btn => {
        if (btn.id !== 'btn-submit-form') {
          btn.addEventListener('click', () => transition('next'));
        }
      });

      // Input de Nombre
      const inputNombre = document.getElementById('input-nombre');
      inputNombre.addEventListener('input', (e) => {
        formData.nombre_completo = e.target.value;
        checkActiveButtonState('nombre');
      });

      // Input Textarea Asistente
      const inputAsistente = document.getElementById('input-asistente');
      const charCounter = document.getElementById('char-counter-el');
      inputAsistente.addEventListener('input', (e) => {
        formData.asistente_virtual_tarea = e.target.value;
        charCounter.textContent = \`\${e.target.value.length} / 500\`;
        checkActiveButtonState('asistente_virtual');
      });

      // Selección Única (Radios)
      document.querySelectorAll('.step-card:not([style*="overflow-y"]) .option-card:not([data-multiple="true"])').forEach(card => {
        card.addEventListener('click', function() {
          const parentCardId = this.closest('.step-card').id.replace('step-', '');
          const siblingCards = this.closest('.card-body').querySelectorAll('.option-card');
          
          siblingCards.forEach(c => c.classList.remove('selected'));
          this.classList.add('selected');

          const val = this.getAttribute('data-value');
          saveValue(parentCardId, val);
          checkActiveButtonState(parentCardId);
        });
      });

      // Selección Múltiple (Checkboxes)
      document.querySelectorAll('.option-card[data-multiple="true"]').forEach(card => {
        card.addEventListener('click', function() {
          const parentCardId = this.closest('.step-card').id.replace('step-', '');
          const val = this.getAttribute('data-value');
          const isSelected = this.classList.contains('selected');
          
          const limit = parseInt(this.getAttribute('data-max') || '0');

          if (parentCardId === 'herramientas') {
            // Lógica excluyente para "Ninguna de las anteriores"
            if (this.id === 'opt-ninguna-herramienta') {
              this.closest('.card-body').querySelectorAll('.option-card').forEach(c => {
                if (c !== this) c.classList.remove('selected');
              });
              formData.herramientas_utilizadas = isSelected ? [] : [val];
            } else {
              document.getElementById('opt-ninguna-herramienta').classList.remove('selected');
              formData.herramientas_utilizadas = formData.herramientas_utilizadas.filter(v => v !== 'Ninguna de las anteriores');
              toggleMultipleChoice(this, isSelected, 'herramientas_utilizadas', val, limit);
            }
          } 
          else if (parentCardId === 'preocupaciones') {
            // Lógica excluyente para "No tengo ninguna preocupación"
            if (this.id === 'opt-ninguna-preocupacion') {
              this.closest('.card-body').querySelectorAll('.option-card').forEach(c => {
                if (c !== this) c.classList.remove('selected');
              });
              formData.preocupaciones_uso_ia = isSelected ? [] : [val];
            } else {
              document.getElementById('opt-ninguna-preocupacion').classList.remove('selected');
              formData.preocupaciones_uso_ia = formData.preocupaciones_uso_ia.filter(v => v !== 'No tengo ninguna preocupación');
              toggleMultipleChoice(this, isSelected, 'preocupaciones_uso_ia', val, limit);
            }
          }
          else {
            // Comportamiento regular de selección múltiple
            let targetProp;
            if (parentCardId === 'dispositivos') targetProp = 'dispositivos';
            else if (parentCardId === 'informacion') targetProp = 'informacion_frecuente';
            else if (parentCardId === 'tareas_ahorro') targetProp = 'tareas_ahorro_tiempo';

            toggleMultipleChoice(this, isSelected, targetProp, val, limit);
          }

          // Reflejar la clase de selección
          const isNowSelected = this.classList.contains('selected');
          
          checkActiveButtonState(parentCardId);
        });
      });

      // Escalas Likert (Botones Circulares)
      document.querySelectorAll('.likert-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const parentCardId = this.closest('.step-card').id.replace('step-', '');
          const siblingBtns = this.closest('.likert-container').querySelectorAll('.likert-btn');
          
          siblingBtns.forEach(b => b.classList.remove('selected'));
          this.classList.add('selected');

          const val = parseInt(this.getAttribute('data-value'));
          saveValue(parentCardId, val);
          checkActiveButtonState(parentCardId);
        });
      });
    });

    function toggleMultipleChoice(element, isSelected, prop, val, limit) {
      if (isSelected) {
        element.classList.remove('selected');
        formData[prop] = formData[prop].filter(v => v !== val);
      } else {
        if (limit > 0 && formData[prop].length >= limit) {
          alert(\`Puedes seleccionar un máximo de \${limit} opciones.\`);
          return;
        }
        element.classList.add('selected');
        formData[prop].push(val);
      }
    }

    function saveValue(stepId, val) {
      switch(stepId) {
        case 'dinamica':
          formData.dinamica_trabajo = val;
          break;
        case 'dependencia_papel':
          formData.dependencia_papel = val;
          break;
        case 'nivel_conocimiento':
          formData.nivel_conocimiento_ia = val;
          break;
        case 'frecuencia_uso':
          formData.frecuencia_uso_ia = val;
          break;
        case 'dispositivo_principal':
          formData.dispositivo_principal_ia = val;
          break;
        case 'uso_tareas':
          formData.uso_tareas_empresa = val;
          break;
        case 'impacto_productividad':
          formData.impacto_productividad = val;
          break;
        case 'ramificada_oficina':
          formData.horas_busqueda_datos_oficina = val;
          break;
        case 'ramificada_hibrido':
          formData.reto_alternar_hibrido = val;
          break;
        case 'ramificada_campo':
          formData.dificultad_registro_campo = val;
          break;
        case 'aspecto_valorado':
          formData.aspecto_valorado_atencion = val;
          break;
        case 'confianza_revision':
          formData.nivel_confianza_revision = val;
          break;
        case 'conoce_riesgos':
          formData.conoce_riesgos_herramientas_publicas = val;
          break;
        case 'barrera_grande':
          formData.barrera_digital_grande = val;
          break;
        case 'respaldo_lideres':
          formData.respaldo_lideres_experimentar = val;
          break;
      }
    }

    // --- ENVÍO DE DATOS A CLOUDFLARE WORKERS / SUPABASE ---
    async function enviarRespuestas() {
      const errorSubmit = document.getElementById('error-submit');
      errorSubmit.classList.remove('visible');
      
      const overlay = document.getElementById('loading-overlay');
      overlay.style.display = 'flex';
      gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.25 });

      try {
        const response = await fetch('/api/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (result.success) {
          // Desvanecer el overlay de carga
          gsap.to(overlay, { 
            opacity: 0, 
            duration: 0.25, 
            onComplete: () => {
              overlay.style.display = 'none';
              
              // Transición a la pantalla de éxito
              const currentCard = document.getElementById('step-resumen');
              const successCard = document.getElementById('step-success');

              gsap.to(currentCard, {
                y: -30,
                opacity: 0,
                scale: 0.95,
                duration: 0.4,
                ease: "power2.in",
                onComplete: () => {
                  currentCard.classList.remove('active');
                  currentCard.style.display = 'none'; // Ocultar resumen
                  
                  successCard.style.display = 'flex'; // Mostrar éxito
                  successCard.classList.add('active');
                  
                  // Ocultar barra de progreso
                  gsap.to('.progress-container', { opacity: 0, height: 0, duration: 0.3 });
                  document.getElementById('step-number-text').textContent = '¡Hecho!';

                  gsap.fromTo(successCard, 
                    { scale: 0.8, opacity: 0, y: 30 }, 
                    { scale: 1, opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.5)" }
                  );

                  // Animación de confeti de celebración
                  celebrarExito();
                }
              });
            }
          });
        } else {
          throw new Error(result.error || 'Respuesta insatisfactoria del servidor.');
        }

      } catch (error) {
        console.error('Error al guardar datos:', error);
        gsap.to(overlay, { 
          opacity: 0, 
          duration: 0.2, 
          onComplete: () => {
            overlay.style.display = 'none';
            errorSubmit.textContent = \`Error: \${error.message}. Intenta de nuevo.\`;
            errorSubmit.classList.add('visible');
          }
        });
      }
    }

    function celebrarExito() {
      const duration = 3 * 1000;
      const end = Date.now() + duration;

      (function frame() {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#10b981', '#34d399', '#6ee7b7']
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#10b981', '#34d399', '#6ee7b7']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());
    }
  </script>
</body>
</html>`;
}

/**
 * Retorna el HTML de la consola interactiva (de la versión inicial).
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
      --accent-color: #10b981;
      --accent-glow: rgba(16, 185, 129, 0.4);
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
      background: linear-gradient(135deg, #fff 30%, #10b981 100%);
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
      border-radius: 16px;
      padding: 1.5rem;
      transition: transform 0.3s ease, border-color 0.3s ease;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }

    .card:hover {
      border-color: rgba(16, 185, 129, 0.2);
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
      color: black;
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
      background: #34d399;
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
      background: rgba(16, 185, 129, 0.1);
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
    <h1>Ingolte Worker Console</h1>
    <p class="subtitle">Consola de Estado e Integración de Datos</p>
  </header>

  <main>
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
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
            <span class="detail-label">Ruta Formulario</span>
            <span class="detail-value">/</span>
          </li>
        </ul>
      </div>

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
        </ul>
        <div style="margin-top: 1.2rem;">
          <button id="btn-test-connection" style="width: 100%; justify-content: center; background: rgba(255,255,255,0.05); border: 1px solid var(--card-border); color: #cbd5e1;">
            Probar Conexión
          </button>
        </div>
      </div>
    </div>

    <div class="card" style="display: flex; flex-direction: column;">
      <div class="console-box">
        <h2>Consola de Consultas de Respuestas</h2>
        <p style="color: #94a3b8; font-size: 0.9rem; margin-top: -0.5rem; margin-bottom: 0.5rem;">
          Consulta la tabla <strong>respuestas_formulario</strong> para ver las respuestas almacenadas.
        </p>
        <div class="input-group">
          <input type="text" id="table-input" value="respuestas_formulario">
          <button id="btn-run-query">
            Consultar
          </button>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
          <span style="font-size: 0.8rem; color: #64748b;">Resultados:</span>
          <span style="font-size: 0.8rem; color: #64748b;" id="execution-time"></span>
        </div>
        
        <pre class="output-area" id="console-output">Ingresa el nombre de la tabla y presiona Consultar...</pre>
      </div>
    </div>
  </main>

  <footer>
    <p>Proyecto Ingolte &copy; 2026. Consola Administrativa.</p>
  </footer>

  <script>
    const btnTest = document.getElementById('btn-test-connection');
    const btnQuery = document.getElementById('btn-run-query');
    const tableInput = document.getElementById('table-input');
    const consoleOutput = document.getElementById('console-output');
    const timeSpan = document.getElementById('execution-time');

    async function runTest() {
      consoleOutput.classList.remove('error');
      consoleOutput.textContent = 'Enviando petición a Supabase...';
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
          consoleOutput.textContent = 'Error:\\n' + JSON.stringify(data, null, 2);
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
      consoleOutput.classList.remove('error');
      consoleOutput.textContent = \`Consultando tabla "\${table}"...\`;
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
        consoleOutput.textContent = 'Error:\\n' + err.message;
      }
    }

    function updateBadge(configured) {
      const badge = document.getElementById('supabase-status-badge');
      if (configured) {
        badge.className = 'status-badge online';
        badge.innerHTML = '<span class="indicator"></span>Conectado';
      } else {
        badge.className = 'status-badge offline';
        badge.innerHTML = '<span class="indicator"></span>Desconectado';
      }
    }

    btnTest.addEventListener('click', runTest);
    btnQuery.addEventListener('click', runQuery);
  </script>
</body>
</html>`;
}
