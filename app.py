import base64
import csv
import io
import os
import random
import re
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path

from dotenv import load_dotenv
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
from supabase import Client, create_client
from twilio.rest import Client as TwilioClient


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "member-photos").strip() or "member-photos"
EXPORT_FILENAME = "registrations-export.csv"
BIRTHDAY_REMINDER_DAYS = {
    int(value.strip())
    for value in os.getenv("BIRTHDAY_REMINDER_DAYS", "7,3,0").split(",")
    if value.strip().isdigit()
}
DEPARTMENTS = [
    "Choir",
    "Drama",
    "Dance",
    "Ushers",
    "Sound",
    "Media",
    "Children's Ministry",
    "Youth Ministry",
    "Prayer Team",
    "Evangelism",
    "Protocol",
    "None for now",
]

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
    "photo_path",
    "download_count",
    "last_downloaded_at",
    "last_downloaded_by",
    "created_at",
]

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "change-this-secret-key")
CORS(app)

supabase_client = None
twilio_client = None


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


def get_supabase() -> Client:
    global supabase_client

    if supabase_client is not None:
        return supabase_client

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
        )

    supabase_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return supabase_client


def get_twilio() -> TwilioClient:
    global twilio_client

    if twilio_client is not None:
        return twilio_client

    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "").strip()
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "").strip()
    if not account_sid or not auth_token:
        raise RuntimeError("Twilio is not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.")

    twilio_client = TwilioClient(account_sid, auth_token)
    return twilio_client


def get_now_iso():
    return datetime.now(timezone.utc).isoformat()


def parse_phone_numbers(value):
    return [
        phone.strip()
        for phone in (value or "").split(",")
        if phone.strip()
    ]


def parse_birth_date(value):
    if not value:
        return None

    try:
        return datetime.strptime(str(value), "%Y-%m-%d").date()
    except ValueError:
        return None


def days_until_birthday(dob, today=None):
    birth_date = parse_birth_date(dob)
    if birth_date is None:
        return None

    today = today or datetime.now().date()
    birthday = birth_date.replace(year=today.year)
    if birthday < today:
        birthday = birth_date.replace(year=today.year + 1)
    return (birthday - today).days


def format_birthday_label(dob):
    birth_date = parse_birth_date(dob)
    if birth_date is None:
        return str(dob or "-")
    return birth_date.strftime("%d %b")


def get_birthday_reminder_members(registrations):
    reminder_members = []
    for row in registrations:
        days_away = days_until_birthday(row.get("dob"))
        if days_away in BIRTHDAY_REMINDER_DAYS:
            reminder_members.append(
                {
                    "full_name": row.get("full_name") or "Member",
                    "phone": row.get("phone") or "-",
                    "department": row.get("department") or "Member",
                    "dob": row.get("dob") or "",
                    "birthday": format_birthday_label(row.get("dob")),
                    "days_away": days_away,
                }
            )

    return sorted(reminder_members, key=lambda item: (item["days_away"], item["full_name"]))


def build_birthday_admin_message(members):
    if not members:
        return "Birthday reminder: No member birthdays are due today, in 3 days, or in 7 days."

    lines = ["Birthday reminder from Global Harvest Outer Ringroad:"]
    for member in members:
        if member["days_away"] == 0:
            timing = "today"
        elif member["days_away"] == 3:
            timing = "in 3 days"
        elif member["days_away"] == 7:
            timing = "in 7 days"
        else:
            timing = f"in {member['days_away']} days"

        lines.append(
            f"- {member['full_name']} ({member['department']}) birthday is {timing}, {member['birthday']}. Phone: {member['phone']}"
        )

    return "\n".join(lines)


def send_twilio_whatsapp(to_number, message):
    whatsapp_from = os.getenv("TWILIO_WHATSAPP_FROM", "").strip()
    if not whatsapp_from:
        raise RuntimeError("TWILIO_WHATSAPP_FROM is not configured.")

    return get_twilio().messages.create(
        from_=whatsapp_from,
        to=f"whatsapp:{to_number}",
        body=message,
    )


