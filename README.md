# Modern Digital Repository & Archive Platform

A self-hosted EPrints-style archive system using Dublin Core metadata.
###### You can change the name of the repository. This is just a system that i used. You can custom the UI using css.

## Features

- Login with JWT
- Dublin Core metadata form
- Photo / article / video / report records
- File upload storage
- Search by title, subject, description, creator, identifier and coverage
- CSV export
- Dublin Core JSON endpoint
- PostgreSQL database
- Docker Compose deployment
- Nginx reverse proxy
- Backup script

## 1. Ubuntu Server 22.04 Setup

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw nginx certbot python3-certbot-nginx
curl -fsSL https://get.docker.com | sh
sudo apt install -y docker-compose-plugin
sudo usermod -aG docker $USER
```

Log out and log back in.

## 2. Deploy Application

```bash
unzip bioeconomy-archive-system.zip
cd bioeconomy-archive-system
cp .env.example .env
nano .env
```

Change all passwords and secrets in `.env`.

Start system:

```bash
docker compose up -d --build
```

Open:

```text
http://SERVER_IP:8080
```

Default admin comes from `.env`:

```text
ADMIN_EMAIL=admin@bioeconomycorporation.my
ADMIN_PASSWORD=ChangeAdminPassword123!
```

## 3. Production Domain Setup

Point DNS:

```text
archive.yourcompany.com -> your_server_ip
```

Create host Nginx config:

```bash
sudo nano /etc/nginx/sites-available/bioarchive
```

```nginx
server {
    listen 80;
    server_name archive.yourcompany.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable:

```bash
sudo ln -s /etc/nginx/sites-available/bioarchive /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d archive.yourcompany.com
```

## 4. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 5. Backup

```bash
cd bioeconomy-archive-system
set -a && source .env && set +a
./scripts/backup.sh
```

Daily backup cron:

```bash
crontab -e
```

```cron
0 2 * * * cd /home/YOURUSER/bioeconomy-archive-system && set -a && . ./.env && set +a && ./scripts/backup.sh
```

## 6. API Endpoints

- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/items`
- `POST /api/items`
- `GET /api/items/{id}`
- `PUT /api/items/{id}`
- `DELETE /api/items/{id}`
- `POST /api/items/{id}/files`
- `GET /api/items/{id}/dublin-core`
- `GET /api/export/items.csv`

## 7. Metadata Fields

The repository stores:

- `dc:title`
- `dc:subject`
- `dc:description`
- `dc:creator`
- `dc:publisher`
- `dc:contributor`
- `dc:date`
- `dc:type`
- `dc:format`
- `dc:identifier`
- `dc:source`
- `dc:language`
- `dc:relation`
- `dc:coverage`
- `dc:rights`

## 8. Next Improvements

Recommended before official company rollout:

- Add user management UI
- Add approval workflow UI
- Add role-based download restriction
- Add antivirus scanning for uploads
- Add MinIO/S3 file storage
- Add PDF preview and image thumbnails
- Add advanced search using Meilisearch/OpenSearch
- Add audit log viewer
- Add watermarking for restricted images
