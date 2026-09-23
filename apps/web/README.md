# @hypsometra/web

Dashboard de Hypsometra (despliegue previsto en Vercel).

Aún no hay app Next.js: este directorio reserva el lugar en el monorepo.
Cuando arranque la UI, vivirán aquí:

- **Backtest / optimización** — lanzar jobs, ver progreso
- **Walk-forward & Monte Carlo** — resultados de robustez
- **Orometra** — auditoría de mesetas (módulo integrado)

El cómputo pesado no corre en Vercel: va a `workers/`.
