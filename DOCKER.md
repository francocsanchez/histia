# Docker deployment de Histia

## Requisitos

- Docker y Docker Compose plugin instalados en Ubuntu.
- Contenedor MongoDB existente: `histia-mongo`.
- MongoDB ya configurado con `restart: unless-stopped`.
- Repositorio clonado en `/opt/histia`.

## 1. Crear la red compartida

```bash
docker network create histia_network
```

Si la red ya existe, Docker lo informara y no hace falta recrearla.

## 2. Conectar el Mongo existente a la red

```bash
docker network connect histia_network histia-mongo
```

Si el contenedor ya esta conectado, Docker puede responder que el endpoint ya existe.

## 3. Verificar la red

```bash
docker network inspect histia_network
```

## 4. Preparar variables de entorno del VPS

```bash
cp .env.production.example .env.production
```

Completar al menos:

- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_APP_NAME`
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`
- `SEED_ADMIN_NAME`
- `SEED_ADMIN_LAST_NAME`

URI conceptual de MongoDB:

```env
MONGODB_URI=mongodb://admin:TU_PASSWORD@histia-mongo:27017/histia?authSource=admin
```

`NEXT_PUBLIC_APP_NAME` es la unica variable publica usada por el frontend. El resto son variables server-side y deben existir solo en runtime dentro del VPS. El build de GitHub Actions usa valores dummy no sensibles para compilar y nunca necesita secretos reales.

## 5. Deploy con GitHub Actions + GHCR

### GitHub

El workflow [`deploy-image.yml`](/Users/francosanchez/Documents/www/histia/.github/workflows/deploy-image.yml) se ejecuta en:

- `push` a `main`
- `workflow_dispatch`

Hace:

- `npm ci`
- `npx tsc --noEmit`
- `npm run lint`
- `docker build` para `linux/amd64`
- push de imagen a `ghcr.io/francocsanchez/histia`

Tags publicados:

- `ghcr.io/francocsanchez/histia:latest` en `main`
- `ghcr.io/francocsanchez/histia:<git-sha>` en cada build

Configuracion necesaria en GitHub:

- El repositorio debe tener habilitado GitHub Actions.
- No hace falta crear un secret extra para publicar en GHCR: el workflow usa `${{ secrets.GITHUB_TOKEN }}`.
- El package `histia` debe quedar publico para que el VPS pueda hacer `docker compose pull` sin `docker login`.

Importante:

- GitHub Actions publica la imagen normalmente.
- La visibilidad del package en GHCR puede requerir un cambio manual en GitHub despues de que el package exista por primera vez.
- No se agregan hacks ni tokens administrativos al workflow para cambiar esa visibilidad.

Como comprobar que la imagen se publico:

1. Abrir la corrida de Actions en GitHub y verificar que el job `build-and-push` haya terminado OK.
2. Abrir el package `histia` en GHCR y confirmar los tags `latest` y/o el SHA esperado.
3. Confirmar que la visibilidad del package figure como `Public`.

Si tenes que cambiarla manualmente:

1. Entrar en GitHub.
2. Ir a `francocsanchez` -> `Packages` -> `histia`.
3. Abrir `Package settings`.
4. En la seccion `Danger Zone` cambiar la visibilidad de `Private` a `Public`.

Ruta directa dentro de GitHub:

- Perfil/organizacion `francocsanchez`
- `Packages`
- `histia`
- `Package settings`
- `Change package visibility`

### VPS

El VPS no compila. Solo descarga y arranca imagenes ya construidas.
Una vez que `ghcr.io/francocsanchez/histia` sea publico, el VPS no necesita `docker login`, PAT ni ningun secreto de GHCR.

`compose.yaml` usa:

- `image: ghcr.io/francocsanchez/histia:latest`
- `127.0.0.1:3000:3000`
- `.env.production`
- `histia_network`

MongoDB no se crea ni se modifica desde este compose.

## 6. Verificar acceso publico a la imagen

Una vez que el package `histia` este marcado como publico en GHCR, cualquier host puede descargar la imagen sin autenticacion.

Verificacion desde el VPS:

```bash
docker pull ghcr.io/francocsanchez/histia:latest
```

## 7. Instalar el comando `histiaUpdate`

Desde el repo en el VPS:

```bash
sudo install -m 0755 scripts/histia-update.sh /usr/local/bin/histiaUpdate
```

El script:

- hace `git pull origin main`
- hace `docker compose pull histia-app`
- hace `docker compose up -d histia-app`
- espera `http://127.0.0.1:3000/api/health`
- muestra `docker compose ps`
- si falla, muestra `docker compose logs --tail=100 histia-app`

No hace:

- `docker build`
- `docker login`
- `npm`
- `next build`
- cambios sobre MongoDB
- cambios sobre volumenes
- lectura de tokens GHCR
- validacion de credenciales privadas
- `docker system prune -a`

## 8. Flujo normal de actualizacion

Desarrollo:

```bash
git add .
git commit
git push origin main
```

Produccion:

```bash
histiaUpdate
```

El flujo esperado queda:

1. GitHub Actions valida, compila Next.js dentro del build Docker y publica la imagen en GHCR.
2. La imagen queda disponible publicamente en GHCR una vez ajustada la visibilidad del package.
2. El VPS hace `git pull`, `docker compose pull`, `docker compose up -d` y healthcheck.

Nunca usar `docker compose up -d --build` en produccion.

## 9. Ver estado, logs e imagen descargada

```bash
docker compose ps
docker compose logs -f histia-app
docker image ls ghcr.io/francocsanchez/histia
docker inspect ghcr.io/francocsanchez/histia:latest --format '{{.Id}}'
```

## 10. Rollback manual a un SHA anterior

1. Identificar el tag SHA disponible en GHCR.
2. Editar temporalmente `compose.yaml` o usar un override para apuntar a:

```yaml
image: ghcr.io/francocsanchez/histia:<sha-anterior>
```

3. Aplicar el redeploy:

```bash
docker compose pull histia-app
docker compose up -d histia-app
```

4. Verificar:

```bash
curl http://127.0.0.1:3000/api/health
docker compose ps
```

Cuando el rollback ya no haga falta, volver a `:latest`.

## 11. Administrador inicial y operacion manual

En el primer arranque, si la base no tiene usuarios, el contenedor crea automaticamente el administrador inicial usando `SEED_ADMIN_*` y despues levanta la aplicacion.

Si queres ejecutarlo manualmente dentro del contenedor:

```bash
docker compose exec -it histia-app npm run seed:admin:prod
```

Si todo sale bien, el comando devuelve algo como:

```txt
Administrador listo: admin@tudominio.com
```

## 12. Notas

- `compose.yaml` no crea ni modifica MongoDB.
- MongoDB no expone `27017` como parte de este despliegue.
- `histia-app` usa `restart: unless-stopped`, por lo que volvera a iniciar luego de un reboot del servidor.
- Caddy puede seguir haciendo reverse proxy a `127.0.0.1:3000` sin cambios.
- `BETTER_AUTH_URL` debe reflejar la URL publica real, por ejemplo `https://app.histia.site`.
