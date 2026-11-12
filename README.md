# Maranatha Store V2 — Frontend Angular

Frontend Angular 18 enlazado con el API Gateway del backend.

## Requisitos

- Node.js 20 o 22.
- Backend funcionando en `http://localhost:8080` (API Gateway).

## Ejecutar en Visual Studio Code

Abra una terminal en esta carpeta y ejecute:

```powershell
npm install
npm start
```

Abra <http://localhost:4200>.

Credenciales iniciales:

- Usuario: `admin`
- Contraseña: `admin123`

### API Gateway

La URL base del API Gateway se centraliza en `src/environments/environment.ts`
(`apiUrl: 'http://localhost:8080'`) y `src/environments/environment.development.ts`.
El frontend llama **directo** al Gateway, sin pasar por el proxy de Angular, porque el
proxy de desarrollo falla en Node 24 al parsear las respuestas chunked del backend
Spring. El Gateway ya habilita CORS para `http://localhost:4200` y
`http://127.0.0.1:4200`, por lo que el login y el resto de llamadas funcionan
tal cual tras `npm install && npm start`.

Rutas reales del Gateway usadas por la app:

| Ruta | Servicio |
| --- | --- |
| `/auth/**` | ms-auth (login, sesión, usuarios, contraseña) |
| `/productos/**` | ms-producto (catálogo, stock, ajustes) |
| `/clientes/**` | ms-cliente (clientes, consulta DNI/RUC) |
| `/ventas/**` | ms-ventas (ventas, historial) |
| `/api/facturacion/**` | ms-facturacion (consulta RUC oficial SUNAT) |
| `/api/v1/chat/**` | ms-chat (chatbot y QR de WhatsApp) |

`proxy.conf.cjs` queda solo para el buzón local de pruebas (Mailpit en el puerto
8025) y es opcional: no es necesario para que la aplicación funcione.

## Compilar

```powershell
npm run build
```

## Funciones

- Inicio y cierre de sesión con expiración de JWT.
- Productos persistidos, edición, eliminación, búsqueda y alertas de stock bajo.
- Clientes con DNI, RUC o CE.
- Venta con carrito, validación de stock y selección de comprobante.
- Impresión de boleta, factura o nota de pedido.
- Historial y anulación con reposición del stock.
- Reportes Excel de inventario, clientes, ventas y detalles.

La factura mostrada es un comprobante interno. La integración electrónica con SUNAT requiere credenciales y certificado digital propios de la empresa.
