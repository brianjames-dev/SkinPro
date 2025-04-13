import socket
import qrcode
import os
from datetime import datetime


def get_local_ip():
    """Gets the best guess of your local IP address on LAN."""
    try:
        # Force socket to connect to your actual LAN
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("192.168.0.1", 80))  # Use local gateway to determine the LAN IP
        ip = s.getsockname()[0]
        s.close()
    except Exception:
        ip = "127.0.0.1"  # fallback
    return ip


def generate_upload_qr(client_id: int, appointment_id: int, output_dir: str = "./upload_server/qrcodes") -> str:
    """Generates a QR code linking to the upload page for this client/appointment."""
    ip = get_local_ip()
    url = f"http://{ip}:8000/upload?cid={client_id}&aid={appointment_id}"

    # Create output dir if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)

    # Unique filename (e.g., qr_12_34_20250412T1618.png)
    timestamp = datetime.now().strftime("%Y%m%dT%H%M")
    filename = f"temp_qr_code.png"
    filepath = os.path.join(output_dir, filename)

    # Generate QR code
    img = qrcode.make(url)
    img.save(filepath)

    print(f"✅ QR Code generated: {filepath}")
    return filepath