def slugify(value):
    return re.sub(r"[^a-z0-9]+", "-", (value or "").strip().lower()).strip("-") or "member"


def normalize_email(value):
    return (value or "").strip().lower()


def normalize_registration_payload(data):
    return {
        "full_name": (data.get("fullName") or "").strip(),
        "email": normalize_email(data.get("email")),
        "phone": data.get("phone") or "",
        "dob": data.get("dob") or "",
        "age": data.get("ageNum"),
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


def generate_member_id(state_origin):
    state = ((state_origin or "LAG").strip() or "LAG")[:3].upper()
    year = datetime.now().year
    num = random.randint(1000, 9999)
    return f"GHO-{state}-{year}-{num}"


def assign_unique_member_id(registration, max_attempts=25):
    for _ in range(max_attempts):
        member_id = generate_member_id(registration.get("state_origin"))
        if not find_by_member_id(member_id):
            registration["member_id"] = member_id
            return registration

    raise RuntimeError("Could not generate a unique member ID. Please try again.")


def decorate_registration(row):
    decorated = dict(row)
    decorated["registration_id"] = str(decorated.get("id") or "")
    decorated["id"] = decorated.get("id")
    decorated["download_count"] = int(decorated.get("download_count") or 0)
    photo_path = decorated.get("photo_path")
    decorated["photo_url"] = (
        url_for("member_photo", filename=photo_path)
        if photo_path
        else None
    )
    return decorated


def fetch_registrations():
    response = (
        get_supabase()
        .table("registrations")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    return [decorate_registration(row) for row in (response.data or [])]


def get_registration_by_id(registration_id):
    response = (
        get_supabase()
        .table("registrations")
        .select("*")
        .eq("id", registration_id)
        .limit(1)
        .execute()
    )
    if not response.data:
        return None
    return decorate_registration(response.data[0])


def find_by_email(email):
    response = (
        get_supabase()
        .table("registrations")
        .select("id")
        .eq("email", email)
        .limit(1)
        .execute()
    )
    return bool(response.data)


def find_by_member_id(member_id):
    response = (
        get_supabase()
        .table("registrations")
        .select("id")
        .eq("member_id", member_id)
        .limit(1)
        .execute()
    )
    return bool(response.data)


def save_member_photo(photo_data_url, member_id):
    if not photo_data_url:
        return ""

    match = re.match(r"^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$", photo_data_url)
    if not match:
        raise ValueError("Invalid image data received.")

    image_bytes = base64.b64decode(match.group(1))
    path = f"members/{slugify(member_id)}-{int(datetime.now(timezone.utc).timestamp())}.jpg"
    get_supabase().storage.from_(SUPABASE_BUCKET).upload(
        path=path,
        file=image_bytes,
        file_options={"content-type": "image/jpeg", "upsert": "false"},
    )
    return path


def delete_photo(photo_path):
    if not photo_path:
        return
    get_supabase().storage.from_(SUPABASE_BUCKET).remove([photo_path])


def delete_registration_by_id(registration_id):
    registration = get_registration_by_id(registration_id)
    if registration is None:
        return None

    get_supabase().table("registrations").delete().eq("id", registration_id).execute()
    delete_photo(registration.get("photo_path"))
    return registration


def mark_registration_downloaded(registration_id, actor):
    registration = get_registration_by_id(registration_id)
    if registration is None:
        return None

    payload = {
        "download_count": int(registration.get("download_count") or 0) + 1,
        "last_downloaded_at": get_now_iso(),
        "last_downloaded_by": actor,
    }
    response = (
        get_supabase()
        .table("registrations")
        .update(payload)
        .eq("id", registration_id)
        .execute()
    )
    if not response.data:
        return None
    return decorate_registration(response.data[0])


def build_csv_export(registrations):
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=CSV_COLUMNS)
    writer.writeheader()

    for row in registrations:
        writer.writerow(
            {
                "registration_id": row.get("id", ""),
                "full_name": row.get("full_name", ""),
                "email": row.get("email", ""),
                "phone": row.get("phone", ""),
                "dob": row.get("dob", ""),
                "age": row.get("age", ""),
                "gender": row.get("gender", ""),
                "address": row.get("address", ""),
                "department": row.get("department", ""),
                "marital_status": row.get("marital_status", ""),
                "state_origin": row.get("state_origin", ""),
                "nationality": row.get("nationality", ""),
                "occupation": row.get("occupation", ""),
                "first_time": row.get("first_time", ""),
                "inviter": row.get("inviter", ""),
                "why_joined": row.get("why_joined", ""),
                "prayer_request": row.get("prayer_request", ""),
                "nok_name": row.get("nok_name", ""),
                "nok_phone": row.get("nok_phone", ""),
                "member_id": row.get("member_id", ""),
                "photo_path": row.get("photo_path", ""),
                "download_count": row.get("download_count", 0),
                "last_downloaded_at": row.get("last_downloaded_at", ""),
                "last_downloaded_by": row.get("last_downloaded_by", ""),
                "created_at": row.get("created_at", ""),
            }
        )

    return output.getvalue().encode("utf-8")


def get_storage_summary(registrations):
    latest_registration = registrations[0] if registrations else None
    one_week_ago = datetime.now(timezone.utc).timestamp() - (7 * 24 * 60 * 60)
    recent_signups = 0
    gender_totals = {}
    department_totals = {department: 0 for department in DEPARTMENTS}
    first_timers = 0
    captured_photos = 0
    total_downloads = 0

    for row in registrations:
        created_at = row.get("created_at")
        if created_at:
            try:
                parsed = datetime.fromisoformat(str(created_at).replace("Z", "+00:00"))
                if parsed.timestamp() >= one_week_ago:
                    recent_signups += 1
            except ValueError:
                pass

        gender = (row.get("gender") or "").strip() or "Unspecified"
        department = (row.get("department") or "").strip() or "Unassigned"
        if department not in department_totals:
            department_totals[department] = 0
        gender_totals[gender] = gender_totals.get(gender, 0) + 1
        department_totals[department] = department_totals.get(department, 0) + 1

        if (row.get("first_time") or "").strip().lower() == "yes":
            first_timers += 1
        if row.get("photo_path"):
            captured_photos += 1
        total_downloads += int(row.get("download_count") or 0)

    return {
        "success": True,
        "overview": {
            "total_members": len(registrations),
            "first_timers": first_timers,
            "captured_photos": captured_photos,
            "recent_signups": recent_signups,
            "total_downloads": total_downloads,
            "latest_registration": latest_registration,
        },
        "gender_breakdown": [
            {"label": label, "total": total}
            for label, total in sorted(gender_totals.items(), key=lambda item: (-item[1], item[0]))
        ],
        "department_breakdown": [
            {"label": label, "total": total}
            for label, total in sorted(department_totals.items(), key=lambda item: (-item[1], item[0]))
        ],
        "csv_backup": {
            "path": "generated-from-supabase",
            "filename": EXPORT_FILENAME,
            "rows": len(registrations),
            "modified_at": get_now_iso(),
        },
        "database": {
            "engine": "supabase-postgres",
        },
    }


@app.route("/")
def index():
    return render_template("index.html", departments=DEPARTMENTS)


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
    try:
        file_bytes = get_supabase().storage.from_(SUPABASE_BUCKET).download(filename)
    except Exception:
        abort(404)

    return send_file(
        io.BytesIO(file_bytes),
        mimetype="image/jpeg",
        download_name=Path(filename).name,
    )


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
    return render_template("admin.html", departments=DEPARTMENTS)


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
    registrations = fetch_registrations()
    return send_file(
        io.BytesIO(build_csv_export(registrations)),
        mimetype="text/csv",
        as_attachment=True,
        download_name=EXPORT_FILENAME,
    )


@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    registration = normalize_registration_payload(data)

    if not registration["full_name"]:
        return jsonify({"success": False, "error": "Full name is required."}), 400
    if not registration["email"]:
        return jsonify({"success": False, "error": "Email is required."}), 400

    try:
        assign_unique_member_id(registration)
        photo_path = save_member_photo(data.get("photoDataUrl"), registration["member_id"])
        payload = {
            **registration,
            "photo_path": photo_path,
        }
        response = (
            get_supabase()
            .table("registrations")
            .insert(payload)
            .execute()
        )
        saved_row = decorate_registration(response.data[0])
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

    return jsonify(
        {
            "success": True,
            "message": "Registration saved successfully.",
            "registration_id": saved_row["id"],
            "member_id": saved_row["member_id"],
            "created_at": saved_row["created_at"],
        }
    )


@app.route("/api/registrations", methods=["GET"])
@admin_required
def get_registrations():
    try:
        return jsonify({"success": True, "registrations": fetch_registrations()})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/stats", methods=["GET"])
@admin_required
def get_stats():
    try:
        return jsonify(get_storage_summary(fetch_registrations()))
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/admin/summary", methods=["GET"])
@admin_required
def get_admin_summary():
    try:
        return jsonify(get_storage_summary(fetch_registrations()))
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/admin/birthday-reminders/send", methods=["POST"])
@admin_required
def send_birthday_reminders():
    try:
        recipients = parse_phone_numbers(os.getenv("BIRTHDAY_REMINDER_RECIPIENTS", ""))
        if not recipients:
            return jsonify({"success": False, "error": "No birthday reminder recipients configured."}), 400

        members = get_birthday_reminder_members(fetch_registrations())
        message = build_birthday_admin_message(members)
        sent = []
        failed = []

        for recipient in recipients:
            try:
                twilio_message = send_twilio_whatsapp(recipient, message)
                sent.append({"to": recipient, "sid": twilio_message.sid})
            except Exception as exc:
                failed.append({"to": recipient, "error": str(exc)})

        return jsonify(
            {
                "success": not failed,
                "members": members,
                "sent": sent,
                "failed": failed,
                "message": "Birthday reminder sent." if not failed else "Some reminders could not be sent.",
            }
        ), 200 if not failed else 207
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/registrations/<int:registration_id>", methods=["GET"])
@admin_required
def get_registration(registration_id):
    registration = get_registration_by_id(registration_id)
    if registration is None:
        return jsonify({"success": False, "error": "Registration not found."}), 404
    return jsonify({"success": True, "registration": registration})


@app.route("/api/registrations/<int:registration_id>", methods=["DELETE"])
@admin_required
def delete_registration(registration_id):
    try:
        removed = delete_registration_by_id(registration_id)
        if removed is None:
            return jsonify({"success": False, "error": "Registration not found."}), 404
        return jsonify({"success": True, "message": "Registration deleted successfully."})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/registrations/<int:registration_id>/download", methods=["POST"])
def mark_member_download(registration_id):
    try:
        updated = mark_registration_downloaded(registration_id, "member")
        if updated is None:
            return jsonify({"success": False, "error": "Registration not found."}), 404
        return jsonify({"success": True, "registration": updated})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/admin/registrations/<int:registration_id>/download", methods=["POST"])
@admin_required
def mark_admin_download(registration_id):
    try:
        updated = mark_registration_downloaded(registration_id, "admin")
        if updated is None:
            return jsonify({"success": False, "error": "Registration not found."}), 404
        return jsonify({"success": True, "registration": updated})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


if __name__ == "__main__":
    app.run(
        debug=True,
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
    )
