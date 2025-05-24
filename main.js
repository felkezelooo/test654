// Initial console logs
console.log('MAIN.JS: Script execution started.');
console.log(`MAIN.JS: Node.js version: ${process.version}`);

const ApifyModule = require('apify');
const playwright = require('playwright');
const { v4: uuidv4 } = require('uuid');

const ANTI_DETECTION_ARGS = [
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process,ImprovedCookieControls,LazyFrameLoading,GlobalMediaControls,DestroyProfileOnBrowserClose,MediaRouter,DialMediaRouteProvider,AcceptCHFrame,AutoExpandDetailsElement,CertificateTransparencyEnforcement,AvoidUnnecessaryBeforeUnloadCheckSync,Translate',
    '--disable-component-extensions-with-background-pages',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-site-isolation-trials',
    '--disable-sync',
    '--force-webrtc-ip-handling-policy=default_public_interface_only',
    '--no-first-run',
    '--no-service-autorun',
    '--password-store=basic',
    '--use-mock-keychain',
    '--enable-precise-memory-info',
    '--window-size=1920,1080',
    '--disable-infobars',
    '--disable-notifications',
    '--disable-popup-blocking',
    '--disable-dev-shm-usage', 
    '--no-sandbox', 
    '--disable-gpu',
    '--disable-setuid-sandbox',
    '--disable-software-rasterizer',
    '--mute-audio',
    '--ignore-certificate-errors',
];

let GlobalLogger; 

async function applyAntiDetectionScripts(pageOrContext) {
    const script = () => { /* ... (same as before) ... */ };
    if (pageOrContext.addInitScript) await pageOrContext.addInitScript(script);
    else await pageOrContext.evaluateOnNewDocument(script);
}

function extractVideoId(url) {
    try { /* ... (same as before) ... */ } catch (error) {
        (GlobalLogger || console).error(`Error extracting video ID from URL ${url}: ${error.message}`);
    }
    return null;
}

async function getVideoDuration(page) {
    (GlobalLogger || console).info('Attempting to get video duration.');
    for (let i = 0; i < 15; i++) { /* ... (same as before) ... */ }
    (GlobalLogger || console).warning('Could not determine video duration after 15 seconds.');
    return null;
}

async function clickIfExists(page, selector, timeout = 3000) {
    try { /* ... (same as before) ... */ } catch (e) {
        (GlobalLogger || console).debug(`Selector not found/clickable: ${selector} - Error: ${e.message.split('\n')[0]}`);
        return false;
    }
}

async function handleAds(page, platform, effectiveInput) {
    (GlobalLogger || console).info('Starting ad handling logic.');
    // ... (ad handling logic remains the same as previous correct version)
    (GlobalLogger || console).info('Ad handling finished or timed out.');
}

async function watchVideoOnPage(page, job, effectiveInput) { 
    const jobResult = { /* ... as before ... */ log: [] };
    const logEntry = (msg, level = 'info') => { /* ... as before ... */ };
    try { /* ... (video watching logic same as before) ... */ } catch (e) {
        logEntry(`Error watching video ${job.url}: ${e.message}`, 'error');
        jobResult.status = 'failure';
        jobResult.error = e.message + (e.stack ? `\nStack: ${e.stack}` : '');
    } finally {
        jobResult.endTime = new Date().toISOString();
    }
    return jobResult;
}

