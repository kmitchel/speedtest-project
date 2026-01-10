const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

async function fetchSignalData() {
    try {
        const response = await fetch('http://192.168.12.1/TMI/v1/gateway?get=signal', { signal: AbortSignal.timeout(5000) });
        if (!response.ok) return null;
        const data = await response.json();
        return {
            sinr4g: data.signal?.['4g']?.sinr ?? null,
            sinr5g: data.signal?.['5g']?.sinr ?? null
        };
    } catch (e) {
        return null;
    }
}

async function runSpeedTest(count = 1) {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1920,1080',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        ]
    });
    const newResults = [];

    for (let i = 0; i < count; i++) {
        console.log(`${new Date().toLocaleTimeString()} - Starting test ${i + 1} of ${count}...`);
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        try {
            // Fetch signal data in parallel with starting the speed test
            const signalTask = fetchSignalData();

            await page.goto('https://openspeedtest.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForSelector('#startButtonDesk', { visible: true, timeout: 30000 });

            await page.evaluate(() => {
                const btn = document.querySelector('#startButtonDesk');
                if (btn) {
                    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                } else {
                    throw new Error('Start button not found');
                }
            });

            await page.waitForFunction(() => {
                const down = document.querySelector('#downResult')?.textContent.trim();
                const up = document.querySelector('#upResultC2')?.textContent.trim();
                return down && down !== '---' && up && up !== '---' && !isNaN(parseFloat(down)) && !isNaN(parseFloat(up));
            }, { timeout: 120000, polling: 1000 });

            const speedData = await page.evaluate(() => {
                return {
                    download: parseFloat(document.querySelector('#downResult').textContent),
                    upload: parseFloat(document.querySelector('#upResultC2').textContent),
                    ping: parseFloat(document.querySelector('#pingResult').textContent),
                    jitter: parseFloat(document.querySelector('#jitterResultC3').textContent)
                };
            });

            const signalData = await signalTask;
            const data = {
                ...speedData,
                ...signalData,
                timestamp: new Date().toISOString()
            };

            console.log(`Test ${i + 1} results:`, data);
            newResults.push(data);
        } catch (err) {
            console.error(`Test ${i + 1} failed:`, err.message);
        } finally {
            await page.close();
        }

        if (i < count - 1) {
            await new Promise(r => setTimeout(r, 5000));
        }
    }

    await browser.close();

    if (newResults.length > 0) {
        const dbPath = path.join(__dirname, 'speedtest.db');
        const db = new sqlite3.Database(dbPath);

        db.serialize(() => {
            // Create table if it doesn't exist
            db.run(`CREATE TABLE IF NOT EXISTS results (
                timestamp TEXT,
                download REAL,
                upload REAL,
                ping REAL,
                jitter REAL,
                sinr4g REAL,
                sinr5g REAL
            )`);

            const stmt = db.prepare(`INSERT INTO results (timestamp, download, upload, ping, jitter, sinr4g, sinr5g) VALUES (?, ?, ?, ?, ?, ?, ?)`);

            db.run("BEGIN TRANSACTION");
            newResults.forEach(row => {
                stmt.run(
                    row.timestamp,
                    row.download,
                    row.upload,
                    row.ping,
                    row.jitter,
                    row.sinr4g ?? null,
                    row.sinr5g ?? null
                );
            });
            db.run("COMMIT", (err) => {
                if (err) console.error('Error saving to DB:', err);
                else console.log(`Database updated. Added ${newResults.length} records.`);
                db.close();
            });
            stmt.finalize();
        });
    }

    return newResults;
}

if (require.main === module) {
    const count = parseInt(process.argv[2]) || 1;
    runSpeedTest(count).catch(err => {
        console.error('Speedtest script aborted:', err);
        process.exit(1);
    });
}

module.exports = { runSpeedTest };
