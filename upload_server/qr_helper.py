import socket
import qrcode
import os
from datetime import datetime


def get_local_ip():
    """Gets the best guess of your LAN-local IP address, without relying on a specific gateway."""
    try:
        # Use a non-routable address to determine default interface IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        print(f"🌐 Detected local IP: {ip}")
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    print(f"Using local IP for QR: {ip}")
    return ip


def generate_upload_qr(client_id: int, appointment_id: int = None, data_manager=None, mode: str = "photo") -> str:
    """Generates a QR code linking to the upload page for this client/appointment."""
    ip = get_local_ip()

    if mode == "profile":
        url = f"http://{ip}:8000/upload_profile_pic?cid={client_id}"
    else:
        url = f"http://{ip}:8000/upload?cid={client_id}&aid={appointment_id}"

    print(f"QR URL: {url}")

    # Determine QR code output path
    output_dir = data_manager.get_path("qrcodes")
    os.makedirs(output_dir, exist_ok=True)

    # Fixed filename for temporary QR
    filename = "temp_qr_code.png"
    filepath = os.path.join(output_dir, filename)

    # Generate QR code
    img = qrcode.make(url)
    img.save(filepath)

    print(f"QR Code generated: {filepath}")
    return filepath
