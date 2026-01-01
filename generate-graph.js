const fs = require('fs');
const path = require('path');

async function generateGraph() {
    const resultsPath = path.join(__dirname, 'results.json');
    if (!fs.existsSync(resultsPath)) {
        console.error('results.json not found. Run speedtest.js first.');
        return;
    }

    const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

    // Inject data into the HTML template
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Network Speed Tracker</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: #1e293b;
            --text-main: #f8fafc;
            --text-dim: #94a3b8;
            --download-color: #38bdf8;
            --upload-color: #fbbf24;
            --sinr-color: #4ade80;
        }
        body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
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
            width: 95%;
            max-width: 1800px;
            height: calc(100vh - 4rem);
            background: var(--card-bg);
            padding: 2rem;
            border-radius: 1.5rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            margin: 2rem;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
        }
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            padding-bottom: 1rem;
            flex-shrink: 0;
        }
        h1 { margin: 0; font-weight: 300; font-size: 1.6rem; }
        .stats-summary { display: flex; gap: 1.5rem; }
        .stat-item { display: flex; flex-direction: column; align-items: flex-end; }
        .stat-label { font-size: 0.7rem; text-transform: uppercase; color: var(--text-dim); }
        .stat-value { font-size: 1.1rem; font-weight: 600; }
        .stat-value.download { color: var(--download-color); }
        .stat-value.upload { color: var(--upload-color); }
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
            font-size: 0.8rem;
            flex-shrink: 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Internet Speed Test</h1>
            <div class="stats-summary" id="currentStats"></div>
        </header>
        <div class="chart-wrapper">
            <canvas id="speedChart"></canvas>
        </div>
        <div class="footer" id="lastUpdated"></div>
    </div>
    <script>
        const speedData = ${JSON.stringify(data)};
        
        function initDashboard() {
            if (!speedData || speedData.length === 0) return;
            const lastTest = speedData[speedData.length - 1];
            
            document.getElementById('currentStats').innerHTML = \`
                <div class="stat-item">
                    <span class="stat-label">Latest Download</span>
                    <span class="stat-value download">\${lastTest.download} Mbps</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Latest Upload</span>
                    <span class="stat-value upload">\${lastTest.upload} Mbps</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Latest 5G SINR</span>
                    <span class="stat-value" style="color: var(--sinr-color)">\${lastTest.sinr5g ?? 'N/A'} dB</span>
                </div>
            \`;

            document.getElementById('lastUpdated').textContent = "Last updated: " + new Date(lastTest.timestamp).toLocaleString();

            // Custom positioner to keep tooltip at bottom left
            Chart.Tooltip.positioners.bottomLeft = function() {
                const chart = this.chart;
                return {
                    x: chart.chartArea.left + 30,
                    y: chart.chartArea.bottom - 10,
                    xAlign: 'left',
                    yAlign: 'bottom'
                };
            };

            const ctx = document.getElementById('speedChart').getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: speedData.map(d => new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
                    datasets: [
                        {
                            label: 'Download Speed',
                            data: speedData.map(d => d.download),
                            borderColor: '#38bdf8',
                            backgroundColor: 'rgba(56, 189, 248, 0.1)',
                            fill: true,
                            tension: 0,
                            borderWidth: 1.5,
                            yAxisID: 'y'
                        },
                        {
                            label: 'Upload Speed',
                            data: speedData.map(d => d.upload),
                            borderColor: '#fbbf24',
                            backgroundColor: 'rgba(251, 191, 36, 0.1)',
                            fill: true,
                            tension: 0,
                            borderWidth: 1.5,
                            yAxisID: 'y1'
                        },
                        {
                            label: '4G SINR',
                            data: speedData.map(d => d.sinr4g),
                            borderColor: '#4ade80',
                            borderDash: [5, 5],
                            fill: false,
                            tension: 0,
                            borderWidth: 1.5,
                            yAxisID: 'y2'
                        },
                        {
                            label: '5G SINR',
                            data: speedData.map(d => d.sinr5g),
                            borderColor: '#22c55e',
                            fill: false,
                            tension: 0,
                            borderWidth: 1.5,
                            yAxisID: 'y2'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { labels: { color: '#f8fafc' } },
                        tooltip: {
                            position: 'bottomLeft',
                            backgroundColor: '#1e293b',
                            titleColor: '#94a3b8',
                            bodyColor: '#f8fafc',
                            borderColor: 'rgba(255,255,255,0.1)',
                            borderWidth: 1,
                            padding: 12,
                            displayColors: true,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) { label += ': '; }
                                    if (context.parsed.y !== null) {
                                        const unit = label.includes('SINR') ? ' dB' : ' Mbps';
                                        label += context.parsed.y + unit;
                                    }
                                    return label;
                                },
                                title: function(context) {
                                    const index = context[0].dataIndex;
                                    return new Date(speedData[index].timestamp).toLocaleString();
                                },
                                afterBody: function(context) {
                                    const index = context[0].dataIndex;
                                    const item = speedData[index];
                                    return [
                                        'Ping: ' + item.ping + ' ms',
                                        'Jitter: ' + item.jitter + ' ms'
                                    ];
                                }
                            }
                        }
                    },
                    scales: {
                        x: { 
                            grid: { display: false }, 
                            ticks: { 
                                color: '#64748b',
                                autoSkip: true,
                                maxTicksLimit: 10
                            } 
                        },
                        y: { min: 0, position: 'left', title: { display: true, text: 'Download (Mbps)', color: '#38bdf8' }, ticks: { color: '#64748b' } },
                        y1: { min: 0, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Upload (Mbps)', color: '#fbbf24' }, ticks: { color: '#64748b' } },
                        y2: { min: -10, max: 40, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'SINR (dB)', color: '#4ade80' }, ticks: { color: '#64748b' } }
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
