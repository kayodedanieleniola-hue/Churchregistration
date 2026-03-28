import os
import sqlite3
from functools import wraps
from pathlib import Path

from flask import (
    Flask,
    jsonify,
    redirect,
    render_template,
    request,
    send_from_directory,
    session,
    url_for,
)
from flask_cors import CORS


BASE_DIR = Path(__file__).resolve().parent
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", BASE_DIR / "registrations.db"))

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", "change-this-secret-key")
CORS(app)


def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS registrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT,
                dob TEXT,
                age INTEGER,
                gender TEXT,
                address TEXT,
                department TEXT,
                marital_status TEXT,
                state_origin TEXT,
                nationality TEXT,
                occupation TEXT,
                first_time TEXT,
                inviter TEXT,
                why_joined TEXT,
                prayer_request TEXT,
                nok_name TEXT,
                nok_phone TEXT,
                member_id TEXT UNIQUE,
                photo_data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


def row_to_dict(row):
    return dict(row) if row is not None else None


def get_registration_by_id(registration_id):
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT * FROM registrations WHERE id = ?",
            (registration_id,),
        ).fetchone()
    return row_to_dict(row)


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


def build_admin_summary():
    with get_db_connection() as conn:
        total_members = conn.execute(
            "SELECT COUNT(*) FROM registrations"
        ).fetchone()[0]
        first_timers = conn.execute(
            "SELECT COUNT(*) FROM registrations WHERE LOWER(COALESCE(first_time, '')) = 'yes'"
        ).fetchone()[0]
        captured_photos = conn.execute(
            "SELECT COUNT(*) FROM registrations WHERE photo_data IS NOT NULL AND TRIM(photo_data) != ''"
        ).fetchone()[0]
        recent_signups = conn.execute(
            """
            SELECT COUNT(*) FROM registrations
            WHERE datetime(created_at) >= datetime('now', '-7 day')
            """
        ).fetchone()[0]
        latest_registration = conn.execute(
            """
            SELECT full_name, member_id, created_at
            FROM registrations
            ORDER BY datetime(created_at) DESC, id DESC
            LIMIT 1
            """
        ).fetchone()
        gender_breakdown = conn.execute(
            """
            SELECT COALESCE(NULLIF(TRIM(gender), ''), 'Unspecified') AS label, COUNT(*) AS total
            FROM registrations
            GROUP BY label
            ORDER BY total DESC, label ASC
            """
        ).fetchall()
        department_breakdown = conn.execute(
            """
            SELECT COALESCE(NULLIF(TRIM(department), ''), 'Unassigned') AS label, COUNT(*) AS total
            FROM registrations
            GROUP BY label
            ORDER BY total DESC, label ASC
            LIMIT 8
            """
        ).fetchall()

    return {
        "success": True,
        "overview": {
            "total_members": total_members,
            "first_timers": first_timers,
            "captured_photos": captured_photos,
            "recent_signups": recent_signups,
            "latest_registration": row_to_dict(latest_registration),
        },
        "gender_breakdown": [row_to_dict(row) for row in gender_breakdown],
        "department_breakdown": [row_to_dict(row) for row in department_breakdown],
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


@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}

    full_name = (data.get("fullName") or "").strip()
    email = (data.get("email") or "").strip()
    member_id = (data.get("memberId") or "").strip() or None

    if not full_name:
        return jsonify({"success": False, "error": "Full name is required."}), 400
    if not email:
        return jsonify({"success": False, "error": "Email is required."}), 400

    try:
        with get_db_connection() as conn:
            cursor = conn.execute(
                """
                INSERT INTO registrations (
                    full_name, email, phone, dob, age, gender, address,
                    department, marital_status, state_origin, nationality,
                    occupation, first_time, inviter, why_joined, prayer_request,
                    nok_name, nok_phone, member_id, photo_data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    full_name,
                    email,
                    data.get("phone"),
                    data.get("dob"),
                    data.get("ageNum"),
                    data.get("gender"),
                    data.get("address"),
                    data.get("department"),
                    data.get("marital"),
                    data.get("stateOrigin"),
                    data.get("nationality"),
                    data.get("occupation"),
                    data.get("firstTime"),
                    data.get("inviter"),
                    data.get("whyJoined"),
                    data.get("prayerRequest"),
                    data.get("nokName"),
                    data.get("nokPhone"),
                    member_id,
                    data.get("photoDataUrl"),
                ),
            )
            saved_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        return jsonify(
            {
                "success": False,
                "error": "This member ID already exists. Refresh and try again.",
            }
        ), 409
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

    return jsonify(
        {
            "success": True,
            "message": "Registration saved successfully.",
            "registration_id": saved_id,
            "member_id": member_id,
        }
    )


@app.route("/api/registrations", methods=["GET"])
@admin_required
def get_registrations():
    try:
        with get_db_connection() as conn:
            rows = conn.execute(
                "SELECT * FROM registrations ORDER BY datetime(created_at) DESC, id DESC"
            ).fetchall()
        return jsonify({"success": True, "registrations": [row_to_dict(row) for row in rows]})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/stats", methods=["GET"])
@admin_required
def get_stats():
    try:
        return jsonify(build_admin_summary())
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/admin/summary", methods=["GET"])
@admin_required
def get_admin_summary():
    try:
        return jsonify(build_admin_summary())
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/registrations/<int:registration_id>", methods=["GET"])
@admin_required
def get_registration(registration_id):
    registration = get_registration_by_id(registration_id)
    if registration is None:
        return jsonify({"success": False, "error": "Registration not found."}), 404
    return jsonify({"success": True, "registration": registration})


init_db()


if __name__ == "__main__":
    app.run(
        debug=True,
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
    )
