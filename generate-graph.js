const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

async function generateGraph() {
    const dbPath = path.join(__dirname, 'speedtest.db');

    let data = [];
    try {
        data = await new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('Could not open database:', err);
                    resolve([]);
                    return;
                }
            });

            db.serialize(() => {
                // Ensure the table exists so the query doesn't fail
                db.run(`CREATE TABLE IF NOT EXISTS results (
                    timestamp TEXT,
                    download REAL,
                    upload REAL,
                    ping REAL,
                    jitter REAL
                )`, (err) => {
                    if (err) {
                        console.error('Error creating table:', err);
                        db.close();
                        resolve([]);
                        return;
                    }

                    db.all("SELECT * FROM results ORDER BY timestamp ASC", [], (err, rows) => {
                        db.close();
                        if (err) {
                            console.error('Error querying database:', err);
                            resolve([]);
                        } else {
                            resolve(rows);
                        }
                    });
                });
            });
        });
    } catch (err) {
        console.error('Error reading database:', err);
        return;
    }

    if (data.length === 0) {
        console.log("No data found in database.");
    }

    // Inject data into the HTML template
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Internet Performance Insights</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns"></script>
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: #1e293b;
            --text-main: #f8fafc;
            --text-dim: #94a3b8;
            --download-color: #38bdf8;
            --upload-color: #fbbf24;
            --grid-color: rgba(148, 163, 184, 0.1);
        }
        body {
            font-family: 'Outfit', 'Inter', system-ui, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            overflow: hidden;
        }
        .container {
            width: calc(100vw - 2rem);
            height: calc(100vh - 2rem);
            background: var(--card-bg);
            padding: 1rem;
            border-radius: 1.5rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            margin: 1rem;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid var(--grid-color);
            flex-shrink: 0;
        }
        h1 { margin: 0; font-weight: 300; font-size: 1.8rem; letter-spacing: -0.02em; }
        .controls {
            display: flex;
            gap: 0.5rem;
            background: rgba(15, 23, 42, 0.5);
            padding: 0.3rem;
            border-radius: 0.6rem;
        }
        .btn {
            background: transparent;
            border: none;
            color: var(--text-dim);
            padding: 0.4rem 1rem;
            border-radius: 0.4rem;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            font-size: 0.85rem;
            font-weight: 500;
        }
        .btn:hover { color: var(--text-main); }
        .btn.active {
            background: var(--download-color);
            color: #0f172a;
            font-weight: 700;
            box-shadow: 0 4px 12px rgba(56, 189, 248, 0.3);
        }
        .stats-summary { display: flex; gap: 2rem; }
        .stat-item { display: flex; flex-direction: column; align-items: flex-end; }
        .stat-label { font-size: 0.65rem; text-transform: uppercase; color: var(--text-dim); letter-spacing: 0.1em; margin-bottom: 0.2rem; }
        .stat-value { font-size: 1.4rem; font-weight: 700; font-variant-numeric: tabular-nums; }
        
        .chart-wrapper { 
            position: relative; 
            flex: 1;
            min-height: 0;
            width: 100%; 
        }
        .footer { 
            margin-top: 1rem; 
            text-align: center; 
            color: var(--text-dim); 
            font-size: 0.75rem;
            flex-shrink: 0;
            opacity: 0.7;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Internet Performance <span style="font-weight: 600; color: var(--download-color)">Insights</span></h1>
            <div class="controls">
                <button class="btn active" onclick="updateTimeRange('all', this)">All Time</button>
                <button class="btn" onclick="updateTimeRange(24, this)">24h</button>
                <button class="btn" onclick="updateTimeRange(168, this)">7d</button>
            </div>
            <div class="stats-summary" id="currentStats"></div>
        </header>
        <div class="chart-wrapper">
            <canvas id="speedChart"></canvas>
        </div>
        <div class="footer" id="lastUpdated"></div>
    </div>
    <script>
        const allData = ${JSON.stringify(data)};
        let chartInstance = null;
        
        function initDashboard() {
            if (!allData || allData.length === 0) return;
            
            const lastTest = allData[allData.length - 1];
            document.getElementById('currentStats').innerHTML = \`
                <div class="stat-item">
                    <span class="stat-label">Download</span>
                    <span class="stat-value" style="color: var(--download-color)">\${lastTest.download} <small>Mbps</small></span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Upload</span>
                    <span class="stat-value" style="color: var(--upload-color)">\${lastTest.upload} <small>Mbps</small></span>
                </div>
            \`;
            document.getElementById('lastUpdated').textContent = "Last sync: " + new Date(lastTest.timestamp).toLocaleString();
            updateTimeRange('all');
        }

        function updateTimeRange(hours, btn) {
            if (btn) {
                document.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }
            let filteredData = allData;
            if (hours !== 'all') {
                const cutoff = Date.now() - (hours * 60 * 60 * 1000);
                filteredData = allData.filter(d => new Date(d.timestamp).getTime() >= cutoff);
            }
            renderChart(filteredData);
        }

        function renderChart(data) {
            const ctx = document.getElementById('speedChart').getContext('2d');
            if (chartInstance) chartInstance.destroy();

            const dayShadingPlugin = {
                id: 'dayShading',
                beforeDraw: (chart) => {
                    const { ctx, chartArea, scales: { x } } = chart;
                    if (!x || !chartArea) return;
                    const oneDay = 24 * 60 * 60 * 1000;
                    const startTick = Math.floor(x.min / oneDay) * oneDay;
                    ctx.save();
                    for (let t = startTick; t < x.max; t += oneDay) {
                        const dayNum = Math.floor(t / oneDay);
                        if (dayNum % 2 === 0) {
                            const left = Math.max(x.getPixelForValue(t), chartArea.left);
                            const right = Math.min(x.getPixelForValue(t + oneDay), chartArea.right);
                            if (right > left) {
                                ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
                                ctx.fillRect(left, chartArea.top, right - left, chartArea.bottom - chartArea.top);
                                ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
                                ctx.lineWidth = 1;
                                ctx.beginPath();
                                ctx.moveTo(left, chartArea.top);
                                ctx.lineTo(left, chartArea.bottom);
                                ctx.stroke();
                            }
                        }
                    }
                    ctx.restore();
                }
            };

            chartInstance = new Chart(ctx, {
                type: 'line',
                plugins: [dayShadingPlugin],
                data: {
                    datasets: [
                        {
                            label: 'Download Speed',
                            data: data.map(d => ({ x: d.timestamp, y: d.download })),
                            borderColor: '#38bdf8',
                            backgroundColor: 'rgba(56, 189, 248, 0.05)',
                            fill: true,
                            tension: 0.4,
                            borderWidth: 2,
                            pointRadius: 0,
                            pointHoverRadius: 6,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Upload Speed',
                            data: data.map(d => ({ x: d.timestamp, y: d.upload })),
                            borderColor: '#fbbf24',
                            backgroundColor: 'rgba(251, 191, 36, 0.05)',
                            fill: true,
                            tension: 0.4,
                            borderWidth: 2,
                            pointRadius: 0,
                            pointHoverRadius: 6,
                            yAxisID: 'y1',
                            hidden: true
                        },
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    animation: { duration: 400 },
                    plugins: {
                        legend: { 
                            position: 'top',
                            align: 'end',
                            labels: { color: '#94a3b8', boxWidth: 12, usePointStyle: true, pointStyle: 'circle', padding: 20, font: { size: 11 } } 
                        },
                        tooltip: {
                            backgroundColor: '#1e293b',
                            titleColor: '#94a3b8',
                            bodyColor: '#f8fafc',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            padding: 12,
                            cornerRadius: 8,
                            callbacks: {
                                label: () => null,
                                title: (items) => new Date(items[0].parsed.x).toLocaleString(),
                                afterBody: (items) => {
                                    const item = data[items[0].dataIndex];
                                    return [
                                        '',
                                        'Download: ' + item.download + ' Mbps',
                                        'Upload: ' + item.upload + ' Mbps',
                                        'Ping: ' + item.ping + ' ms',
                                        'Jitter: ' + item.jitter + ' ms'
                                    ];
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: { 
                                tooltipFormat: 'PPp',
                                displayFormats: { 
                                    hour: 'HH:mm', 
                                    day: 'MMM d',
                                    week: 'MMM d'
                                }
                            },
                            grid: { display: false },
                            ticks: { 
                                color: '#64748b', 
                                font: { size: 10 }, 
                                maxRotation: 0,
                                autoSkip: true,
                                maxTicksLimit: 12
                            }
                        },
                        y: { 
                            position: 'left', 
                            grid: { color: 'rgba(255,255,255,0.03)' },
                            title: { display: true, text: 'DOWN (MBPS)', color: '#38bdf8', font: { size: 10, weight: 600 } }, 
                            ticks: { color: '#64748b' } 
                        },
                        y1: { 
                            position: 'right', 
                            grid: { display: false },
                            title: { display: true, text: 'UP (MBPS)', color: '#fbbf24', font: { size: 10, weight: 600 } }, 
                            ticks: { color: '#64748b' } 
                        }
                    }
                }
            });
        }
        document.addEventListener('DOMContentLoaded', initDashboard);
    </script>
</body>
</html>`;

    const outputPath = path.join(__dirname, 'index.html');
    fs.writeFileSync(outputPath, htmlContent);
    console.log('Interactive dashboard generated: ' + outputPath);
}

if (require.main === module) {
    generateGraph().catch(err => {
        console.error('HTML generation failed:', err);
        process.exit(1);
    });
}

module.exports = { generateGraph };