async function runSingleJob(job, effectiveInput, actorProxyConfiguration, customProxyPool) {
    const jobScopedLogger = {
        info: (msg) => (GlobalLogger || console).info(`[Job ${job.id.substring(0,6)}] ${msg}`),
        warning: (msg) => (GlobalLogger || console).warning(`[Job ${job.id.substring(0,6)}] ${msg}`),
        error: (msg, data) => (GlobalLogger || console).error(`[Job ${job.id.substring(0,6)}] ${msg}`, data),
        debug: (msg) => (GlobalLogger || console).debug(`[Job ${job.id.substring(0,6)}] ${msg}`),
    };
    jobScopedLogger.info(`Starting job for URL: ${job.url}`);
    let browser;
    let context;
    let page;
    let proxyUrlToUse = null;
    const jobResult = {
        jobId: job.id, url: job.url, videoId: job.videoId, platform: job.platform,
        proxyUsed: 'None', status: 'initiated', error: null, log: []
    };
    const logEntry = (msg, level = 'info') => {
        const tsMsg = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`;
        jobScopedLogger[level](msg);
        jobResult.log.push(tsMsg);
    };

    try {
        const launchOptions = { headless: effectiveInput.headless, args: [...ANTI_DETECTION_ARGS] };
        if (effectiveInput.useProxies) {
            if (customProxyPool && customProxyPool.length > 0) {
                proxyUrlToUse = customProxyPool[Math.floor(Math.random() * customProxyPool.length)];
                logEntry(`Using custom proxy: ${proxyUrlToUse.split('@')[0]}`);
                launchOptions.proxy = { server: proxyUrlToUse };
                jobResult.proxyUsed = `Custom: ${proxyUrlToUse.split('@')[1] || proxyUrlToUse.split('//')[1] || 'details hidden'}`;
            } else if (actorProxyConfiguration) {
                const sessionId = uuidv4().replace(/-/g, '');
                try {
                    proxyUrlToUse = await actorProxyConfiguration.newUrl(sessionId);
                    const proxyIp = proxyUrlToUse ? proxyUrlToUse.split('@').pop().split(':')[0] : 'N/A'; // Extract IP
                    logEntry(`Using Apify proxy (Session: ${sessionId}, IP: ${proxyIp})`);
                    launchOptions.proxy = { server: proxyUrlToUse };
                    jobResult.proxyUsed = `ApifyProxy (${proxyIp})`;
                } catch (proxyError) {
                    logEntry(`Failed to get Apify proxy URL: ${proxyError.message}`, 'error');
                    throw new Error(`Apify Proxy acquisition failed: ${proxyError.message}`);
                }
            } else {
                logEntry('No proxies configured. Running directly.', 'warn');
            }
        }
        
        logEntry('Attempting to launch browser...');
        if (ApifyModule.Actor.isAtHome() && ApifyModule.Actor.launchPlaywright && typeof ApifyModule.Actor.launchPlaywright === 'function') {
            logEntry('Using ApifyModule.Actor.launchPlaywright.');
            browser = await ApifyModule.Actor.launchPlaywright(launchOptions);
        } else {
            logEntry('Not on Apify platform or ApifyModule.Actor.launchPlaywright not available. Using playwright.chromium.launch directly.');
            browser = await playwright.chromium.launch(launchOptions);
        }
        logEntry('Browser launched.');
        
        context = await browser.newContext({
            bypassCSP: true, ignoreHTTPSErrors: true,
            viewport: { width: 1280 + Math.floor(Math.random() * 200), height: 720 + Math.floor(Math.random() * 100) },
            locale: 'en-US', timezoneId: 'America/New_York', javaScriptEnabled: true,
        });
        await applyAntiDetectionScripts(context);
        page = await context.newPage();
        await page.setViewportSize({ width: 1200 + Math.floor(Math.random()*120), height: 700 + Math.floor(Math.random()*80) });

        // Try 'commit' and then wait for body. 'domcontentloaded' might still be too slow with problematic proxies/pages.
        logEntry(`Navigating to ${job.url} with waitUntil: 'commit' (timeout ${effectiveInput.timeout}s).`);
        await page.goto(job.url, { timeout: effectiveInput.timeout * 1000, waitUntil: 'commit' });
        logEntry(`Initial navigation to ${job.url} (commit) complete.`);

        logEntry('Waiting for body element to be present (15s)...');
        await page.waitForSelector('body', { state: 'attached', timeout: 15000 });
        logEntry('Body element is present.');


        // Attempt to handle cookie consent popups
        if (job.platform === 'youtube') {
            // ... (consent handling logic as before, ensure it uses logEntry)
        }
        
        const playerSelector = job.platform === 'youtube' ? '#movie_player video.html5-main-video, ytd-player video' : '.rumble-player-video-wrapper video, video.rumble-player';
        try {
            logEntry(`Waiting for player element (${playerSelector}) to be visible (60s).`);
            await page.waitForSelector(playerSelector, { state: 'visible', timeout: 60000 });
            logEntry(`Player element (${playerSelector}) is visible.`);
        } catch (videoWaitError) {
            logEntry(`Player element (${playerSelector}) not visible within 60s: ${videoWaitError.message}`, 'error');
            // Screenshot and page info already here from previous version, which is good.
            throw new Error(`Player element not visible after 60s: ${videoWaitError.message}`);
        }

        const watchResult = await watchVideoOnPage(page, job, effectiveInput);
        Object.assign(jobResult, watchResult);

    } catch (e) {
        logEntry(`Critical error in job ${job.url}: ${e.message}\n${e.stack}`, 'error');
        jobResult.status = 'failure';
        jobResult.error = e.message + (e.stack ? `\nStack: ${e.stack}` : '');
        // Take screenshot on any critical error within runSingleJob if page exists
        if (page && ApifyModule.Actor.isAtHome()) { // Check if running on Apify to use Actor.setValue
            try {
                const screenshotBuffer = await page.screenshot({fullPage: true, timeout: 10000});
                const key = `SCREENSHOT_ERROR_${job.id.replace(/-/g,'')}`;
                await ApifyModule.Actor.setValue(key, screenshotBuffer, { contentType: 'image/png' });
                logEntry(`Screenshot taken on error: ${key}`);
            } catch (screenshotError) {
                logEntry(`Failed to take screenshot on error: ${screenshotError.message}`, 'warn');
            }
        }
    } finally {
        if (page && !page.isClosed()) await page.close().catch(e => jobScopedLogger.debug(`Error closing page: ${e.message}`));
        if (context) await context.close().catch(e => jobScopedLogger.debug(`Error closing context: ${e.message}`));
        if (browser) await browser.close().catch(e => jobScopedLogger.warning(`Error closing browser: ${e.message}`));
        jobScopedLogger.info(`Finished job for ${job.url} with status: ${jobResult.status}`);
    }
    return jobResult;
}

async function actorMainLogic() {
    console.log('ACTOR_MAIN_LOGIC: Entered main logic function.');
    await ApifyModule.Actor.init();
    console.log('ACTOR_MAIN_LOGIC: Actor.init() completed.');
    
    // Simplified GlobalLogger initialization
    GlobalLogger = (ApifyModule.Actor.log && typeof ApifyModule.Actor.log.info === 'function') 
        ? ApifyModule.Actor.log 
        : (ApifyModule.utils && ApifyModule.utils.log && typeof ApifyModule.utils.log.info === 'function' 
            ? ApifyModule.utils.log 
            : { 
                info: (message, data) => console.log(`CONSOLE_INFO: ${message}`, data || ''),
                warning: (message, data) => console.warn(`CONSOLE_WARN: ${message}`, data || ''),
                error: (message, data) => console.error(`CONSOLE_ERROR: ${message}`, data || ''),
                debug: (message, data) => console.log(`CONSOLE_DEBUG: ${message}`, data || ''),
              });
    if (GlobalLogger === console) { // Check if it fell back
        console.error('ACTOR_MAIN_LOGIC: Using console for logging as Apify loggers were not available.');
    } else {
        console.log('ACTOR_MAIN_LOGIC: Successfully assigned Apify logger to GlobalLogger.');
    }
    
    GlobalLogger.info('Starting YouTube & Rumble View Bot Actor (Apify SDK v3 compatible).');

    const input = await ApifyModule.Actor.getInput();
    GlobalLogger.info('Actor input:', input || 'No input received, using defaults.');
    // ... (rest of effectiveInput and job creation logic as before)
    const defaultInput = { /* ... as before ... */ };
    const effectiveInput = { /* ... as before ... */ };
    if (!effectiveInput.videoUrls || effectiveInput.videoUrls.length === 0) { /* ... as before ... */ }
    GlobalLogger.info('Effective input settings:', effectiveInput);
    let actorProxyConfiguration = null;
    if (effectiveInput.useProxies && (!effectiveInput.proxyUrls || effectiveInput.proxyUrls.length === 0)) { /* ... as before ... */ }
    const jobs = effectiveInput.videoUrls.map(url => { /* ... as before ... */ }).filter(job => job !== null);
    if (jobs.length === 0) { /* ... as before ... */ }
    GlobalLogger.info(`Created ${jobs.length} valid jobs.`);
    const overallResults = { /* ... as before ... */ };

    const activeWorkers = new Set();
    for (let i = 0; i < jobs.length; i++) {
        // ... (concurrency and capacity logic as before) ...
        const job = jobs[i]; // Ensure job is defined in this scope
        if (effectiveInput.stopSpawningOnOverload && typeof ApifyModule.Actor.isAtCapacity === 'function' && await ApifyModule.Actor.isAtCapacity()) { /* ... */ break; }
        while (activeWorkers.size >= effectiveInput.concurrency) { /* ... */ await Promise.race(Array.from(activeWorkers)); }
        
        const jobPromise = runSingleJob(job, effectiveInput, actorProxyConfiguration, effectiveInput.proxyUrls)
            .then(async (result) => { /* ... as before ... */ })
            .catch(async (error) => { /* ... as before ... */ })
            .finally(() => { /* ... as before ... */ });
        activeWorkers.add(jobPromise);
        GlobalLogger.info(`Job ${job.id.substring(0,6)} (${i + 1}/${jobs.length}) dispatched. Active: ${activeWorkers.size}`);
        if (effectiveInput.concurrencyInterval > 0 && i < jobs.length - 1 && activeWorkers.size < effectiveInput.concurrency) { /* ... */ }
    }
    GlobalLogger.info(`All jobs dispatched. Waiting for ${activeWorkers.size} to complete...`);
    await Promise.all(Array.from(activeWorkers));
    overallResults.endTime = new Date().toISOString();
    GlobalLogger.info('All jobs processed. Final results:', overallResults);
    if (ApifyModule.Actor.setValue) await ApifyModule.Actor.setValue('RESULTS', overallResults);
    if (ApifyModule.Actor.exit) await ApifyModule.Actor.exit(); else process.exit(0);
}

if (ApifyModule.Actor && typeof ApifyModule.Actor.main === 'function') {
    ApifyModule.Actor.main(actorMainLogic);
} else {
    console.error('CRITICAL: Apify.Actor.main is not defined. Running actorMainLogic directly.');
    actorMainLogic().catch(err => {
        console.error('CRITICAL: Error in direct actorMainLogic execution:', err);
        process.exit(1);
    });
}
console.log('MAIN.JS: Script fully loaded and main execution path determined.');
