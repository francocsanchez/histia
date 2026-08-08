# Docker deployment de Histia

## Requisitos

- Docker y Docker Compose plugin instalados en Ubuntu.
- Contenedor MongoDB existente: `histia-mongo`.
- Volumen MongoDB existente: `histia_mongo_data`.
- MongoDB ya configurado con `restart: unless-stopped`.

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

## 4. Preparar variables de entorno

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

## 5. Construir y levantar la app

```bash
docker compose up -d --build
```

La aplicacion quedara publicada en el puerto `3000`.

## 6. Ver estado y logs

```bash
docker compose ps
docker compose logs -f histia-app
```

## 7. Crear el administrador inicial

Con la base vacia, ejecutar dentro del contenedor:

```bash
docker compose exec -it histia-app npm run seed:admin:prod
```

Si todo sale bien, el comando devuelve algo como:

```txt
Administrador listo: admin@tudominio.com
```

El script crea el usuario si no existe y, si ya existe, lo actualiza para dejarlo activo con rol `administrador`.

## 8. Rebuild despues de cambios

```bash
docker compose up -d --build
```

## 9. Reiniciar o detener la app

```bash
docker compose restart histia-app
docker compose down
```

No usar `docker compose down -v`.

## 10. Verificar resolucion interna entre contenedores

```bash
docker exec histia-app getent hosts histia-mongo
```

## Notas

- `compose.yaml` no crea ni modifica MongoDB.
- MongoDB no expone `27017` como parte de este despliegue.
- `histia-app` usa `restart: unless-stopped`, por lo que volvera a iniciar luego de un reboot del servidor.
- `BETTER_AUTH_URL` debe reflejar la URL real desde la que se accede a la app. Mientras se use acceso directo al puerto, `http://localhost:3000` es valido solo si el acceso ocurre desde el mismo host.
