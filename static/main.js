const socket = io();

let uploadedPath = null;

socket.on('connect', () => console.log('socket connected'));
socket.on('hello', d => console.log('server:', d));

socket.on('printer_msg', d => {
  appendConsole(d.msg);
});

socket.on('printer_status', d => {
  if (d.temperature) {
    document.getElementById('hotend').textContent = (d.temperature.T ? d.temperature.T.toFixed(1) : '—') + ' °C';
    document.getElementById('bed').textContent = (d.temperature.B ? d.temperature.B.toFixed(1) : '—') + ' °C';
  }
  const progressBar = document.getElementById('progress-bar');
  const pct = d.total_lines > 0 ? Math.round((d.sent_lines / d.total_lines) * 100) : 0;
  progressBar.style.width = pct + '%';
  const pctEl = progressBar.querySelector('.progress-pct');
  if (pctEl) pctEl.textContent = pct + '%';
  else progressBar.textContent = pct + '%';
  document.getElementById('status').textContent = d.running ? 'Connected/Printing' : 'Idle';
});

socket.on('connect_response', d => {
  appendConsole('Connect: ' + JSON.stringify(d));
  const light = document.getElementById('connection-light');
  const text = document.getElementById('connection-text');
  if (d.ok) {
    light.className = 'status-light connected';
    text.textContent = 'Connected';
  } else {
    light.className = 'status-light disconnected';
    text.textContent = 'Disconnected';
  }
});

socket.on('disconnect_response', d => {
  const light = document.getElementById('connection-light');
  const text = document.getElementById('connection-text');
  light.className = 'status-light disconnected';
  text.textContent = 'Disconnected';
});

socket.on('sd_list', d => {
  const select = document.getElementById('sd-files');
  select.innerHTML = '';
  const gcodeFiles = d.files.filter(f => f.toUpperCase().endsWith('.GCO')).sort();
  gcodeFiles.forEach(f => {
    const option = document.createElement('option');
    option.value = f;
    option.textContent = f;
    select.appendChild(option);
  });
});

function appendConsole(line) {
  const ta = document.getElementById('console-text');
  ta.value += line + '\n';
  ta.scrollTop = ta.scrollHeight;
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  };
});

// Connection
document.getElementById('connect').onclick = () => {
  const port = document.getElementById('port').value;
  socket.emit('connect_printer', { port });
};

document.getElementById('disconnect').onclick = () => {
  socket.emit('disconnect_printer');
};

document.getElementById('estop').onclick = () => {
  socket.emit('emergency_stop');
};

// ------------------------------------------------------------
// ⭐ NEW JOG SYSTEM (Relative Mode + Step Size + Hold-to-Repeat)
// ------------------------------------------------------------

const JOG_REPEAT_INTERVAL = 150;

function emitCmdWithFeedback(btn, cmd) {
  if (!cmd) return;
  console.log('emit send_cmd ->', cmd);
  socket.emit('send_cmd', { cmd });
  btn.style.transform = 'scale(0.95)';
  setTimeout(() => { btn.style.transform = ''; }, 150);
}

// Step size selector
let jogStep = 10;

document.querySelectorAll('.step-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.step-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    jogStep = parseFloat(btn.dataset.step);
  });
});

// Jog buttons
document.querySelectorAll('#jog-grid button[data-axis]').forEach(btn => {
  let repeatTimer = null;

  const axis = btn.dataset.axis;
  const dir = parseFloat(btn.dataset.dir);

  const sendJog = () => {
    const dist = jogStep * dir;
    const feed = axis === "Z" ? 600 : 3000;
    const cmd = `G91\nG1 ${axis}${dist} F${feed}\nG90`;
    emitCmdWithFeedback(btn, cmd);
  };

  const startRepeat = () => {
    sendJog();
    repeatTimer = setInterval(sendJog, JOG_REPEAT_INTERVAL);
  };

  const stopRepeat = () => {
    clearInterval(repeatTimer);
    repeatTimer = null;
  };

  btn.addEventListener('mousedown', startRepeat);
  btn.addEventListener('mouseup', stopRepeat);
  btn.addEventListener('mouseleave', stopRepeat);

  btn.addEventListener('touchstart', (e) => { e.preventDefault(); startRepeat(); }, { passive: false });
  btn.addEventListener('touchend', (e) => { e.preventDefault(); stopRepeat(); }, { passive: false });
});

// Home button
document.getElementById('home').addEventListener('click', () => {
  socket.emit('send_cmd', { cmd: 'G28' });
});

// Temperature
document.getElementById('set-hotend').onclick = () => {
  const temp = document.getElementById('hotend-set').value;
  socket.emit('send_cmd', { cmd: `M104 S${temp}` });
};

document.getElementById('set-bed').onclick = () => {
  const temp = document.getElementById('bed-set').value;
  socket.emit('send_cmd', { cmd: `M140 S${temp}` });
};

