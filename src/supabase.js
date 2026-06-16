/**
 * Cliente Supabase ultraligero usando Fetch API para Cloudflare Workers.
 * Permite interactuar con Supabase sin instalar librerías adicionales.
 */
export class SupabaseClient {
  /**
   * @param {string} supabaseUrl - La URL de tu proyecto de Supabase.
   * @param {string} supabaseKey - La clave Anon (o Service Role) de tu proyecto.
   */
  constructor(supabaseUrl, supabaseKey) {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase URL and Key are required. Asegúrate de configurar SUPABASE_URL y SUPABASE_ANON_KEY.");
    }
    // Asegurarse de que no termine en barra diagonal
    this.url = supabaseUrl.endsWith('/') ? supabaseUrl.slice(0, -1) : supabaseUrl;
    this.key = supabaseKey;
  }

  /**
   * Realiza una solicitud HTTP directa a la REST API de Supabase.
   * @param {string} path - Ruta del endpoint (ej. "todos?select=*").
   * @param {RequestInit} [options] - Opciones adicionales de fetch.
   */
  async request(path, options = {}) {
    const url = `${this.url}/rest/v1/${path}`;
    const headers = {
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Supabase Error [${response.status}]: ${errorBody}`);
    }

    if (response.status === 204) {
      return null;
    }

    return await response.json();
  }

  /**
   * Inicia una consulta (Query Builder) para una tabla.
   * @param {string} table - Nombre de la tabla.
   */
  from(table) {
    const client = this;
    
    class QueryBuilder {
      constructor() {
        this.params = new URLSearchParams();
        this.headers = {};
        this.method = 'GET';
        this.body = null;
      }

      /**
       * Selecciona columnas de la tabla.
       * @param {string} [columns="*"] - Columnas a seleccionar separadas por comas.
       */
      select(columns = '*') {
        this.method = 'GET';
        this.params.set('select', columns);
        return this;
      }

      /**
       * Inserta una o más filas en la tabla.
       * @param {Object|Object[]} data - Datos a insertar.
       */
      insert(data) {
        this.method = 'POST';
        this.body = JSON.stringify(data);
        this.headers['Prefer'] = 'return=representation';
        return this;
      }

      /**
       * Actualiza filas en la tabla según los filtros aplicados.
       * @param {Object} data - Campos a actualizar.
       */
      update(data) {
        this.method = 'PATCH';
        this.body = JSON.stringify(data);
        this.headers['Prefer'] = 'return=representation';
        return this;
      }

      /**
       * Elimina filas en la tabla según los filtros aplicados.
       */
      delete() {
        this.method = 'DELETE';
        this.headers['Prefer'] = 'return=representation';
        return this;
      }

      // --- FILTROS POSTGREST ---

      eq(column, value) {
        this.params.set(column, `eq.${value}`);
        return this;
      }

      neq(column, value) {
        this.params.set(column, `neq.${value}`);
        return this;
      }

      gt(column, value) {
        this.params.set(column, `gt.${value}`);
        return this;
      }

      gte(column, value) {
        this.params.set(column, `gte.${value}`);
        return this;
      }

      lt(column, value) {
        this.params.set(column, `lt.${value}`);
        return this;
      }

      lte(column, value) {
        this.params.set(column, `lte.${value}`);
        return this;
      }

      like(column, pattern) {
        this.params.set(column, `like.${pattern}`);
        return this;
      }

      ilike(column, pattern) {
        this.params.set(column, `ilike.${pattern}`);
        return this;
      }

      in(column, values) {
        const valStr = values.map(v => typeof v === 'string' ? `"${v}"` : v).join(',');
        this.params.set(column, `in.(${valStr})`);
        return this;
      }

      order(column, { ascending = true } = {}) {
        this.params.set('order', `${column}.${ascending ? 'asc' : 'desc'}`);
        return this;
      }

      limit(count) {
        this.params.set('limit', count);
        return this;
      }

      /**
       * Ejecuta la consulta y retorna los datos.
       */
      async execute() {
        const queryString = this.params.toString();
        const path = queryString ? `${table}?${queryString}` : table;
        
        return await client.request(path, {
          method: this.method,
          headers: this.headers,
          body: this.body
        });
      }

      // Permite usar 'await' directamente sobre la consulta (thenable)
      then(onfulfilled, onrejected) {
        return this.execute().then(onfulfilled, onrejected);
      }
    }

    return new QueryBuilder();
  }
}
