const verificationService = require('./verifyUser');
const { updateRoles } = require('./roleManager');

const CHECK_INTERVAL = 5 * 60 * 1000;
const INITIAL_DELAY = 30 * 1000;

let client = null;
let intervalId = null;
let isRunning = false;

function startScheduler(discordClient) {
    if (isRunning) {
        console.log('⚠️ Scheduler is already running');
        return;
    }

    client = discordClient;
    isRunning = true;

    console.log(`⏰ Starting verification scheduler (first check in ${INITIAL_DELAY/1000}s, then every ${CHECK_INTERVAL/1000/60} minutes)...`);

    setTimeout(() => {
        runVerificationCheck();
        
        intervalId = setInterval(runVerificationCheck, CHECK_INTERVAL);
    }, INITIAL_DELAY);
}

function stopScheduler() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
    
    isRunning = false;
    console.log('⏰ Verification scheduler stopped');
}

async function runVerificationCheck() {
    if (!isRunning) return;

    const startTime = Date.now();
    
    try {
        console.log('🔄 Running scheduled verification check...');

        await verificationService.updateVerifications(process.env.GUILD_ID);

        if (client) {
            await updateRoles(client);
        }

        const duration = Date.now() - startTime;
        console.log(`✅ Scheduled verification check completed in ${duration}ms`);

    } catch (error) {
        console.error('❌ Error in scheduled verification check:', error);
        
        if (error.response) {
            console.error('📡 API Response:', error.response.status, error.response.statusText);
        }
    }
}

function getSchedulerStatus() {
    const nextCheck = intervalId ? new Date(Date.now() + CHECK_INTERVAL).toLocaleTimeString() : 'Not running';
    
    return {
        running: isRunning,
        interval: CHECK_INTERVAL / 1000 / 60, 
        nextCheck: nextCheck,
        started: isRunning ? new Date().toLocaleString() : 'Not started'
    };
}

process.on('SIGINT', async () => {
    console.log('🛑 Received SIGINT, stopping scheduler...');
    stopScheduler();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 Received SIGTERM, stopping scheduler...');
    stopScheduler();
    process.exit(0);
});

module.exports = {
    startScheduler,
    stopScheduler,
    runVerificationCheck,
    getSchedulerStatus,
    forceVerificationCheck: runVerificationCheck
};