// Print
document.getElementById('upload').onclick = async () => {
  const f = document.getElementById('gcodefile').files[0];
  if (!f) return alert('Select a file');
  const fd = new FormData();
  fd.append('file', f);
  const res = await fetch('/upload', { method: 'POST', body: fd });
  const j = await res.json();
  if (j.ok) { uploadedPath = j.path; alert('Uploaded'); } else alert(j.msg || 'Upload failed');
};

document.getElementById('start').onclick = () => {
  if (!uploadedPath) return alert('Upload first');
  socket.emit('upload_and_start', { path: uploadedPath });
};

document.getElementById('pause').onclick = () => {
  socket.emit('send_cmd', { cmd: 'M25' });
};

document.getElementById('resume').onclick = () => {
  socket.emit('send_cmd', { cmd: 'M24' });
};

document.getElementById('stop').onclick = () => {
  socket.emit('stop_print');
};

document.getElementById('sd-refresh').onclick = () => {
  socket.emit('send_cmd', { cmd: 'M20' });
};

document.getElementById('sd-start').onclick = () => {
  const file = document.getElementById('sd-files').value;
  if (!file) return alert('Select a file');
  socket.emit('send_cmd', { cmd: `M23 ${file}` });
  socket.emit('send_cmd', { cmd: 'M24' });
};

// Settings
const SETTINGS_KEY = 'ender3_settings_v1';

function applyAccent(color) {
  if (!color) return;
  const root = document.documentElement;
  root.style.setProperty('--accent-color', color);
  root.style.setProperty('--accent-hover', color);
  root.style.setProperty('--accent-muted', hexToRgba(color, 0.12));
  root.style.setProperty('--border-color', hexToRgba(color, 0.18));
  root.style.setProperty('--border-subtle', hexToRgba(color, 0.2));
}

function applyNeonIntensity(value) {
  const root = document.documentElement;
  const v = Math.max(0, Math.min(100, value)) / 100;
  root.style.setProperty('--neon-a', (0.15 + 0.4 * v).toFixed(2));
  root.style.setProperty('--neon-b', (0.08 + 0.22 * v).toFixed(2));
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return `rgba(42, 243, 255, ${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveSettings(next) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

const accentInput = document.getElementById('accent-color');
const neonInput = document.getElementById('neon-intensity');
const neonValue = document.getElementById('neon-value');
const defaultPort = document.getElementById('default-port');
const autoConnect = document.getElementById('auto-connect');
const resetSettings = document.getElementById('reset-settings');

if (accentInput && neonInput && defaultPort && autoConnect && resetSettings) {
  const settings = loadSettings();
  if (settings.accentColor) {
    accentInput.value = settings.accentColor;
    applyAccent(settings.accentColor);
  }
  if (typeof settings.neonIntensity === 'number') {
    neonInput.value = settings.neonIntensity;
    neonValue.textContent = `${settings.neonIntensity}%`;
    applyNeonIntensity(settings.neonIntensity);
  }
  if (settings.defaultPort) {
    defaultPort.value = settings.defaultPort;
    const portInput = document.getElementById('port');
    if (portInput) portInput.value = settings.defaultPort;
  }
  if (typeof settings.autoConnect === 'boolean') {
    autoConnect.checked = settings.autoConnect;
  }

  accentInput.addEventListener('input', () => {
    applyAccent(accentInput.value);
    settings.accentColor = accentInput.value;
    saveSettings(settings);
  });

  neonInput.addEventListener('input', () => {
    const value = parseInt(neonInput.value, 10) || 0;
    neonValue.textContent = `${value}%`;
    applyNeonIntensity(value);
    settings.neonIntensity = value;
    saveSettings(settings);
  });

  defaultPort.addEventListener('change', () => {
    settings.defaultPort = defaultPort.value.trim();
    const portInput = document.getElementById('port');
    if (portInput) portInput.value = settings.defaultPort;
    saveSettings(settings);
  });

  autoConnect.addEventListener('change', () => {
    settings.autoConnect = autoConnect.checked;
    saveSettings(settings);
    if (autoConnect.checked && defaultPort.value.trim()) {
      socket.emit('connect_printer', { port: defaultPort.value.trim() });
    }
  });

  resetSettings.addEventListener('click', () => {
    localStorage.removeItem(SETTINGS_KEY);
    accentInput.value = '#2af3ff';
    neonInput.value = 70;
    neonValue.textContent = '70%';
    defaultPort.value = '';
    autoConnect.checked = false;
    applyAccent('#2af3ff');
    applyNeonIntensity(70);
    saveSettings(loadSettings());
  });
}

// Console
document.getElementById('send').onclick = () => {
  const cmd = document.getElementById('cmd').value;
  if (!cmd) return;
  socket.emit('send_cmd', { cmd });
  document.getElementById('cmd').value = '';
};

document.getElementById('refresh-temp').onclick = () => {
  socket.emit('send_cmd', { cmd: 'M105' });
};

socket.on('send_response', d => {
  appendConsole('Send: ' + JSON.stringify(d));
  if (!d.ok) {
    console.warn('Command failed:', d.msg);
  }
});
