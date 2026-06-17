-- Tabla para almacenar las respuestas del Formulario de Diagnóstico de IA
CREATE TABLE IF NOT EXISTS respuestas_formulario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creado_en TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,

    -- Bloque 1: Perfil Operativo y Entorno de Trabajo
    nombre_completo TEXT NOT NULL,
    dinamica_trabajo TEXT NOT NULL, -- Oficina, Híbrido, Campo
    dispositivos TEXT[] NOT NULL, -- Selección múltiple: Computador corp, personal, celular corp, etc.
    informacion_frecuente TEXT[] NOT NULL, -- Selección múltiple: datos financieros, legal, correos, etc.
    dependencia_papel INTEGER NOT NULL CHECK (dependencia_papel BETWEEN 1 AND 5), -- Escala Likert 1 al 5

    -- Bloque 2: Conocimiento y Uso Actual de IA
    nivel_conocimiento_ia INTEGER NOT NULL CHECK (nivel_conocimiento_ia BETWEEN 1 AND 5), -- Escala Likert 1 al 5
    herramientas_utilizadas TEXT[] NOT NULL, -- Selección múltiple: ChatGPT, Copilot, Gemini, etc.
    frecuencia_uso_ia TEXT NOT NULL, -- Selección única
    dispositivo_principal_ia TEXT NOT NULL, -- Selección única
    uso_tareas_empresa TEXT NOT NULL, -- Selección única

    -- Bloque 3: Aplicación Práctica y Percepción de Valor
    tareas_ahorro_tiempo TEXT[] NOT NULL, -- Selección múltiple (Máximo 3)
    impacto_productividad INTEGER NOT NULL CHECK (impacto_productividad BETWEEN 1 AND 5), -- Escala Likert 1 al 5
    
    -- Respuestas Ramificadas (solo una estará llena según dinamica_trabajo)
    horas_busqueda_datos_oficina TEXT, -- Pregunta 13A (Solo Oficina)
    reto_alternar_hibrido TEXT,        -- Pregunta 13B (Solo Híbrido)
    dificultad_registro_campo INTEGER CHECK (dificultad_registro_campo BETWEEN 1 AND 5), -- Pregunta 13C (Solo Campo)

    aspecto_valorado_atencion TEXT NOT NULL, -- Selección única
    asistente_virtual_tarea TEXT NOT NULL, -- Texto largo

    -- Bloque 4: Riesgos, Privacidad y Barreras de Adopción
    nivel_confianza_revision TEXT NOT NULL, -- Selección única
    preocupaciones_uso_ia TEXT[] NOT NULL, -- Selección múltiple
    conoce_riesgos_herramientas_publicas TEXT NOT NULL, -- Selección única
    barrera_digital_grande TEXT NOT NULL, -- Selección única
    respaldo_lideres_experimentar INTEGER NOT NULL CHECK (respaldo_lideres_experimentar BETWEEN 1 AND 5) -- Escala Likert 1 al 5
);

-- Comentarios explicativos en las columnas para documentar la base de datos
COMMENT ON TABLE respuestas_formulario IS 'Respuestas recopiladas del Formulario de Diagnóstico de IA - INGOLTE S.A.';
COMMENT ON COLUMN respuestas_formulario.dinamica_trabajo IS 'Modalidad de trabajo del colaborador: 100% Oficina, Híbrido o Trabajo de Campo/Externo.';
COMMENT ON COLUMN respuestas_formulario.dispositivos IS 'Tipos de dispositivos corporativos o personales utilizados.';
COMMENT ON COLUMN respuestas_formulario.informacion_frecuente IS 'Tipos de información más consultada.';
COMMENT ON COLUMN respuestas_formulario.dependencia_papel IS 'Escala 1 (digital) al 5 (papel) sobre dependencia de documentos físicos.';
COMMENT ON COLUMN respuestas_formulario.horas_busqueda_datos_oficina IS 'Pregunta ramificada 13A: Horas de búsqueda de datos para perfil Oficina.';
COMMENT ON COLUMN respuestas_formulario.reto_alternar_hibrido IS 'Pregunta ramificada 13B: Mayor reto logístico para perfil Híbrido.';
COMMENT ON COLUMN respuestas_formulario.dificultad_registro_campo IS 'Pregunta ramificada 13C: Dificultad de registro de visitas para perfil Campo.';
