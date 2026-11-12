// Development only. The mailbox exposes password-reset links: never proxy it publicly.
function localRead(req) {
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
    target: 'http://127.0.0.1:8025', secure: false, changeOrigin: true,
    pathRewrite: {'^/correo-pruebas-api': '/api/v1'},
    bypass(req) { return localRead(req) ? null : false; }
  },
  '/external/dni': {
    target: 'https://api.apis.net.pe/v1', secure: true, changeOrigin: true,
    pathRewrite: {'^/external/dni': '/dni'}
  },
  '/external/ruc': {
    target: 'https://api.apis.net.pe/v1', secure: true, changeOrigin: true,
    pathRewrite: {'^/external/ruc': '/ruc'}
  },
  '/api': {target:'http://127.0.0.1:8080',secure:false,changeOrigin:true}
};
