import sqlite3
from faker import Faker  # Import Faker for generating mock data

def init_database(db_name="client_database.db"):
    """
    Initialize the database, create tables, and insert mock data if necessary.
    Returns a database connection object.
    """
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()

    # Create tables
    create_tables(cursor)

    # Insert mock data
    insert_mock_data(cursor)

    conn.commit()
    return conn

def create_tables(cursor):
    """Create necessary tables for the app."""
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        gender TEXT,
        birthdate TEXT,
        phone TEXT,
        email TEXT,
        address1 TEXT,
        address2 TEXT,
        city TEXT,
        state TEXT,
        zip TEXT,
        referred_by TEXT
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        date TEXT,
        time TEXT,
        treatment TEXT,
        price TEXT,
        photo_taken TEXT,
        treatment_notes TEXT,
        FOREIGN KEY (client_id) REFERENCES clients (id)
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS client_health_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        allergies TEXT,
        health_conditions TEXT,
        medications TEXT,
        treatment_areas TEXT,
        current_products TEXT,
        skin_conditions TEXT,
        other_notes TEXT,
        desired_improvement TEXT,
        FOREIGN KEY (client_id) REFERENCES clients (id)
    )
    """)

def insert_mock_data(cursor):
    """Insert mock data into the database if it doesn't already exist."""
    fake = Faker()

    # Check if data already exists in the clients table
    cursor.execute("SELECT COUNT(*) FROM clients")
    if cursor.fetchone()[0] == 0:
        # Generate 100 mock clients
        mock_clients = []
        for _ in range(100):
            address = fake.address().split("\n")
            address1 = address[0]
            address2 = address[1] if len(address) > 1 else ""
            mock_clients.append((
                fake.name(),
                fake.random_element(["Male", "Female"]),
                fake.date_of_birth(minimum_age=18, maximum_age=80).strftime("%m/%d/%Y"),
                fake.phone_number(),
                fake.email(),
                address1,
                address2,
                fake.city(),
                fake.state(),
                fake.zipcode(),
                fake.name() if fake.boolean() else ""
            ))
        cursor.executemany("""
        INSERT INTO clients (full_name, gender, birthdate, phone, email, address1, address2, city, state, zip, referred_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, mock_clients)

    # Check if data already exists in the appointments table
    cursor.execute("SELECT COUNT(*) FROM appointments")
    if cursor.fetchone()[0] == 0:
        # Generate 100 mock appointments
        mock_appointments = [
            (
                fake.random_int(min=1, max=100),  # client_id (randomly assign to a client)
                fake.date_this_year().strftime("%m/%d/%Y"),  # Random date within this year
                fake.time(pattern="%I:%M %p"),  # Random time in 12-hour format
                fake.sentence(nb_words=5),  # Random treatment description
                f"${fake.random_int(min=30, max=500)}.00",  # Random price
                fake.random_element(["Yes", "No"]),  # Photo taken
                fake.sentence(nb_words=10)  # Random treatment notes

            )
            for _ in range(100)
        ]
        cursor.executemany("""
        INSERT INTO appointments (client_id, date, time, treatment, price, photo_taken, treatment_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, mock_appointments)

    # Check if data already exists in the client_health_info table
    cursor.execute("SELECT COUNT(*) FROM client_health_info")
    if cursor.fetchone()[0] == 0:
        # Generate 100 mock health records
        mock_health_info = [
            (
                fake.random_int(min=1, max=100),  # client_id
                ", ".join(fake.words(nb=3)),  # Allergies as a comma-separated string
                fake.sentence(nb_words=4),  # Health conditions
                ", ".join(fake.words(nb=2)),  # Medications as a comma-separated string
                ", ".join(fake.words(nb=3)),  # Treatment areas as a comma-separated string
                ", ".join(fake.words(nb=2)),  # Current products as a comma-separated string
                ", ".join(fake.words(nb=3)),  # Skin conditions as a comma-separated string
                fake.sentence(nb_words=6),  # Other notes
                fake.sentence(nb_words=4)  # Desired improvement
            )
            for _ in range(100)
        ]
        cursor.executemany("""
        INSERT INTO client_health_info (client_id, allergies, health_conditions, medications, treatment_areas, current_products, skin_conditions, other_notes, desired_improvement)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, mock_health_info)
