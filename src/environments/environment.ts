/**
 * Configuración general de la aplicación.
 *
 * La URL base apunta directo al API Gateway (http://localhost:8080) para que el
 * frontend no dependa del proxy de desarrollo de Angular (proxy.conf.cjs), que en
 * Node 24 falla al parsear las respuestas chunked del backend Spring.
 *
 * El Gateway ya habilita CORS para los orígenes de desarrollo
 * (http://localhost:4200, http://127.0.0.1:4200), por lo que las llamadas
 * cross-origin funcionan sin proxies intermedios.
 */
export const environment = {
  production: true,

  /** API Gateway (Spring Cloud Gateway) que expone los microservicios. */
  apiUrl: 'http://localhost:8080',
};
