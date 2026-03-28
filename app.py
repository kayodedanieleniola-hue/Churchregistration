import base64
import csv
import os
import re
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path

from flask import (
    Flask,
    abort,
    jsonify,
    redirect,
    render_template,
    request,
    send_file,
    send_from_directory,
    session,
    url_for,
)
from flask_cors import CORS


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR / "data"))
PHOTOS_DIR = DATA_DIR / "photos"
CSV_PATH = Path(os.getenv("CSV_BACKUP_PATH", DATA_DIR / "registrations.csv"))

CSV_COLUMNS = [
    "registration_id",
    "full_name",
    "email",
    "phone",
    "dob",
    "age",
    "gender",
    "address",
    "department",
    "marital_status",
    "state_origin",
    "nationality",
    "occupation",
    "first_time",
    "inviter",
    "why_joined",
    "prayer_request",
    "nok_name",
    "nok_phone",
    "member_id",
    "photo_filename",
    "created_at",
]

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "change-this-secret-key")
CORS(app)


def ensure_storage():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PHOTOS_DIR.mkdir(parents=True, exist_ok=True)
    if not CSV_PATH.exists():
        with CSV_PATH.open("w", newline="", encoding="utf-8") as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=CSV_COLUMNS)
            writer.writeheader()


def get_admin_credentials():
    return (
        os.getenv("ADMIN_USERNAME", "admin"),
        os.getenv("ADMIN_PASSWORD", "change-me"),
    )


def is_admin_authenticated():
    return session.get("is_admin") is True


