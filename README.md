# Aurum · Laboratorio de estrategias XAUUSD

MVP de investigación con estrategias configurables, backtesting por lotes y resultados persistentes en PostgreSQL. Aplicación Next.js en un contenedor; PostgreSQL en otro, sin publicar su puerto. No ejecuta operaciones reales ni incorpora aún el MCP de MetaTrader.

## Funciones

- Estrategias EMA, SMA, RSI de Wilder, BOS simplificado y FVG de tres velas. Combinación AND, dirección larga/corta y temporalidades H1/H4/D1.
- Reglas de stop, objetivo y riesgo. Entrada en la apertura posterior a la señal. Costos configurables, cierre conservador cuando stop y objetivo coinciden, tratamiento de gaps.
- Períodos de 1, 3, 6 o 12 meses y fechas personalizadas. Todas las estrategias seleccionadas se prueban automáticamente al iniciar un lote.
- Curva de capital, operaciones, comparación, exportación CSV e historial de configuraciones usadas.
- Datos sintéticos explícitos para explorar el motor, e importación de CSV H1 de XAUUSD. El CSV original no se almacena: consérvalo para repetir la prueba. El período se refiere a las fechas de los datos seleccionados.

## Despliegue con Docker Compose

Requiere Docker Engine y Docker Compose v2 o posterior. Desde la carpeta del repositorio:

```sh
# Con Node instalado:
npm run setup:env
# Alternativa si el servidor tiene únicamente Docker:
docker run --rm -v "$PWD:/app" -w /app node:24-bookworm-slim node scripts/setup-env.mjs

docker compose up -d --build
docker compose ps
```

El generador crea `.env` solo si no existe, con contraseñas aleatorias diferentes para PostgreSQL y la aplicación. Nunca lo sobrescribe. El usuario inicial de la aplicación es `carlos`; su contraseña está en `APP_PASSWORD` de `.env`. Este archivo está excluido de Git y del contexto de Docker.

Se inicia primero PostgreSQL, luego la migración y finalmente la aplicación. El volumen `aurum_postgres_data` conserva las estrategias y pruebas entre reinicios y reconstrucciones. Las migraciones se ejecutan explícitamente antes de iniciar la app y están en `db/migrations/`.

La configuración inicial escucha en `127.0.0.1:3002`. Para abrirla por un túnel SSH:

```sh
ssh -L 3002:127.0.0.1:3002 root@62.171.152.158
```

Abre `http://localhost:3002` en tu computadora e introduce las credenciales de Aurum. Para acceso directo por IP y puerto, configura `APP_BIND_ADDRESS=0.0.0.0` en `.env` y recrea la aplicación. HTTP directo no cifra la contraseña; el túnel SSH cifra la conexión. La contraseña de Aurum es independiente de la contraseña SSH. No se necesita publicar PostgreSQL.

## GitHub y Contabo

Sube esta carpeta completa (`trading-lab`), no su carpeta padre ni la copia del MCP. Excluye `.env`, `node_modules`, `.next` y archivos de trabajo; `.gitignore` ya los contempla.

Después de clonar desde tu repositorio en una carpeta nueva, por ejemplo `/opt/aurum-trading-lab`, ejecuta los comandos de despliegue anteriores. Usa `APP_PORT` para cambiar el puerto si hay conflicto. La revisión inicial de Contabo encontró 80, 3000 y 3001 ocupados y 3002 libre; vuelve a comprobarlo al desplegar.

Para actualizar sin eliminar los datos:

```sh
git pull --ff-only
docker compose up -d --build
```

No uses `docker compose down -v` si quieres conservar la base de datos. No cambies `POSTGRES_PASSWORD` sobre un volumen inicializado sin rotar también la contraseña dentro de PostgreSQL.

## Copia de seguridad

Desde el directorio del proyecto en Linux:

```sh
mkdir -p backups
chmod 700 backups
docker compose exec -T db pg_dump -U aurum -d aurum -Fc > "backups/aurum-$(date +%Y%m%d-%H%M%S).dump"
```

Guarda las copias también fuera del servidor. La restauración debe hacerse en una base vacía o en un entorno de recuperación separado.

## Desarrollo y verificación

```sh
npm ci
npm test
npm run lint
npm run build
```

Para desarrollo fuera de Docker, configura `DATABASE_URL` o las variables estándar `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGPASSWORD`, y ejecuta la migración en PostgreSQL. `APP_PASSWORD` es obligatorio incluso en desarrollo. `npm run dev` carga `.env`.

La prueba de integración se ejecuta contra una app y base en funcionamiento:

```sh
node --env-file=.env scripts/smoke.mjs http://localhost:3002
```

Comprueba acceso privado, salud de la base, guardado, actualización y eliminación de un registro temporal propio. No modifica estrategias del usuario.

## Alcance del simulador

Es un modelo de investigación OHLC: una posición por estrategia, exposición máxima 1×, onzas fraccionarias, sin swap, requisitos de margen ni restricciones de lotaje de Exness. Los costos son supuestos editables, no tarifas verificadas. El drawdown es una estimación con capital flotante; las velas no revelan el orden exacto de todos los movimientos. SMC se limita a las definiciones visibles de BOS y FVG. No hay optimización automática de parámetros, pruebas fuera de muestra ni programación recurrente de lotes todavía.
