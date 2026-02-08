# Panadería Stock Hub (Web App)

App web para que empleados carguen **stock en packs** y se envíen alertas automáticas por email cuando un producto quede por debajo del **margen mínimo**.

## ✅ Pantallas
- Login
- Vista empleado (Stock Diario)
- Owner: Resumen
- Owner: Productos (crear/editar/eliminar)
- Owner: Historial (últimos 100 registros)

## Reglas de negocio (packs)
- **ALERTA** si `stock_actual < margen_minimo`
- **OK** si `stock_actual >= margen_minimo`
- `reponer_packs = ceil((margen_minimo - stock_actual) / min_packs_pedido) * min_packs_pedido`
- Se envían emails sólo si queda en ALERTA y no se notificó ese producto en las últimas 24h.

## Quick start (local)
1) Requisitos: Node.js 20+
2) `cp .env.example .env` y cambiá `SESSION_SECRET`
3) `npm install`
4) `npm run dev`
5) Abrí http://localhost:3000

Credenciales demo (seed automático en primer arranque):
- employee / 12345
- owner / 12345

## Emails (SMTP)
Si NO configurás SMTP, los mails se loguean en consola (para testear).

Para Gmail:
- Activá 2FA
- Generá una **App Password**
- Configurá SMTP en `.env`.

## Docker
- `cp .env.example .env`
- `docker compose up --build`
- http://localhost:3000

## Datos
SQLite en `./data/app.db`.
