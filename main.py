from client_app import ClientApp
from database import init_database

if __name__ == "__main__":
    # Initialize database
    conn = init_database()

    # Start app and pass in database connection
    app = ClientApp(conn)
    app.mainloop()
