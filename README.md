# Churchregistration

Flask-based church registration system for Global Harvest Outer Ringroad.

## Features

- Public registration flow
- Photo capture with upload fallback
- CSV-backed registration storage
- Member photos saved as JPG files in `data/photos`
- Protected admin dashboard
- Recoverable member ID card page
- Render deployment config

## Local Run

```bash
python -m pip install -r requirements.txt
python app.py
```

Admin login defaults:

- Username: `admin`
- Password: `change-me`

Set these environment variables before production deployment:

- `SECRET_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `DATA_DIR`
- `CSV_BACKUP_PATH`
