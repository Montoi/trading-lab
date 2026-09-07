# Aurum · Laboratorio de estrategias XAUUSD

MVP de investigación con estrategias configurables, backtesting por lotes y resultados persistentes en PostgreSQL. En producción, Next.js y PostgreSQL funcionan en contenedores. El desarrollo local usa esa misma base de Contabo por SSH. PostgreSQL solo escucha en el servidor en 127.0.0.1:15432, sin exposición pública. No ejecuta operaciones reales ni incorpora aún el MCP de MetaTrader.

## Funciones

- Estrategias EMA, SMA, RSI de Wilder, BOS simplificado y FVG de tres velas. Combinación AND, dirección larga/corta y temporalidades H1/H4/D1.
- Reglas de stop, objetivo y riesgo. Entrada en la apertura posterior a la señal. Costos configurables, cierre conservador cuando stop y objetivo coinciden, tratamiento de gaps.
- Períodos de 1, 3, 6 o 12 meses y fechas personalizadas. Todas las estrategias seleccionadas se prueban automáticamente al iniciar un lote.
- Curva de capital, operaciones, comparación, exportación CSV e historial de configuraciones usadas.
- Datos sintéticos explícitos para explorar el motor, e importación de CSV H1 de XAUUSD. El CSV original no se almacena: consérvalo para repetir la prueba. El período se refiere a las fechas de los datos seleccionados.

## Despliegue en Contabo con Docker Compose

Solo en el servidor: requiere Docker Engine y Docker Compose v2 o posterior. No levantes este Compose en tu computadora, porque crearía otra base. Desde la carpeta del repositorio:

```sh
# Con Node instalado:
npm run setup:env
# Alternativa si el servidor tiene únicamente Docker:
docker run --rm -v "$PWD:/app" -w /app node:24-bookworm-slim node scripts/setup-env.mjs

docker compose up -d --build
docker compose ps
```

El generador crea `.env` solo si no existe, con una contraseña aleatoria para PostgreSQL. Nunca lo sobrescribe. Este archivo está excluido de Git y del contexto de Docker. Aurum permite entrar sin usuario ni contraseña.

Se inicia primero PostgreSQL, luego la migración y finalmente la aplicación. El volumen `aurum_postgres_data` conserva las estrategias y pruebas entre reinicios y reconstrucciones. Las migraciones se ejecutan explícitamente antes de iniciar la app y están en `db/migrations/`.

La configuración inicial escucha en `127.0.0.1:3002`. Para abrirla por un túnel SSH:

```sh
ssh -L 3002:127.0.0.1:3002 root@62.171.152.158
```

Abre `http://localhost:3002` en tu computadora. Para acceso directo por IP y puerto, configura `APP_BIND_ADDRESS=0.0.0.0` en `.env` y recrea la aplicación. La aplicación no solicita credenciales; cualquiera que alcance su dirección puede leer y modificar sus datos. El túnel SSH cifra la conexión. El puerto 15432 de PostgreSQL permanece enlazado únicamente a la interfaz local del servidor para el túnel de desarrollo.

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

### Trabajar localmente con la base compartida

La computadora y la aplicación publicada utilizan **la misma base `aurum` en Contabo**. Guardar, editar o eliminar estrategias y resultados localmente afecta inmediatamente a los mismos datos que ve producción. Las interfaces deben recargarse para mostrar cambios realizados desde la otra sesión.

El `.env` local debe contener el valor existente de `POSTGRES_PASSWORD` del servidor. En esta computadora ya están configurados. No ejecutes el generador de contraseñas para sustituir estas credenciales ni ejecutes migraciones automáticamente desde desarrollo.

```sh
npm run dev
```

Este comando abre un túnel SSH cifrado hacia Contabo, solicita la contraseña SSH en la terminal si no hay una clave configurada, comprueba la base compartida y arranca Next.js con recarga automática en `http://127.0.0.1:3000`. Mantén la terminal abierta. `Ctrl+C` detiene la aplicación y el túnel. Si se pierde el túnel, vuelve a ejecutar el comando. Necesitas Node y OpenSSH; Docker local no es necesario.

Los puertos pueden cambiarse con `DB_TUNNEL_PORT` y `DEV_PORT`; `DB_SSH_TARGET` permite configurar un alias SSH. No guardes la contraseña SSH en `.env` ni en Git. La aplicación desplegada sigue conectándose directamente al servicio `db` dentro de Docker. Cambiar código local no publica una versión: solo se actualiza Contabo cuando lo decidas.

La prueba de integración se ejecuta contra una app y base en funcionamiento:

```sh
node --env-file=.env scripts/smoke.mjs http://localhost:3002
```

Comprueba acceso sin credenciales, salud de la base, guardado, actualización y eliminación de un registro temporal propio. No modifica estrategias del usuario.

## Alcance del simulador

Es un modelo de investigación OHLC: una posición por estrategia, exposición máxima 1×, onzas fraccionarias, sin swap, requisitos de margen ni restricciones de lotaje de Exness. Los costos son supuestos editables, no tarifas verificadas. El drawdown es una estimación con capital flotante; las velas no revelan el orden exacto de todos los movimientos. SMC se limita a las definiciones visibles de BOS y FVG. No hay optimización automática de parámetros, pruebas fuera de muestra ni programación recurrente de lotes todavía.


### Configuración de acceso en el servidor actual

Contabo mantiene `.compose-db-access.yaml` como configuración operativa local (excluida del repositorio) y la referencia en `COMPOSE_FILE` dentro de su `.env`. Solo añade el enlace `127.0.0.1:15432` al contenedor existente de PostgreSQL. Esto permitió habilitar el desarrollo compartido sin reconstruir ni publicar otra versión de la aplicación. El `compose.yaml` de esta revisión ya declara ese mismo enlace para futuros despliegues.

