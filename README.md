# Ender 3 Web Controller

This is the web interface for controlling your Ender 3 3D printer.

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the server:
   ```bash
   python server.py
   ```

3. Open your browser to `http://localhost:5001` or `http://YOUR_IP:5001`

## Features

- Connect to printer via serial port
- Real-time temperature monitoring
- Jog controls for manual movement
- G-code file upload and printing
- SD card file browsing and printing
- Console for manual commands
- Settings customization

## Files

- `server.py` - Flask server with SocketIO
- `templates/index.html` - Main web interface
- `static/main.js` - Client-side JavaScript
- `static/styles.css` - Styling
- `requirements.txt` - Python dependencies