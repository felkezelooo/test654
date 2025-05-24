// Initial console logs
console.log('MAIN.JS: Script execution started.');
console.log(`MAIN.JS: Node.js version: ${process.version}`);

const ApifyModule = require('apify');
const playwright = require('playwright');
const { v4: uuidv4 } = require('uuid');

const ANTI_DETECTION_ARGS = [ /* ... as before ... */ ];
let GlobalLogger; 

async function applyAntiDetectionScripts(pageOrContext) { /* ... as before ... */ }
function extractVideoId(url) { /* ... as before ... */ }
async function getVideoDuration(page, loggerToUse = GlobalLogger) { /* ... as before ... */ }
async function clickIfExists(page, selector, timeout = 3000, loggerToUse = GlobalLogger) { /* ... as before ... */ }
async function handleAds(page, platform, effectiveInput, loggerToUse = GlobalLogger) { /* ... as before ... */ }
async function watchVideoOnPage(page, job, effectiveInput, loggerToUse = GlobalLogger) { /* ... (ensure it uses loggerToUse or GlobalLogger) ... */ }
async function runSingleJob(job, effectiveInput, actorProxyConfiguration, customProxyPool, logger) { /* ... (ensure it uses passed logger) ... */ }

// --- Start of unchanged helper functions (ensure they use GlobalLogger or passed logger) ---
// For brevity, these are not repeated but should be the same as the previous full correct version.
// Make sure they are defined before actorMainLogic or passed around correctly.
async function applyAntiDetectionScripts(pageOrContext) {
    const script = () => {
        if (navigator.webdriver === true) Object.defineProperty(navigator, 'webdriver', { get: () => false });
        if (navigator.languages && !navigator.languages.includes('en-US')) Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        if (navigator.language !== 'en-US') Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
        try { /* WebGL Spoof */ } catch (e) { (GlobalLogger || console).debug('Failed WebGL spoof:', e.message); }
        try { /* Canvas Spoof */ } catch (e) { (GlobalLogger || console).debug('Failed Canvas spoof:', e.message); }
        if (navigator.permissions && typeof navigator.permissions.query === 'function') { /* Permissions Spoof */ }
        if (window.screen) { try { /* Screen Spoof */ } catch (e) { (GlobalLogger || console).debug('Failed screen spoof:', e.message); } }
        try { Date.prototype.getTimezoneOffset = function() { return 5 * 60; }; } catch (e) { (GlobalLogger || console).debug('Failed timezone spoof:', e.message); }
        if (navigator.plugins) try { Object.defineProperty(navigator, 'plugins', { get: () => [], configurable: true }); } catch(e) { (GlobalLogger || console).debug('Failed plugin spoof:', e.message); }
        if (navigator.mimeTypes) try { Object.defineProperty(navigator, 'mimeTypes', { get: () => [], configurable: true }); } catch(e) { (GlobalLogger || console).debug('Failed mimeType spoof:', e.message); }
    };
    if (pageOrContext.addInitScript) await pageOrContext.addInitScript(script);
    else await pageOrContext.evaluateOnNewDocument(script);
}

function extractVideoId(url) {
    try {
        const urlObj = new URL(url);
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return urlObj.searchParams.get('v') || urlObj.pathname.substring(1);
        } else if (url.includes('rumble.com')) {
            const pathParts = urlObj.pathname.split('/');
            const lastPart = pathParts[pathParts.length - 1];
            return lastPart.split('-')[0] || lastPart;
        }
    } catch (error) {
        (GlobalLogger || console).error(`Error extracting video ID from URL ${url}: ${error.message}`);
    }
    return null;
}

