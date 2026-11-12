// Proxy de DESARROLLO: solo enruta el buzon local de pruebas (Mailpit).
//
// El API Gateway ya se consume directo desde el navegador usando la URL base de
// `src/environments/environment.ts` (http://localhost:8080). El Gateway habilita
// CORS para http://localhost:4200 y http://127.0.0.1:4200, por lo que ninguna
// peticion de la aplicacion pasa por este proxy. Asi el frontend no depende de
// este archivo para funcionar: es un extra opcional del buzon de pruebas.
//
// OJO: el dev server de Angular 18 usa Vite. Vite NO soporta `pathRewrite`
// (de http-proxy-middleware): hay que usar `rewrite`. Ademas `bypass` debe
// devolver undefined para dejar continuar el proxy.
//
// Este proxy existe unicamente para el buzon de pruebas: Mailpit corre en otro
// puerto/origen y no habilita CORS, asi que se enruta desde el dev server.
function soloLecturaLocal(req) {
  const address = req.socket?.remoteAddress || '';
  let host = '';
  try { host = new URL('http://' + req.headers.host).hostname; } catch { return false; }
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)
    && ['localhost', '127.0.0.1', '[::1]'].includes(host)
    && req.method === 'GET'
    && /^\/correo-pruebas-api\/(messages|message\/[A-Za-z0-9_-]+)$/.test(req.url.split('?')[0]);
}

module.exports = {
  '/correo-pruebas-api': {
    target: 'http://127.0.0.1:8025',
    changeOrigin: true,
    rewrite: path => path.replace(/^\/correo-pruebas-api/, '/api/v1'),
    // undefined = continuar con el proxy; string = no enrutar (responder 404).
    bypass(req) {
      return soloLecturaLocal(req) ? undefined : '/correo-pruebas-api/denegado';
    }
  }
};
