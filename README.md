# Maranatha Store V2 — Frontend

<div align="center">

**Sistema web de ventas, facturación e inventario para librería escolar**

![Angular](https://img.shields.io/badge/Angular-18-DD0031?style=for-the-badge&logo=angular&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/Node-20%20%7C%2022-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Estado](https://img.shields.io/badge/Estado-En%20integración-0F2928?style=for-the-badge)

<br/>

Frontend en **Angular 18** integrado con el **API Gateway** del backend (microservicios).  
Rama de integración activa: `qa/integracion-frontend`.

</div>

---

## Módulos y funcionalidades

<table>
  <tr>
    <td width="33%" valign="top">
      <h3>🧾 Ventas y facturación</h3>
      <p>Flujo guiado por pasos: datos del comprobante, carrito y pago. Boleta, factura o nota de pedido, validación de stock, impresión A4/ticket, PDF y QR.</p>
    </td>
    <td width="33%" valign="top">
      <h3>🔎 Consulta DNI / RUC</h3>
      <p>Búsqueda de documento para autocompletar datos del cliente/comprador. Integración de consulta en entorno de desarrollo y validaciones de formato.</p>
    </td>
    <td width="33%" valign="top">
      <h3>📦 Productos e inventario</h3>
      <p>Catálogo persistido con creación, edición, búsqueda, alertas de stock bajo y control de existencias asociado a ventas.</p>
    </td>
  </tr>
  <tr>
    <td width="33%" valign="top">
      <h3>👥 Clientes</h3>
      <p>Gestión de clientes con soporte para DNI, RUC o CE y datos asociados a comprobantes.</p>
    </td>
    <td width="33%" valign="top">
      <h3>📊 Historial y reportes</h3>
      <p>Historial de comprobantes emitidos, anulación con reposición de stock y exportación de reportes (inventario, clientes, ventas, detalles).</p>
    </td>
    <td width="33%" valign="top">
      <h3>🔐 Acceso y sesión</h3>
      <p>Inicio/cierre de sesión con JWT, manejo de expiración, gestión de usuarios y recuperación/cambio de contraseña según módulos disponibles.</p>
    </td>
  </tr>
</table>

> **Nota:** La factura mostrada es un comprobante interno. La emisión electrónica ante SUNAT requiere credenciales y certificado digital propios de la empresa.

---

## Stack técnico

| Capa | Tecnología |
| --- | --- |
| Framework | Angular 18 (standalone components) |
| Lenguaje | TypeScript ~5.5 |
| UI / estilos | CSS, recursos del sistema visual del proyecto (`atelier.css`) |
| Comunicación | HttpClient + RxJS |
| Documentos | `jspdf`, `html2canvas`, `qrcode`, `xlsx` |
| Backend | API Gateway `http://localhost:8080` (microservicios Spring) |

---

## Requisitos previos

- **Node.js** 20 o 22
- **npm** (incluido con Node)
- **Backend / API Gateway** en ejecución en `http://localhost:8080`
- (Opcional) **Mailpit** en `127.0.0.1:8025` para buzón local de pruebas

---

## Inicio rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Levantar servidor de desarrollo
npm start
```

Abrir en el navegador: **http://localhost:4200**

**Credenciales iniciales (entorno de desarrollo):**
- Usuario: `admin`
- Contraseña: `admin123`

> Si cambias configuración de proxy (`proxy.conf.cjs` / `proxy.conf.json`), reinicia `npm start` para aplicar los cambios.

---

## Scripts disponibles

| Comando | Descripción |
| --- | --- |
| `npm start` | Inicia `ng serve` (desarrollo) |
| `npm run build` | Genera build de producción en `dist/` |
| `npm test` | Ejecuta pruebas (`ng test --watch=false`) |

---

## Configuración y rutas

La URL base del API Gateway se centraliza en:

- `src/environments/environment.ts`
- `src/environments/environment.development.ts`

```ts
apiUrl: 'http://localhost:8080'
```

El frontend consume el Gateway directamente (CORS habilitado en backend para orígenes de desarrollo `http://localhost:4200` y `http://127.0.0.1:4200`).

### Rutas principales del Gateway

| Ruta | Servicio |
| --- | --- |
| `/auth/**` | ms-auth (login, sesión, usuarios, contraseña) |
| `/productos/**` | ms-producto (catálogo, stock, ajustes) |
| `/clientes/**` | ms-cliente (clientes, consultas) |
| `/ventas/**` | ms-ventas (ventas, historial) |
| `/api/facturacion/**` | ms-facturacion (consultas SUNAT/RUC según backend) |
| `/api/v1/chat/**` | ms-chat (chatbot / WhatsApp) |

### Proxy de desarrollo (`proxy.conf.cjs`)

- `/correo-pruebas-api` → Mailpit local (opcional, buzón de pruebas).
- `/external/dni` y `/external/ruc` → proxy a proveedor externo de consulta (entorno de desarrollo), usado por el flujo de Ventas/Facturación para autocompletar datos de documento.

---

## Estructura relevante

```text
src/
  app/
    core/        # servicios HTTP, interceptores, utilidades
    pages/       # vistas/módulos (ventas, productos, clientes, reportes, etc.)
    shared/      # componentes compartidos
  environments/  # configuración por entorno (apiUrl)
proxy.conf.cjs   # proxy dev (Mailpit + consultas externas)
proxy.conf.json  # configuración alternativa de proxy
```

---

## Integración y colaboración

- Trabajar sobre la rama de integración acordada (`qa/integracion-frontend`) y mantener alineación con las ramas de feature correspondientes.
- Antes de abrir PR a la rama principal: validar flujo de ventas (DNI/RUC, carrito, pago, emisión, impresión/PDF, historial) con backend activo.
- No commitear artefactos de build (`dist/`) salvo que el equipo lo defina explícitamente.

---

<div align="center">
  <sub>Desarrollado para <b>Maranatha Store V2</b> · Frontend Angular</sub>
</div>
