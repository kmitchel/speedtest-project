const { runSpeedTest } = require('./speedtest');
const { generateGraph } = require('./generate-graph');

const INTERVAL_MINUTES = 5;
const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000;

async function startApp() {
    console.log(`Speedtest Tracker started. Running every ${INTERVAL_MINUTES} minutes...`);

    while (true) {
        try {
            console.log(`\n--- Periodic Speedtest: ${new Date().toLocaleString()} ---`);
            await runSpeedTest(1);
            await generateGraph();
            console.log(`Next test in ${INTERVAL_MINUTES} minutes...`);
        } catch (error) {
            console.error('Error in main loop:', error);
        }

        // Wait for the next interval
        await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
    }
}

startApp().catch(err => {
    console.error('Critical app failure:', err);
    process.exit(1);
});
