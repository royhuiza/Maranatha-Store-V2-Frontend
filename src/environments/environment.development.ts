/**
 * Configuración de desarrollo.
 *
 * Se usa el mismo API Gateway que en producción (http://localhost:8080) para que
 * `npm start` funcione a la primera en cualquier equipo, sin depender del proxy
 * de Angular ni de variables de entorno locales.
 */
export const environment = {
  production: false,

  /** API Gateway (Spring Cloud Gateway) que expone los microservicios. */
  apiUrl: 'http://localhost:8080',
};
