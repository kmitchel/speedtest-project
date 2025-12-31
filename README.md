# Internet Speed Test Tracker

A lightweight, automated tool to track your internet connection performance over time. It runs a speed test every 15 minutes and generates an interactive HTML dashboard with a dual-axis trend graph.

## Features

- **Automated Tracking**: Runs a speed test every 15 minutes in the background.
- **Interactive Dashboard**: Generates `index.html` with hoverable data points to see precise speeds and timestamps.
- **Dual-Axis Chart**: Separate scales for Download and Upload speeds to ensure both trends are clearly visible even when speeds vary significantly.
- **Historical Trends**: Keeps a rolling history of the last 100 tests.
- **Headless Execution**: Uses Puppeteer with OpenSpeedTest.com for reliable results without a GUI.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [npm](https://www.npmjs.com/)

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/kmitchel/speedtest-project.git
   cd speedtest-project
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Install System Dependencies (Arch Linux):**
   ```bash
   sudo pacman -S --needed nodejs npm python make g++ \
     pixman cairo pango libjpeg-turbo giflib \
     nss atk at-spi2-core libcups libdrm libxkbcommon \
     libxcomposite libxdamage libxext libxfixes libxrandr \
     mesa alsa-lib pango
   ```

## Usage

Start the background tracker:
```bash
node main.js
```

### Viewing Results
Open `index.html` in your favorite web browser to view the interactive dashboard.

## Running as a Background Service (Linux)

To run this 24/7 on a Linux system (like Arch), create a systemd service file:

1. Create `/etc/systemd/system/speedtest-tracker.service`:
   ```ini
   [Unit]
   Description=Internet Speed Test Tracker
   After=network.target

   [Service]
   Type=simple
   User=YOUR_USERNAME
   WorkingDirectory=/path/to/speedtest-project
   ExecStart=/usr/bin/node main.js
   Restart=always

   [Install]
   WantedBy=multi-user.target
   ```

2. Enable and start:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable speedtest-tracker.service
   sudo systemctl start speedtest-tracker.service
   ```

## License
MIT
