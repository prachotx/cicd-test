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

