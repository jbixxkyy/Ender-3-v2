import os
import time
import subprocess
import threading
import logging
from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename
from pyngrok import ngrok

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from printer import EnderPrinter

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app = Flask(__name__, template_folder="templates", static_folder="static")
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="threading",
    logger=False,
    engineio_logger=False,
)
printer = EnderPrinter()
sd_files = []
connected_clients = 0
connected_lock = threading.Lock()

logging.getLogger("werkzeug").setLevel(logging.ERROR)
logging.getLogger("socketio").setLevel(logging.ERROR)
logging.getLogger("engineio").setLevel(logging.ERROR)


@app.after_request
def add_ngrok_header(response):
    """Add header to responses to skip ngrok browser warning when served via ngrok."""
    try:
        response.headers["ngrok-skip-browser-warning"] = "1"
    except Exception:
        pass
    return response


def background_worker():
    global sd_files
    collecting_sd = False
    temp_request_timer = 0
    while True:
        # relay any pending serial messages to connected web clients
        try:
            msgs = printer.read_messages()
            for m in msgs:
                socketio.emit("printer_msg", {"msg": m})
                # Parse SD file list
                if "Begin file list" in m:
                    collecting_sd = True
                    sd_files = []
                elif "End file list" in m:
                    collecting_sd = False
                    socketio.emit("sd_list", {"files": sd_files})
                elif collecting_sd and m.strip():
                    # Parse lines like "CAT-35~1.GCO 34432620"
                    parts = m.strip().split()
                    if parts:
                        filename = parts[0]
                        sd_files.append(filename)
        except Exception:
            pass

        # Request temperature periodically
        temp_request_timer += 0.5
        if temp_request_timer >= 2.0:  # every 2 seconds
            try:
                printer.request_temperature()
                temp_request_timer = 0
            except Exception:
                pass

        # periodic status update
        try:
            socketio.emit("printer_status", {
                "running": printer.running,
                "total_lines": printer.total_lines,
                "sent_lines": printer.sent_lines,
                "temperature": printer.temperature,
            })
        except Exception:
            pass

        time.sleep(0.5)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload():
    f = request.files.get("file")
    if not f:
        return jsonify({"ok": False, "msg": "No file supplied"}), 400
    filename = secure_filename(f.filename)
    path = os.path.join(UPLOAD_FOLDER, filename)
    f.save(path)
    return jsonify({"ok": True, "path": path})


@socketio.on("connect")
def on_connect():
    global connected_clients
    with connected_lock:
        connected_clients += 1
        count = connected_clients
    print(f"Clients connected: {count}")
    emit("hello", {"msg": "connected"})


@socketio.on("disconnect")
def on_disconnect():
    global connected_clients
    with connected_lock:
        connected_clients = max(0, connected_clients - 1)
        count = connected_clients
    print(f"Clients connected: {count}")


@socketio.on("connect_printer")
def on_connect_printer(data):
    port = data.get("port")
    ok, msg = printer.connect(port)
    emit("connect_response", {"ok": ok, "msg": msg})


@socketio.on("disconnect_printer")
def on_disconnect_printer():
    printer.disconnect()
    emit("disconnect_response", {"ok": True})


@socketio.on("send_cmd")
def on_send_cmd(data):
    cmd = data.get("cmd")
    if not cmd:
        emit("send_response", {"ok": False, "msg": "No cmd"})
        return
    # Log received command for debugging
    try:
        print(f"Received send_cmd: {cmd}")
        # If printer has an 'is_connected' attribute use it, otherwise attempt send
        if hasattr(printer, "is_connected") and not getattr(printer, "is_connected"):
            emit("send_response", {"ok": False, "msg": "Printer not connected"})
            return
        printer.send(cmd)
        emit("send_response", {"ok": True})
    except Exception as e:
        print(f"Error sending cmd: {e}")
        emit("send_response", {"ok": False, "msg": str(e)})


@socketio.on("upload_and_start")
def on_upload_and_start(data):
    path = data.get("path")
    if not path:
        emit("start_response", {"ok": False, "msg": "No path provided"})
        return
    try:
        printer.send_file(path)
        emit("start_response", {"ok": True})
    except Exception as e:
        emit("start_response", {"ok": False, "msg": str(e)})


@socketio.on("emergency_stop")
def on_emergency_stop():
    ok, msg = printer.emergency_stop()
    emit("emergency_response", {"ok": ok, "msg": msg})


@socketio.on("stop_print")
def on_stop_print():
    ok, msg = printer.stop_printing()
    emit("stop_response", {"ok": ok, "msg": msg})


def start_ngrok_tunnel():
    """Start ngrok Tunnel in background"""
    try:
        import time as time_module
        print("Starting ngrok Tunnel...")
        time_module.sleep(2)  # Give server time to start
        public_url = ngrok.connect(5001)
        print(f"✓ Public URL: {public_url}")
        print(f"✓ Access your printer from: {public_url}")
    except Exception as e:
        print(f"Warning: Could not start ngrok Tunnel: {e}")


if __name__ == "__main__":
    print("Starting server...")
    print("Running on http://localhost:5001")
    socketio.start_background_task(background_worker)
    print("Background task started")
    
    # Start ngrok Tunnel in background thread
    tunnel_thread = threading.Thread(target=start_ngrok_tunnel, daemon=True)
    tunnel_thread.start()
    
    # host=0.0.0.0 so you can open from other devices on the same LAN
    print("Running on 0.0.0.0:5001")
    socketio.run(app, host="0.0.0.0", port=5001)