def admin_required(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if not is_admin_authenticated():
            if request.path.startswith("/api/"):
                return jsonify({"success": False, "error": "Unauthorized"}), 401
            return redirect(url_for("admin_login"))
        return view_func(*args, **kwargs)

    return wrapped


def get_now_iso():
    return datetime.now(timezone.utc).isoformat()


def slugify(value):
    return re.sub(r"[^a-z0-9]+", "-", (value or "").strip().lower()).strip("-") or "member"


def read_registrations():
    ensure_storage()
    with CSV_PATH.open("r", newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        rows = [decorate_registration(dict(row)) for row in reader]
    rows.sort(key=lambda row: (row.get("created_at") or "", row.get("registration_id") or ""), reverse=True)
    return rows


def write_registrations(rows):
    ensure_storage()
    clean_rows = [{column: row.get(column, "") for column in CSV_COLUMNS} for row in rows]
    with CSV_PATH.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        writer.writerows(clean_rows)


def append_registration(row):
    ensure_storage()
    with CSV_PATH.open("a", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=CSV_COLUMNS)
        writer.writerow({column: row.get(column, "") for column in CSV_COLUMNS})


def decorate_registration(row):
    decorated = dict(row)
    decorated["id"] = int(decorated["registration_id"]) if decorated.get("registration_id") else None
    photo_filename = decorated.get("photo_filename")
    decorated["photo_url"] = (
        url_for("member_photo", filename=photo_filename)
        if photo_filename
        else None
    )
    return decorated


def get_next_registration_id(existing_rows):
    ids = [int(row["registration_id"]) for row in existing_rows if row.get("registration_id")]
    return max(ids, default=0) + 1


def save_member_photo(photo_data_url, member_id, registration_id):
    if not photo_data_url:
        return ""

    match = re.match(r"^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$", photo_data_url)
    if not match:
        raise ValueError("Invalid image data received.")

    image_bytes = base64.b64decode(match.group(1))
    filename = f"{slugify(member_id or str(registration_id))}-{registration_id}.jpg"
    file_path = PHOTOS_DIR / filename
    with file_path.open("wb") as image_file:
        image_file.write(image_bytes)
    return filename


def get_registration_by_id(registration_id):
    for row in read_registrations():
        if row.get("registration_id") == str(registration_id):
            return row
    return None


def normalize_registration_payload(data):
    return {
        "full_name": (data.get("fullName") or "").strip(),
        "email": (data.get("email") or "").strip(),
        "phone": data.get("phone") or "",
        "dob": data.get("dob") or "",
        "age": str(data.get("ageNum") or ""),
        "gender": data.get("gender") or "",
        "address": data.get("address") or "",
        "department": data.get("department") or "",
        "marital_status": data.get("marital") or "",
        "state_origin": data.get("stateOrigin") or "",
        "nationality": data.get("nationality") or "",
        "occupation": data.get("occupation") or "",
        "first_time": data.get("firstTime") or "",
        "inviter": data.get("inviter") or "",
        "why_joined": data.get("whyJoined") or "",
        "prayer_request": data.get("prayerRequest") or "",
        "nok_name": data.get("nokName") or "",
        "nok_phone": data.get("nokPhone") or "",
        "member_id": (data.get("memberId") or "").strip(),
    }


def get_storage_summary(registrations):
    latest_registration = registrations[0] if registrations else None
    one_week_ago = datetime.now(timezone.utc).timestamp() - (7 * 24 * 60 * 60)
    recent_signups = 0

    for row in registrations:
        created_at = row.get("created_at")
        if not created_at:
            continue
        try:
            parsed = datetime.fromisoformat(created_at)
        except ValueError:
            continue
        if parsed.timestamp() >= one_week_ago:
            recent_signups += 1

    gender_totals = {}
    department_totals = {}
    first_timers = 0
    captured_photos = 0

    for row in registrations:
        gender = (row.get("gender") or "").strip() or "Unspecified"
        department = (row.get("department") or "").strip() or "Unassigned"
        gender_totals[gender] = gender_totals.get(gender, 0) + 1
        department_totals[department] = department_totals.get(department, 0) + 1

        if (row.get("first_time") or "").strip().lower() == "yes":
            first_timers += 1
        if row.get("photo_filename"):
            captured_photos += 1

    csv_modified_at = datetime.fromtimestamp(
        CSV_PATH.stat().st_mtime,
        tz=timezone.utc,
    ).isoformat()

    return {
        "success": True,
        "overview": {
            "total_members": len(registrations),
            "first_timers": first_timers,
            "captured_photos": captured_photos,
            "recent_signups": recent_signups,
            "latest_registration": latest_registration,
        },
        "gender_breakdown": [
            {"label": label, "total": total}
            for label, total in sorted(gender_totals.items(), key=lambda item: (-item[1], item[0]))
        ],
        "department_breakdown": [
            {"label": label, "total": total}
            for label, total in sorted(department_totals.items(), key=lambda item: (-item[1], item[0]))[:8]
        ],
        "csv_backup": {
            "path": str(CSV_PATH),
            "filename": CSV_PATH.name,
            "rows": len(registrations),
            "modified_at": csv_modified_at,
        },
        "database": {
            "engine": "csv-file",
        },
    }


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/favicon.ico")
def favicon():
    return send_from_directory(
        app.static_folder,
        "favicon.svg",
        mimetype="image/svg+xml",
    )


@app.route("/healthz")
def healthcheck():
    return jsonify({"success": True, "status": "ok"})


@app.route("/media/photos/<path:filename>")
@admin_required
def member_photo(filename):
    safe_path = (PHOTOS_DIR / filename).resolve()
    if PHOTOS_DIR.resolve() not in safe_path.parents and safe_path != PHOTOS_DIR.resolve():
        abort(404)
    if not safe_path.exists():
        abort(404)
    return send_from_directory(PHOTOS_DIR, filename)


@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    if request.method == "POST":
        username = (request.form.get("username") or "").strip()
        password = request.form.get("password") or ""
        admin_username, admin_password = get_admin_credentials()

        if username == admin_username and password == admin_password:
            session["is_admin"] = True
            return redirect(url_for("admin_dashboard"))

        return render_template(
            "admin_login.html",
            error="Invalid admin username or password.",
        )

    if is_admin_authenticated():
        return redirect(url_for("admin_dashboard"))

    return render_template("admin_login.html", error=None)


@app.route("/admin/logout")
def admin_logout():
    session.clear()
    return redirect(url_for("admin_login"))


@app.route("/admin")
@admin_required
def admin_dashboard():
    return render_template("admin.html")


@app.route("/admin/id-card/<int:registration_id>")
@admin_required
def admin_id_card(registration_id):
    registration = get_registration_by_id(registration_id)
    if registration is None:
        return redirect(url_for("admin_dashboard"))
    return render_template("id_card.html", registration=registration)


@app.route("/admin/backups/registrations.csv")
@admin_required
def download_csv_backup():
    ensure_storage()
    return send_file(
        CSV_PATH,
        mimetype="text/csv",
        as_attachment=True,
        download_name=CSV_PATH.name,
    )


@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    registration = normalize_registration_payload(data)

    if not registration["full_name"]:
        return jsonify({"success": False, "error": "Full name is required."}), 400
    if not registration["email"]:
        return jsonify({"success": False, "error": "Email is required."}), 400
    if not registration["member_id"]:
        return jsonify({"success": False, "error": "Member ID is required."}), 400

    try:
        existing_rows = read_registrations()
        if any(row.get("member_id") == registration["member_id"] for row in existing_rows):
            return jsonify(
                {
                    "success": False,
                    "error": "This member ID already exists. Refresh and try again.",
                }
            ), 409

        registration_id = get_next_registration_id(existing_rows)
        photo_filename = save_member_photo(
            data.get("photoDataUrl"),
            registration["member_id"],
            registration_id,
        )

        saved_row = {
            "registration_id": str(registration_id),
            **registration,
            "photo_filename": photo_filename,
            "created_at": get_now_iso(),
        }
        append_registration(saved_row)
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

    return jsonify(
        {
            "success": True,
            "message": "Registration saved successfully.",
            "registration_id": registration_id,
            "member_id": registration["member_id"],
            "created_at": saved_row["created_at"],
        }
    )


@app.route("/api/registrations", methods=["GET"])
@admin_required
def get_registrations():
    try:
        return jsonify({"success": True, "registrations": read_registrations()})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/stats", methods=["GET"])
@admin_required
def get_stats():
    try:
        return jsonify(get_storage_summary(read_registrations()))
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/admin/summary", methods=["GET"])
@admin_required
def get_admin_summary():
    try:
        return jsonify(get_storage_summary(read_registrations()))
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/registrations/<int:registration_id>", methods=["GET"])
@admin_required
def get_registration(registration_id):
    registration = get_registration_by_id(registration_id)
    if registration is None:
        return jsonify({"success": False, "error": "Registration not found."}), 404
    return jsonify({"success": True, "registration": registration})


ensure_storage()


if __name__ == "__main__":
    app.run(
        debug=True,
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
    )
