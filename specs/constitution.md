# Constitución — Dashboard "Estado de Ventas" (repo `andresepadipa/adipa`)

Hereda los principios del proyecto hermano
(`adipa-recomendador/specs/constitution.md`). Los que rigen ESTE repo:

## Producto
- **Una sola página, sin login.** La abre el equipo comercial y ve el estado del mes al instante.
- **Datos honestos.** Si BigQuery no responde, se muestra el último valor conocido con aviso
  visible; nunca un 0 falso ni un número inventado.
- **El diseño de marca no se rehace.** Poppins, gradiente morado→celeste, logo incrustado.
  Los cambios tocan de dónde salen los datos, no cómo se ven.

## Ingeniería
- **Cambios quirúrgicos** sobre `index.html`; toda la lógica de edición/proyección/localStorage
  existente se mantiene intacta.
- **BigQuery solo desde el servidor** (`/api/ventas`). El navegador nunca ve credenciales.
- **Caché suave** en el endpoint (`s-maxage`), nunca cachear un fallo.
- **Fechas en hora de Santiago**, no UTC del servidor.

## Seguridad
- Secretos JAMÁS en el repo. La llave de la service account va como env var en Vercel;
  el asistente solo escribe el NOMBRE de la variable, los valores los pega Andrea.

## Proceso (SDD)
- `spec → plan → tasks → implementar → verificar → actualizar tasks`.
- Artefactos en `specs/NNN-nombre/`. Cada feature termina con commit + push (Vercel despliega `main`).
