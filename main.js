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
async function getVideoDuration(page) { /* ... as before ... */ }
async function clickIfExists(page, selector, timeout = 3000) { /* ... as before ... */ }
async function handleAds(page, platform, effectiveInput) { /* ... as before ... */ }
async function watchVideoOnPage(page, job, effectiveInput) { /* ... (same as previous correct version, ensure it uses GlobalLogger for its internal logs) ... */ }

// Corrected helper functions to use GlobalLogger (ensure it's passed or accessible)
async function getVideoDuration(page) { // Make sure GlobalLogger is accessible
    (GlobalLogger || console).info('Attempting to get video duration.');
    for (let i = 0; i < 15; i++) {
        try {
            const duration = await page.evaluate(() => {
                const video = document.querySelector('video.html5-main-video, video.rumble-player-video');
                return video ? video.duration : null;
            });
            if (duration && duration !== Infinity && duration > 0) {
                (GlobalLogger || console).info(`Video duration found: ${duration} seconds.`);
                return duration;
            }
        } catch (e) {
            (GlobalLogger || console).debug(`Attempt ${i+1} to get duration failed: ${e.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    (GlobalLogger || console).warning('Could not determine video duration after 15 seconds.');
    return null;
}

async function clickIfExists(page, selector, timeout = 3000) { // Make sure GlobalLogger is accessible
    try {
        const element = page.locator(selector).first();
        await element.waitFor({ state: 'visible', timeout });
        await element.click({ timeout: timeout / 2, force: false, noWaitAfter: false });
        (GlobalLogger || console).info(`Clicked on selector: ${selector}`);
        return true;
    } catch (e) {
        (GlobalLogger || console).debug(`Selector not found/clickable: ${selector} - Error: ${e.message.split('\n')[0]}`);
        return false;
    }
}

async function handleAds(page, platform, effectiveInput) { // Make sure GlobalLogger is accessible
    (GlobalLogger || console).info('Starting ad handling logic.');
    const adCheckInterval = 3000;
    let adWatchLoop = 0;
    const maxAdLoopIterations = Math.ceil((effectiveInput.maxSecondsAds * 1000) / adCheckInterval) + 5;

    for (adWatchLoop = 0; adWatchLoop < maxAdLoopIterations; adWatchLoop++) {
        let isAdPlaying = false;
        let canSkip = false;
        let adCurrentTime = adWatchLoop * (adCheckInterval / 1000); 

        if (platform === 'youtube') {
            isAdPlaying = await page.locator('.ytp-ad-player-overlay-instream-info, .video-ads .ad-showing').count() > 0;
            if (isAdPlaying) { (GlobalLogger || console).info('YouTube ad detected.'); canSkip = await page.locator('.ytp-ad-skip-button-modern, .ytp-ad-skip-button').count() > 0; }
        } else if (platform === 'rumble') {
            isAdPlaying = await page.locator('.video-ad-indicator, .ima-ad-container :not([style*="display: none"]):not([style*="visibility: hidden"])').count() > 0;
             if (isAdPlaying) { (GlobalLogger || console).info('Rumble ad detected.'); canSkip = await page.locator('button[aria-label*="Skip Ad"], div[class*="skip-button"], .videoAdUiSkipButton').count() > 0; }
        }
        if (!isAdPlaying) { (GlobalLogger || console).info('No ad currently playing or ad finished.'); break; }
        const minSkipTime = Array.isArray(effectiveInput.skipAdsAfter) && effectiveInput.skipAdsAfter.length > 0 ? parseInt(effectiveInput.skipAdsAfter[0],10) : 5;
        if (effectiveInput.autoSkipAds && canSkip) {
            (GlobalLogger || console).info('Attempting to skip ad (autoSkipAds).');
            await clickIfExists(page, '.ytp-ad-skip-button-modern, .ytp-ad-skip-button, button[aria-label*="Skip Ad"], div[class*="skip-button"], .videoAdUiSkipButton', 1000);
            await page.waitForTimeout(2000 + Math.random() * 1000); continue;
        }
        if (adCurrentTime >= minSkipTime && canSkip) {
            (GlobalLogger || console).info(`Ad has played for ~${adCurrentTime.toFixed(1)}s, attempting to skip (skipAdsAfter).`);
            await clickIfExists(page, '.ytp-ad-skip-button-modern, .ytp-ad-skip-button, button[aria-label*="Skip Ad"], div[class*="skip-button"], .videoAdUiSkipButton', 1000);
            await page.waitForTimeout(2000 + Math.random() * 1000); continue;
        }
        if (adCurrentTime >= effectiveInput.maxSecondsAds) {
             (GlobalLogger || console).info(`Ad has played for ~${adCurrentTime.toFixed(1)}s (maxSecondsAds reached).`);
             if (canSkip) await clickIfExists(page, '.ytp-ad-skip-button-modern, .ytp-ad-skip-button, button[aria-label*="Skip Ad"], div[class*="skip-button"], .videoAdUiSkipButton', 1000);
             else (GlobalLogger || console).info('Max ad watch time reached, but cannot skip yet.');
             break; 
        }
        await page.waitForTimeout(adCheckInterval);
    }
    if (adWatchLoop >= maxAdLoopIterations) (GlobalLogger || console).warning('Max ad loop iterations reached.');
    (GlobalLogger || console).info('Ad handling finished or timed out.');
}

async function watchVideoOnPage(page, job, effectiveInput) { 
    const jobResult = {
        jobId: job.id, url: job.url, videoId: job.videoId, platform: job.platform, status: 'pending',
        watchTimeRequestedSec: 0, watchTimeActualSec: 0, durationFoundSec: null,
        startTime: new Date().toISOString(), endTime: null, error: null, log: []
    };
    const logEntry = (msg, level = 'info') => {
        const formattedMessage = `[Job ${job.id.substring(0,6)}] ${msg}`;
        (GlobalLogger || console)[level](formattedMessage); 
        jobResult.log.push(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`);
    };

    try {
        logEntry('Handling initial ads.');
        await handleAds(page, job.platform, effectiveInput); // Pass job.platform
        logEntry(`Attempting to play video: ${job.url}`);
        let playButtonSelectors = job.platform === 'youtube' 
            ? ['.ytp-large-play-button', '.ytp-play-button[aria-label*="Play"]', 'video.html5-main-video']
            : ['.rumbles-player-play-button', 'video.rumble-player-video'];
        
        let played = false;
        for (let attempt = 0; attempt < 3; attempt++) {
            for (const selector of playButtonSelectors) {
                if (await clickIfExists(page, selector, 2000)) { played = true; logEntry(`Clicked play button: ${selector} on attempt ${attempt + 1}`); break; }
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
             if (isPausedAfterGeneralClick === false) {
                logEntry('Video started playing after general video click.');
             } else {
                logEntry('Video still not playing after all attempts.', 'warn');
             }
        }
        
        await page.evaluate(() => { const v = document.querySelector('video'); if(v) { v.muted=false; v.volume=0.05+Math.random()*0.1; }}).catch(e => logEntry(`Unmute/volume failed: ${e.message}`, 'debug'));

        const duration = await getVideoDuration(page);
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
            await handleAds(page, job.platform, effectiveInput); // Pass job.platform
            const videoState = await page.evaluate(() => { const v = document.querySelector('video'); return v ? { ct:v.currentTime, p:v.paused, e:v.ended, rs:v.readyState, ns:v.networkState } : null; }).catch(e => { logEntry(`Video state error: ${e.message}`, 'warn'); return null; });
            if (!videoState) throw new Error('Video element disappeared.');
            logEntry(`State: time=${videoState.ct?.toFixed(2)}, paused=${videoState.p}, ended=${videoState.e}, ready=${videoState.rs}, net=${videoState.ns}`);
            if (videoState.p && !videoState.e) {
                logEntry('Paused, trying to play.');
                for (const sel of playButtonSelectors) if (await clickIfExists(page, sel, 2000)) break;
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
    } catch (e) {
        logEntry(`Error watching video ${job.url}: ${e.message}`, 'error');
        jobResult.status = 'failure';
        jobResult.error = e.message + (e.stack ? `\nStack: ${e.stack}` : '');
    } finally {
        jobResult.endTime = new Date().toISOString();
    }
    return jobResult;
}


// Pass GlobalLogger explicitly to runSingleJob
async function runSingleJob(job, effectiveInput, actorProxyConfiguration, customProxyPool, logger) {
    const jobScopedLogger = {
        info: (msg) => logger.info(`[Job ${job.id.substring(0,6)}] ${msg}`),
        warning: (msg) => logger.warning(`[Job ${job.id.substring(0,6)}] ${msg}`),
        error: (msg, data) => logger.error(`[Job ${job.id.substring(0,6)}] ${msg}`, data),
        debug: (msg) => logger.debug(`[Job ${job.id.substring(0,6)}] ${msg}`),
    };
    jobScopedLogger.info(`Starting job for URL: ${job.url}`); // This was the failing line (line 205 in previous logs)
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
                    const proxyIp = proxyUrlToUse ? proxyUrlToUse.split('@').pop().split(':')[0] : 'N/A';
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
        await applyAntiDetectionScripts(context); // Pass context
        page = await context.newPage();
        await page.setViewportSize({ width: 1200 + Math.floor(Math.random()*120), height: 700 + Math.floor(Math.random()*80) });

        logEntry(`Navigating to ${job.url} with waitUntil: 'domcontentloaded' (timeout ${effectiveInput.timeout}s).`);
        await page.goto(job.url, { timeout: effectiveInput.timeout * 1000, waitUntil: 'domcontentloaded' });
        logEntry(`Initial navigation to ${job.url} (domcontentloaded) complete.`);
        
        try {
            logEntry('Waiting for network idle (up to 30s)...');
            await page.waitForLoadState('networkidle', { timeout: 30000 });
            logEntry('Network is idle.');
        } catch(e) {
            logEntry(`Network did not become idle within 30s: ${e.message.split('\n')[0]}. Proceeding anyway.`, 'warn');
        }

        if (job.platform === 'youtube') {
            logEntry('Checking for YouTube consent dialog...');
            const consentFrameSelectors = ['iframe[src*="consent.google.com"]', 'iframe[src*="consent.youtube.com"]'];
            let consentFrame;
            for (const frameSelector of consentFrameSelectors) {
                const frameHandle = await page.waitForSelector(frameSelector, {timeout: 7000}).catch(() => null);
                if (frameHandle) {
                    consentFrame = await frameHandle.contentFrame();
                    if (consentFrame) { logEntry(`Consent iframe found with selector: ${frameSelector}`); break; }
                }
            }

            if (consentFrame) {
                logEntry('Consent iframe content frame obtained. Attempting to click "Accept all" or similar.');
                const acceptSelectors = [
                    'button[aria-label*="Accept all"]', 'button:has-text("Accept all")',
                    'button:has-text("Agree to all")', 'button[jsname*="LgbsSe"]', 
                    'div[role="button"]:has-text("Accept all")'
                ];
                let clickedInFrame = false;
                for (const selector of acceptSelectors) {
                    if (await consentFrame.locator(selector).click({timeout: 5000, trial: true}).then(() => true).catch(() => false) ) {
                        logEntry(`Clicked consent button "${selector}" in iframe.`);
                        await page.waitForTimeout(3000 + Math.random() * 2000); 
                        clickedInFrame = true; break;
                    }
                }
                if (!clickedInFrame) logEntry('Could not click standard consent buttons in iframe.', 'warn');
            } else {
                logEntry('No consent iframe detected. Checking main page for consent buttons.');
                const mainPageSelectors = [
                    'button[aria-label*="Accept all"]', 'button[aria-label*="Agree to all"]', 'button:has-text("Accept all")',
                    'tp-yt-paper-button[aria-label*="Accept all"]', 'ytd-button-renderer:has-text("Accept all") button',
                    '#dialog footer button.yt-spec-button-shape-next--filled', 
                    'ytd-consent-bump-v2-lightbox button[aria-label*="Accept"]',
                    '#lightbox ytd-button-renderer[class*="consent"] button'
                ];
                for (const selector of mainPageSelectors) {
                    if (await clickIfExists(page, selector, 5000)) { // clickIfExists uses GlobalLogger
                        logEntry(`Clicked main page consent button: ${selector}`);
                        await page.waitForTimeout(2000 + Math.random() * 1000); break;
                    }
                }
            }
        }
        
        const playerSelector = job.platform === 'youtube' ? '#movie_player video.html5-main-video, ytd-player video' : '.rumble-player-video-wrapper video, video.rumble-player';
        try {
            logEntry(`Waiting for player element (${playerSelector}) to be visible (60s).`);
            await page.waitForSelector(playerSelector, { state: 'visible', timeout: 60000 });
            logEntry(`Player element (${playerSelector}) is visible.`);
        } catch (videoWaitError) {
            logEntry(`Player element (${playerSelector}) not visible within 60s: ${videoWaitError.message.split('\n')[0]}`, 'error');
            if (page && ApifyModule.Actor.isAtHome()) {
                try {
                    const screenshotBuffer = await page.screenshot({fullPage: true, timeout: 10000});
                    const key = `SCREENSHOT_PLAYER_FAIL_${job.id.replace(/-/g,'')}`;
                    await ApifyModule.Actor.setValue(key, screenshotBuffer, { contentType: 'image/png' });
                    logEntry(`Screenshot taken on player wait failure: ${key}`);
                } catch (screenshotError) {
                    logEntry(`Failed to take screenshot: ${screenshotError.message}`, 'warn');
                }
            }
            const pageContent = await page.content({timeout: 5000}).catch(() => 'Could not get page content.');
            logEntry(`Page content sample (first 1000 chars): ${pageContent.substring(0, 1000)}`, 'debug');
            logEntry(`Current URL: ${page.url()}`, 'debug');
            logEntry(`Page title: ${await page.title().catch(()=>'N/A')}`, 'debug');
            throw new Error(`Player element not visible after 60s: ${videoWaitError.message}`);
        }

        const watchResult = await watchVideoOnPage(page, job, effectiveInput);
        Object.assign(jobResult, watchResult);

    } catch (e) {
        logEntry(`Critical error in job ${job.url}: ${e.message}\n${e.stack}`, 'error');
        jobResult.status = 'failure';
        jobResult.error = e.message + (e.stack ? `\nStack: ${e.stack}` : '');
        if (page && ApifyModule.Actor.isAtHome()) { 
            try {
                const screenshotBuffer = await page.screenshot({fullPage: true, timeout: 10000});
                const key = `SCREENSHOT_ERROR_${job.id.replace(/-/g,'')}`;
                await ApifyModule.Actor.setValue(key, screenshotBuffer, { contentType: 'image/png' });
                logEntry(`Screenshot taken on critical error: ${key}`);
            } catch (screenshotError) {
                logEntry(`Failed to take screenshot on critical error: ${screenshotError.message}`, 'warn');
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

    const defaultInput = { /* ... as before ... */ };
    const rawInput = input || {};
    const effectiveInput = { ...defaultInput };
    for (const key in defaultInput) { /* ... (robust input merging as before) ... */ }
    if (!Array.isArray(effectiveInput.skipAdsAfter) || !effectiveInput.skipAdsAfter.every(n => typeof n === 'number')) {
        effectiveInput.skipAdsAfter = defaultInput.skipAdsAfter.map(s => parseInt(s,10));
    }

    if (!effectiveInput.videoUrls || effectiveInput.videoUrls.length === 0) { /* ... */ }
    GlobalLogger.info('Effective input settings:', effectiveInput);
    let actorProxyConfiguration = null;
    if (effectiveInput.useProxies && (!effectiveInput.proxyUrls || effectiveInput.proxyUrls.length === 0)) { /* ... */ }
    const jobs = effectiveInput.videoUrls.map(url => { /* ... */ }).filter(job => job !== null);
    if (jobs.length === 0) { /* ... */ }
    GlobalLogger.info(`Created ${jobs.length} valid jobs to process.`);
    const overallResults = { /* ... */ };

    const activeWorkers = new Set();
    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        if (effectiveInput.stopSpawningOnOverload && typeof ApifyModule.Actor.isAtCapacity === 'function' && await ApifyModule.Actor.isAtCapacity()) { /* ... */ break; }
        while (activeWorkers.size >= effectiveInput.concurrency) { /* ... */ await Promise.race(Array.from(activeWorkers)); }
        
        // Pass GlobalLogger to runSingleJob
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
} else { /* ... */ }
console.log('MAIN.JS: Script fully loaded and main execution path determined.');
