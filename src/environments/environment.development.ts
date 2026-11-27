const demoFiscal = false;

export const environment = {
  production: false,
  demoFiscal,
  apiUrl: demoFiscal
    ? 'http://localhost:18080'
    : 'http://localhost:8080',
};