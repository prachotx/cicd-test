# CRUD (React + Tailwind / Express / MySQL)

```
.
├── backend/              # Express API (port 3000)
├── frontend/             # React + Vite + Tailwind CSS v4
├── db/init.sql           # สร้างตาราง items + ข้อมูลตัวอย่าง
├── docker-compose.dev.yml
└── docker-compose.prod.yml
```

## Development (hot reload)

```bash
docker compose -f docker-compose.dev.yml up --build
```

- Frontend: http://localhost:5173 (Vite proxy `/api` → backend)
- Backend:  http://localhost:3000/api/items
- MySQL:    localhost:3307 (user `app` / pass `app`)

## Production

```bash
cp .env.example .env   # แก้รหัสผ่าน
docker compose -f docker-compose.prod.yml up --build -d
```

- เข้าเว็บที่ http://localhost (nginx เสิร์ฟไฟล์ build และ proxy `/api` → backend)
- backend และ db ไม่เปิด port ออกนอก

## API

| Method | Path             | คำอธิบาย     |
|--------|------------------|--------------|
| GET    | /api/items       | ดึงทั้งหมด   |
| GET    | /api/items/:id   | ดึงรายการเดียว |
| POST   | /api/items       | เพิ่ม        |
| PUT    | /api/items/:id   | แก้ไข        |
| DELETE | /api/items/:id   | ลบ           |

Body: `{ "name": "...", "description": "...", "price": 100 }`

## ลบข้อมูล DB (reset)

```bash
docker compose -f docker-compose.dev.yml down -v
```

## CI/CD (Jenkins)

ไฟล์ [Jenkinsfile](Jenkinsfile) ทำงานตามลำดับ:

1. **Version**: คำนวณเวอร์ชันอัตโนมัติด้วย [scripts/next-version.sh](scripts/next-version.sh) จาก tag ล่าสุด + commit message
   - `feat!:` / `BREAKING CHANGE` → major (`1.2.3` → `2.0.0`)
   - `feat:` → minor (`1.2.3` → `1.3.0`)
   - อื่น ๆ (`fix:`, `chore:` ...) → patch (`1.2.3` → `1.2.4`)
   - branch ที่ไม่ใช่ `main` ได้เวอร์ชันแบบ `1.3.0-<branch>.<build>`
2. **Build images**: `crud-backend:<version>`, `crud-frontend:<version>`
3. **Smoke test**: รัน stack แยก project แล้วเช็ค `/api/health`, `/api/items`, `/`
4. **Push images**: เมื่อกรอก parameter `REGISTRY` (main จะ push `latest` ด้วย)
5. **Tag release**: สร้าง git tag `vX.Y.Z` แล้ว push (เฉพาะ `main`)
6. **Deploy production**: `docker compose up -d` บนเครื่อง Jenkins agent (เฉพาะ `main` + `DEPLOY=true`)

Credentials ที่ต้องสร้างใน Jenkins:

| ID | ชนิด | ใช้ทำอะไร |
|----|------|-----------|
| `git-creds` | Username with password / token | push git tag |
| `docker-registry-creds` | Username with password | push image (ถ้าใช้ registry) |
| `crud-prod-env` | Secret file | ไฟล์ `.env` ของ production |

ดูเวอร์ชันที่ deploy อยู่: `GET /api/health` หรือที่ท้ายหน้าเว็บ
