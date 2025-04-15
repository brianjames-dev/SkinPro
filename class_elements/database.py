import sqlite3
import datetime
import os
import shutil


def init_database():
    """
    Initialize or reuse the existing database.
    Weekly backups are made with a timestamped filename.
    """
    base_db = "client_database.db"

    # Create or reuse the main database
    is_new = not os.path.exists(base_db)
    conn = sqlite3.connect(base_db)
    cursor = conn.cursor()

    if is_new:
        print("🆕 Creating new main database...")
        create_tables(cursor)
        conn.commit()
    else:
        print("🟢 Reusing existing database...")

    # Weekly backup logic
    backup_folder = "db_backups"
    os.makedirs(backup_folder, exist_ok=True)

    today = datetime.date.today()
    current_week = today.isocalendar()[1]  # Get ISO week number
    year = today.year

    backup_name = f"client_database_{year}_W{current_week}.db"
    backup_path = os.path.join(backup_folder, backup_name)

    if not os.path.exists(backup_path):
        print(f"📦 Creating weekly backup: {backup_name}")
        shutil.copyfile(base_db, backup_path)
    else:
        print(f"✅ Weekly backup already exists: {backup_name}")

    print(f"✅ Database ready: {base_db}")
    return conn

def create_tables(cursor):
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        gender TEXT,
        birthdate DATE,
        primary_phone TEXT,
        secondary_phone TEXT,
        email TEXT,
        address1 TEXT,
        address2 TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        referred_by TEXT,
        profile_picture TEXT
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS client_health_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        allergies TEXT,
        health_conditions TEXT,
        health_risks TEXT,
        medications TEXT,
        treatment_areas TEXT,
        current_products TEXT,
        skin_conditions TEXT,
        other_notes TEXT,
        desired_improvement TEXT,
        FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        date DATE NOT NULL,
        type TEXT NOT NULL,
        treatment TEXT,
        price TEXT,
        photos_taken TEXT DEFAULT 'No',
        treatment_notes TEXT,
        FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS client_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        shift INTEGER DEFAULT NULL,
        zoom INTEGER DEFAULT NULL,
        FOREIGN KEY(client_id) REFERENCES clients (id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        appointment_id INTEGER NOT NULL,
        appt_date DATE,
        file_path TEXT NOT NULL,
        type TEXT,
        description TEXT DEFAULT '',
        FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
        FOREIGN KEY (appointment_id) REFERENCES appointments (id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS prescriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        appointment_id INTEGER,
        start_date DATE,
        form_type TEXT,
        file_path TEXT NOT NULL,
        data_json TEXT,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        deadline DATE NOT NULL,
        notes TEXT,
        FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
    )
    """)
