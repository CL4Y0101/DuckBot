const { updateVerifications } = require('./verifyUser');
const { updateRoles } = require('./roleManager');

const CHECK_INTERVAL = 5 * 60 * 1000;

let client = null;
let intervalId = null;

function startScheduler(discordClient) {
    client = discordClient;

    console.log('⏰ Starting verification scheduler (every 5 minutes)...');

    runVerificationCheck();

    intervalId = setInterval(runVerificationCheck, CHECK_INTERVAL);
}

function stopScheduler() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        console.log('⏰ Verification scheduler stopped');
    }
}

async function runVerificationCheck() {
    try {
        console.log('🔄 Running scheduled verification check...');

        await updateVerifications();

        if (client) {
            await updateRoles(client);
        }

        console.log('✅ Scheduled verification check completed');

    } catch (error) {
        console.error('❌ Error in scheduled verification check:', error);
    }
}

function getSchedulerStatus() {
    return {
        running: intervalId !== null,
        interval: CHECK_INTERVAL / 1000 / 60,
        nextCheck: intervalId ? new Date(Date.now() + CHECK_INTERVAL).toISOString() : null
    };
}

module.exports = {
    startScheduler,
    stopScheduler,
    runVerificationCheck,
    getSchedulerStatus
};
