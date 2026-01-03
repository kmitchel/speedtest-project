const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'speedtest.db');
const resultsPath = path.join(__dirname, 'results.json');

const db = new sqlite3.Database(dbPath);

console.log('Starting migration...');

db.serialize(() => {
    // initialize table
    db.run(`CREATE TABLE IF NOT EXISTS results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        download REAL,
        upload REAL,
        ping REAL,
        jitter REAL,
        sinr4g REAL,
        sinr5g REAL
    )`);

    // migrate data
    if (fs.existsSync(resultsPath)) {
        try {
            const fileContent = fs.readFileSync(resultsPath, 'utf8');
            const data = JSON.parse(fileContent);
            
            if (Array.isArray(data) && data.length > 0) {
                const stmt = db.prepare(`INSERT INTO results (timestamp, download, upload, ping, jitter, sinr4g, sinr5g) VALUES (?, ?, ?, ?, ?, ?, ?)`);

                db.run("BEGIN TRANSACTION");
                
                let count = 0;
                data.forEach(row => {
                    stmt.run(
                        row.timestamp, 
                        row.download, 
                        row.upload, 
                        row.ping, 
                        row.jitter, 
                        row.sinr4g ?? null, 
                        row.sinr5g ?? null
                    );
                    count++;
                });

                db.run("COMMIT");
                stmt.finalize();
                console.log(`Migrated ${count} records to SQLite.`);
            } else {
                console.log('results.json is empty or not an array.');
            }
        } catch (e) {
            console.error('Error reading/parsing results.json:', e);
        }
    } else {
        console.log('No results.json found to migrate.');
    }
});

db.close((err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Database connection closed.');
});