async function getVideoDuration(page, loggerToUse = GlobalLogger) { 
    (loggerToUse || console).info('Attempting to get video duration.');
    for (let i = 0; i < 15; i++) {
        try {
            const duration = await page.evaluate(() => {
                const video = document.querySelector('video.html5-main-video, video.rumble-player-video');
                return video ? video.duration : null;
            });
            if (duration && duration !== Infinity && duration > 0) {
                (loggerToUse || console).info(`Video duration found: ${duration} seconds.`);
                return duration;
            }
        } catch (e) {
            (loggerToUse || console).debug(`Attempt ${i+1} to get duration failed: ${e.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    (loggerToUse || console).warning('Could not determine video duration after 15 seconds.');
    return null;
}

async function clickIfExists(page, selector, timeout = 3000, loggerToUse = GlobalLogger) { 
    try {
        const element = page.locator(selector).first();
        await element.waitFor({ state: 'visible', timeout });
        await element.click({ timeout: timeout / 2, force: false, noWaitAfter: false });
        (loggerToUse || console).info(`Clicked on selector: ${selector}`);
        return true;
    } catch (e) {
        (loggerToUse || console).debug(`Selector not found/clickable: ${selector} - Error: ${e.message.split('\n')[0]}`);
        return false;
    }
}

async function handleAds(page, platform, effectiveInput, loggerToUse = GlobalLogger) { 
    (loggerToUse || console).info('Starting ad handling logic.');
    const adCheckInterval = 3000;
    let adWatchLoop = 0;
    const maxAdLoopIterations = Math.ceil((effectiveInput.maxSecondsAds * 1000) / adCheckInterval) + 5;

    for (adWatchLoop = 0; adWatchLoop < maxAdLoopIterations; adWatchLoop++) {
        let isAdPlaying = false; let canSkip = false; let adCurrentTime = adWatchLoop * (adCheckInterval / 1000);
        if (platform === 'youtube') {
            isAdPlaying = await page.locator('.ytp-ad-player-overlay-instream-info, .video-ads .ad-showing').count() > 0;
            if (isAdPlaying) { (loggerToUse || console).info('YouTube ad detected.'); canSkip = await page.locator('.ytp-ad-skip-button-modern, .ytp-ad-skip-button').count() > 0; }
        } else if (platform === 'rumble') {
            isAdPlaying = await page.locator('.video-ad-indicator, .ima-ad-container :not([style*="display: none"]):not([style*="visibility: hidden"])').count() > 0;
             if (isAdPlaying) { (loggerToUse || console).info('Rumble ad detected.'); canSkip = await page.locator('button[aria-label*="Skip Ad"], div[class*="skip-button"], .videoAdUiSkipButton').count() > 0; }
        }
        if (!isAdPlaying) { (loggerToUse || console).info('No ad currently playing or ad finished.'); break; }
        const minSkipTime = Array.isArray(effectiveInput.skipAdsAfter) && effectiveInput.skipAdsAfter.length > 0 ? parseInt(effectiveInput.skipAdsAfter[0],10) : 5;
        if (effectiveInput.autoSkipAds && canSkip) {
            (loggerToUse || console).info('Attempting to skip ad (autoSkipAds).');
            await clickIfExists(page, '.ytp-ad-skip-button-modern, .ytp-ad-skip-button, button[aria-label*="Skip Ad"], div[class*="skip-button"], .videoAdUiSkipButton', 1000, loggerToUse);
            await page.waitForTimeout(2000 + Math.random() * 1000); continue;
        }
        if (adCurrentTime >= minSkipTime && canSkip) {
            (loggerToUse || console).info(`Ad has played for ~${adCurrentTime.toFixed(1)}s, attempting to skip (skipAdsAfter).`);
            await clickIfExists(page, '.ytp-ad-skip-button-modern, .ytp-ad-skip-button, button[aria-label*="Skip Ad"], div[class*="skip-button"], .videoAdUiSkipButton', 1000, loggerToUse);
            await page.waitForTimeout(2000 + Math.random() * 1000); continue;
        }
        if (adCurrentTime >= effectiveInput.maxSecondsAds) {
             (loggerToUse || console).info(`Ad has played for ~${adCurrentTime.toFixed(1)}s (maxSecondsAds reached).`);
             if (canSkip) await clickIfExists(page, '.ytp-ad-skip-button-modern, .ytp-ad-skip-button, button[aria-label*="Skip Ad"], div[class*="skip-button"], .videoAdUiSkipButton', 1000, loggerToUse);
             else (loggerToUse || console).info('Max ad watch time reached, but cannot skip yet.');
             break; 
        }
        await page.waitForTimeout(adCheckInterval);
    }
    if (adWatchLoop >= maxAdLoopIterations) (loggerToUse || console).warning('Max ad loop iterations reached.');
    (loggerToUse || console).info('Ad handling finished or timed out.');
}

async function watchVideoOnPage(page, job, effectiveInput, loggerToUse = GlobalLogger) { 
    const jobResult = { /* ... as before ... */ log: [] };
    const logEntry = (msg, level = 'info') => { /* ... as before, uses loggerToUse ... */ };
    try {
        logEntry('Handling initial ads.');
        await handleAds(page, job.platform, effectiveInput, loggerToUse);
        logEntry(`Attempting to play video: ${job.url}`);
        let playButtonSelectors = job.platform === 'youtube' 
            ? ['.ytp-large-play-button', '.ytp-play-button[aria-label*="Play"]', 'video.html5-main-video']
            : ['.rumbles-player-play-button', 'video.rumble-player-video'];
        
        let played = false;
        for (let attempt = 0; attempt < 3; attempt++) {
            for (const selector of playButtonSelectors) {
                if (await clickIfExists(page, selector, 2000, loggerToUse)) { played = true; logEntry(`Clicked play button: ${selector} on attempt ${attempt + 1}`); break; }
            }
            if (played) break;
            logEntry(`Play button click attempt ${attempt + 1} failed, checking if video is already playing or trying general video click.`);
            const isPaused = await page.evaluate(() => document.querySelector('video')?.paused);
            if (isPaused === false) { played = true; logEntry('Video appears to be already playing.'); break; }
            if(attempt < 2) await page.waitForTimeout(1000); 
        }

        if (!played) {
             logEntry('No specific play button worked or video not auto-playing, attempting to click video element directly.');
             await page.locator('video').first().click({timeout: 5000, force: true, trial: true}).catch(e => logEntry(`Failed to click video (trial): ${e.message}`, 'warn'));
             const isPausedAfterGeneralClick = await page.evaluate(() => document.querySelector('video')?.paused);
             if (isPausedAfterGeneralClick === false) logEntry('Video started playing after general video click.');
             else logEntry('Video still not playing after all attempts.', 'warn');
        }
        await page.evaluate(() => { const v = document.querySelector('video'); if(v) { v.muted=false; v.volume=0.05+Math.random()*0.1; }}).catch(e => logEntry(`Unmute/volume failed: ${e.message}`, 'debug'));
        const duration = await getVideoDuration(page, loggerToUse);
        if (!duration || duration <= 0) throw new Error('Could not determine valid video duration after multiple attempts.');
        jobResult.durationFoundSec = duration;
        const targetWatchTimeSec = Math.floor(duration * (effectiveInput.watchTimePercentage / 100));
        jobResult.watchTimeRequestedSec = targetWatchTimeSec;
        logEntry(`Target watch: ${targetWatchTimeSec.toFixed(2)}s of ${duration.toFixed(2)}s.`);
        if (targetWatchTimeSec <= 0) throw new Error(`Calculated target watch time ${targetWatchTimeSec}s is invalid.`);
        let currentActualWatchTime = 0;
        const watchIntervalMs = 5000;
        const maxWatchLoops = Math.ceil(targetWatchTimeSec / (watchIntervalMs / 1000)) + 12;
        for (let i = 0; i < maxWatchLoops; i++) {
            logEntry(`Watch loop ${i+1}/${maxWatchLoops}. Ads check.`);
            await handleAds(page, job.platform, effectiveInput, loggerToUse); 
            const videoState = await page.evaluate(() => { const v = document.querySelector('video'); return v ? { ct:v.currentTime, p:v.paused, e:v.ended, rs:v.readyState, ns:v.networkState } : null; }).catch(e => { logEntry(`Video state error: ${e.message}`, 'warn'); return null; });
            if (!videoState) throw new Error('Video element disappeared.');
            logEntry(`State: time=${videoState.ct?.toFixed(2)}, paused=${videoState.p}, ended=${videoState.e}, ready=${videoState.rs}, net=${videoState.ns}`);
            if (videoState.p && !videoState.e) {
                logEntry('Paused, trying to play.');
                for (const sel of playButtonSelectors) if (await clickIfExists(page, sel, 2000, loggerToUse)) break;
                await page.locator('video').first().click({timeout:2000, force: true, trial: true}).catch(e => logEntry(`Fallback click failed: ${e.message}`, 'debug'));
            }
            currentActualWatchTime = videoState.ct || 0;
            jobResult.watchTimeActualSec = currentActualWatchTime;
            if (currentActualWatchTime >= targetWatchTimeSec || videoState.e) { logEntry(`Target/end. Actual: ${currentActualWatchTime.toFixed(2)}s`); break; }
            if (i%6===0) { await page.mouse.move(Math.random()*500,Math.random()*300,{steps:5}).catch(()=>{}); logEntry('Mouse move.','debug');}
            await page.waitForTimeout(watchIntervalMs);
        }
        if (currentActualWatchTime < targetWatchTimeSec) logEntry(`Watched ${currentActualWatchTime.toFixed(2)}s < target ${targetWatchTimeSec.toFixed(2)}s.`, 'warn');
        jobResult.status = 'success';
    } catch (e) { /* ... */ } finally { /* ... */ }
    return jobResult;
}

async function runSingleJob(job, effectiveInput, actorProxyConfiguration, customProxyPool, logger) {
    const jobScopedLogger = { /* ... */ };
    jobScopedLogger.info(`Starting job for URL: ${job.url}`);
    let browser; let context; let page; let proxyUrlToUse = null;
    const jobResult = { /* ... */ };
    const logEntry = (msg, level = 'info') => { /* ... */ };

    try {
        const launchOptions = { /* ... */ };
        if (effectiveInput.useProxies) { /* ... (proxy setup as before, ensuring username/password are undefined if not present) ... */ }
        
        logEntry('Attempting to launch browser...');
        if (ApifyModule.Actor.isAtHome() && /* ... */ ) { /* ... */ } 
        else { browser = await playwright.chromium.launch(launchOptions); }
        logEntry('Browser launched.');
        
        context = await browser.newContext({ /* ... */ });
        await applyAntiDetectionScripts(context); // Pass context
        page = await context.newPage();
        await page.setViewportSize({ /* ... */ });

        logEntry(`Navigating to ${job.url} with waitUntil: 'domcontentloaded' (timeout ${effectiveInput.timeout}s).`);
        await page.goto(job.url, { timeout: effectiveInput.timeout * 1000, waitUntil: 'domcontentloaded' });
        logEntry(`Initial navigation to ${job.url} (domcontentloaded) complete.`);
        
        try { /* ... (networkidle wait as before) ... */ } 
        catch(e) { logEntry(`Network did not become idle: ${e.message.split('\n')[0]}. Proceeding.`, 'warn'); }

        if (job.platform === 'youtube') { /* ... (consent handling as before) ... */ }
        
        const playerSelector = job.platform === 'youtube' ? '#movie_player video.html5-main-video, ytd-player video' : '.rumble-player-video-wrapper video, video.rumble-player';
        try { /* ... (player wait as before, with screenshot) ... */ } 
        catch (videoWaitError) { /* ... (error handling with screenshot) ... */ throw videoWaitError; }

        const watchResult = await watchVideoOnPage(page, job, effectiveInput, logger); // Pass logger
        Object.assign(jobResult, watchResult);

    } catch (e) { /* ... (error handling with screenshot) ... */ } 
    finally { /* ... (cleanup as before) ... */ }
    return jobResult;
}
// --- End of runSingleJob and its helpers ---


async function actorMainLogic() {
    console.log('ACTOR_MAIN_LOGIC: Entered main logic function.');
    await ApifyModule.Actor.init();
    console.log('ACTOR_MAIN_LOGIC: Actor.init() completed.');
    
    if (ApifyModule.Actor.log && typeof ApifyModule.Actor.log.info === 'function') {
        console.log('ACTOR_MAIN_LOGIC: ApifyModule.Actor.log is available. Assigning to GlobalLogger.');
        GlobalLogger = ApifyModule.Actor.log;
    } else if (ApifyModule.utils && ApifyModule.utils.log && typeof ApifyModule.utils.log.info === 'function') {
        console.log('ACTOR_MAIN_LOGIC: ApifyModule.Actor.log not available, but ApifyModule.utils.log is. Assigning to GlobalLogger.');
        GlobalLogger = ApifyModule.utils.log;
    } else {
        console.error('ACTOR_MAIN_LOGIC: Neither ApifyModule.Actor.log nor ApifyModule.utils.log is available. Assigning console fallback for GlobalLogger.');
        GlobalLogger = { 
            info: (message, data) => console.log(`CONSOLE_INFO: ${message}`, data || ''),
            warning: (message, data) => console.warn(`CONSOLE_WARN: ${message}`, data || ''),
            error: (message, data) => console.error(`CONSOLE_ERROR: ${message}`, data || ''),
            debug: (message, data) => console.log(`CONSOLE_DEBUG: ${message}`, data || ''),
        };
    }
    
    GlobalLogger.info('Starting YouTube & Rumble View Bot Actor (Apify SDK v3 compatible).');

    const input = await ApifyModule.Actor.getInput();
    GlobalLogger.info('Actor input received.');
    GlobalLogger.debug('Raw input object:', input);

    const defaultInput = {
        videoUrls: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
        watchTimePercentage: 80,
        useProxies: true,
        proxyUrls: [],
        proxyCountry: null,
        proxyGroups: ['RESIDENTIAL'],
        headless: true,
        concurrency: 1,
        concurrencyInterval: 5,
        timeout: 120,
        maxSecondsAds: 15,
        skipAdsAfter: ["5", "10"], // Default as strings
        autoSkipAds: true,
        stopSpawningOnOverload: true,
        useAV1: true,
        disableProxyTests: false,
        enableEngagement: false,
        leaveComment: false,
        performLike: false,
        subscribeToChannel: false
    };

    const rawInput = input || {}; 
    const effectiveInput = {}; 

    // Iterate over defaultInput keys to ensure all are present in effectiveInput
    for (const key of Object.keys(defaultInput)) {
        if (rawInput.hasOwnProperty(key) && rawInput[key] !== undefined && rawInput[key] !== null) {
            // Special handling for arrays that need parsing or specific default logic
            if (key === 'videoUrls' || key === 'proxyUrls' || key === 'proxyGroups') {
                if (Array.isArray(rawInput[key]) && rawInput[key].length > 0) {
                    effectiveInput[key] = rawInput[key];
                } else if (key === 'proxyUrls' && Array.isArray(rawInput[key]) && rawInput[key].length === 0) {
                    effectiveInput[key] = []; // Allow empty custom proxyUrls from user
                } else { // Fallback to default if user provides empty array for non-emptyable fields, or invalid type
                    effectiveInput[key] = defaultInput[key];
                }
            } else if (key === 'skipAdsAfter') {
                 // Defer parsing skipAdsAfter until after this loop to use the correctly determined source (input or default)
                 effectiveInput[key] = rawInput[key]; // Temporarily assign, will parse below
            } else { // For all other types (booleans, numbers, strings)
                effectiveInput[key] = rawInput[key];
            }
        } else {
            // Key not in rawInput or is null/undefined, so use default
            effectiveInput[key] = defaultInput[key];
        }
    }

    // Now, parse skipAdsAfter based on what's in effectiveInput (either from user or default)
    let tempSkipAds = effectiveInput.skipAdsAfter; 
    if (Array.isArray(tempSkipAds) && tempSkipAds.every(s => typeof s === 'string' || typeof s === 'number')) {
        effectiveInput.skipAdsAfter = tempSkipAds.map(s => parseInt(String(s), 10)).filter(n => !isNaN(n));
        // If parsing resulted in an empty array (e.g. user input ["foo", "bar"]), and default had items, use parsed default
        if (effectiveInput.skipAdsAfter.length === 0 && defaultInput.skipAdsAfter.length > 0) {
            GlobalLogger.warning(`User provided 'skipAdsAfter' (${JSON.stringify(tempSkipAds)}) resulted in empty array after parsing. Using default.`);
            effectiveInput.skipAdsAfter = defaultInput.skipAdsAfter.map(s => parseInt(s,10));
        }
    } else { 
        GlobalLogger.warning(`Input 'skipAdsAfter' was not a valid array. Using default. Received: ${JSON.stringify(tempSkipAds)}`);
        effectiveInput.skipAdsAfter = defaultInput.skipAdsAfter.map(s => parseInt(s,10));
    }
    
    GlobalLogger.info('Effective input settings:', effectiveInput); // Log this *after* full construction


    if (!effectiveInput.videoUrls || !Array.isArray(effectiveInput.videoUrls) || effectiveInput.videoUrls.length === 0) {
        GlobalLogger.error('No video URLs provided or resolved after defaults. Exiting.');
        if (ApifyModule.Actor.fail) await ApifyModule.Actor.fail('Missing videoUrls in input.'); 
        return;
    }

    let actorProxyConfiguration = null;
    if (effectiveInput.useProxies && (!effectiveInput.proxyUrls || effectiveInput.proxyUrls.length === 0)) {
        const opts = { groups: effectiveInput.proxyGroups };
        if (effectiveInput.proxyCountry && effectiveInput.proxyCountry.trim() !== "") opts.countryCode = effectiveInput.proxyCountry;
        actorProxyConfiguration = await ApifyModule.Actor.createProxyConfiguration(opts);
        GlobalLogger.info(`Apify Proxy Configuration created. Country: ${effectiveInput.proxyCountry || 'Any'}`);
    } else if (effectiveInput.useProxies && effectiveInput.proxyUrls && effectiveInput.proxyUrls.length > 0) {
        GlobalLogger.info(`Using ${effectiveInput.proxyUrls.length} custom proxies.`);
    }

    const jobs = effectiveInput.videoUrls.map(url => {
        const videoId = extractVideoId(url);
        if (!videoId) { GlobalLogger.warning(`Invalid URL (no ID): ${url}. Skipping.`); return null; }
        const platform = url.includes('youtube.com')||url.includes('youtu.be') ? 'youtube' : (url.includes('rumble.com') ? 'rumble' : 'unknown');
        if (platform === 'unknown') { GlobalLogger.warning(`Unknown platform: ${url}. Skipping.`); return null; }
        return { id: uuidv4(), url, videoId, platform };
    }).filter(job => job !== null);

    if (jobs.length === 0) {
        GlobalLogger.error('No valid jobs after filtering. Exiting.');
        if (ApifyModule.Actor.fail) await ApifyModule.Actor.fail('No valid video URLs to process.'); 
        return;
    }
    GlobalLogger.info(`Created ${jobs.length} valid jobs to process.`);
    
    const overallResults = {
        totalJobs: jobs.length, successfulJobs: 0, failedJobs: 0,
        details: [], startTime: new Date().toISOString(), endTime: null,
    };

    const activeWorkers = new Set();
    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        if (effectiveInput.stopSpawningOnOverload && typeof ApifyModule.Actor.isAtCapacity === 'function' && await ApifyModule.Actor.isAtCapacity()) { /* ... */ break; }
        while (activeWorkers.size >= effectiveInput.concurrency) { /* ... */ await Promise.race(Array.from(activeWorkers)); }
        
        const jobPromise = runSingleJob(job, effectiveInput, actorProxyConfiguration, effectiveInput.proxyUrls, GlobalLogger)
            .then(async (result) => { /* ... */ })
            .catch(async (error) => { /* ... */ })
            .finally(() => { /* ... */ });
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
