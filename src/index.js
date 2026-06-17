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
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#10b981" stroke-width="1.5" stroke-linejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="#10b981" stroke-width="1.5" stroke-linejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="#10b981" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
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
