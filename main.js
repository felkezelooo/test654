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

async function applyAntiDetectionScripts(pageOrContext) { /* ... (same as previous correct version) ... */ }
function extractVideoId(url) { /* ... (same as previous correct version) ... */ }
async function getVideoDuration(page) { /* ... (same as previous correct version) ... */ }
async function clickIfExists(page, selector, timeout = 3000) { /* ... (same as previous correct version) ... */ }
async function handleAds(page, platform, effectiveInput) { /* ... (same as previous correct version) ... */ }
async function watchVideoOnPage(page, job, effectiveInput) { /* ... (same as previous correct version) ... */ }
async function runSingleJob(job, effectiveInput, actorProxyConfiguration, customProxyPool) { /* ... (same as previous correct version) ... */ }

// --- Start of unchanged helper functions (applyAntiDetectionScripts, etc.) ---
async function applyAntiDetectionScripts(pageOrContext) {
    const script = () => {
        if (navigator.webdriver === true) Object.defineProperty(navigator, 'webdriver', { get: () => false });
        if (navigator.languages && !navigator.languages.includes('en-US')) Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        if (navigator.language !== 'en-US') Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
        try {
            const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function (parameter) {
                if (this.canvas.id === 'webgl-fingerprint-canvas') return originalGetParameter.apply(this, arguments);
                if (parameter === 37445) return 'Google Inc. (Intel)';
                if (parameter === 37446) return 'ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics 640, OpenGL 4.1)';
                return originalGetParameter.apply(this, arguments);
            };
        } catch (e) { (GlobalLogger || console).debug('Failed WebGL spoof:', e.message); }
        try {
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function() {
                if (this.id === 'canvas-fingerprint-element') return originalToDataURL.apply(this, arguments);
                const shift = { r: Math.floor(Math.random()*10)-5, g: Math.floor(Math.random()*10)-5, b: Math.floor(Math.random()*10)-5, a: Math.floor(Math.random()*10)-5 };
                const ctx = this.getContext('2d');
                if (ctx && this.width > 0 && this.height > 0) {
                    try {
                        const imageData = ctx.getImageData(0,0,this.width,this.height);
                        for(let i=0; i<imageData.data.length; i+=4){
                            imageData.data[i] = Math.min(255,Math.max(0,imageData.data[i]+shift.r));
                            imageData.data[i+1] = Math.min(255,Math.max(0,imageData.data[i+1]+shift.g));
                            imageData.data[i+2] = Math.min(255,Math.max(0,imageData.data[i+2]+shift.b));
                            imageData.data[i+3] = Math.min(255,Math.max(0,imageData.data[i+3]+shift.a));
                        }
                        ctx.putImageData(imageData,0,0);
                    } catch(e) { (GlobalLogger || console).debug('Failed Canvas noise:', e.message); }
                }
                return originalToDataURL.apply(this, arguments);
            };
        } catch (e) { (GlobalLogger || console).debug('Failed Canvas spoof:', e.message); }
        if (navigator.permissions && typeof navigator.permissions.query === 'function') {
            const originalPermissionsQuery = navigator.permissions.query;
            navigator.permissions.query = (parameters) => ( parameters.name === 'notifications' ? Promise.resolve({ state: Notification.permission || 'prompt' }) : originalPermissionsQuery.call(navigator.permissions, parameters) );
        }
        if (window.screen) {
            try {
                Object.defineProperty(window.screen, 'availWidth', { get: () => 1920, configurable: true });
                Object.defineProperty(window.screen, 'availHeight', { get: () => 1080, configurable: true });
                Object.defineProperty(window.screen, 'width', { get: () => 1920, configurable: true });
                Object.defineProperty(window.screen, 'height', { get: () => 1080, configurable: true });
                Object.defineProperty(window.screen, 'colorDepth', { get: () => 24, configurable: true });
                Object.defineProperty(window.screen, 'pixelDepth', { get: () => 24, configurable: true });
            } catch (e) { (GlobalLogger || console).debug('Failed screen spoof:', e.message); }
        }
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

async function getVideoDuration(page) {
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

async function clickIfExists(page, selector, timeout = 3000) {
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

async function handleAds(page, platform, effectiveInput) {
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
    const jobResult = { /* ... as before ... */ log: [] };
    const logEntry = (msg, level = 'info') => { /* ... as before ... */ };
    try { /* ... (video watching logic same as before) ... */ } catch (e) { /* ... */ } finally { /* ... */ }
    return jobResult;
}

async function runSingleJob(job, effectiveInput, actorProxyConfiguration, customProxyPool) {
    const jobScopedLogger = { /* ... as before ... */ };
    jobScopedLogger.info(`Starting job for URL: ${job.url}`);
    let browser; let context; let page; let proxyUrlToUse = null;
    const jobResult = { /* ... as before ... */ log: [] };
    const logEntry = (msg, level = 'info') => { /* ... as before ... */ };

    try {
        const launchOptions = { headless: effectiveInput.headless, args: [...ANTI_DETECTION_ARGS] };
        if (effectiveInput.useProxies) { /* ... (proxy setup as before) ... */ }
        
        logEntry('Attempting to launch browser...');
        if (ApifyModule.Actor.isAtHome() && ApifyModule.Actor.launchPlaywright && typeof ApifyModule.Actor.launchPlaywright === 'function') {
            logEntry('Using ApifyModule.Actor.launchPlaywright.');
            browser = await ApifyModule.Actor.launchPlaywright(launchOptions);
        } else {
            logEntry('Not on Apify platform or ApifyModule.Actor.launchPlaywright not available. Using playwright.chromium.launch directly.');
            browser = await playwright.chromium.launch(launchOptions);
        }
        logEntry('Browser launched.');
        
        context = await browser.newContext({ /* ... as before ... */ });
        await applyAntiDetectionScripts(context);
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

        if (job.platform === 'youtube') { /* ... (consent handling as before) ... */ }
        
        const playerSelector = job.platform === 'youtube' ? '#movie_player video.html5-main-video, ytd-player video' : '.rumble-player-video-wrapper video, video.rumble-player';
        try { /* ... (player wait as before, ensure screenshot on failure) ... */ } catch (videoWaitError) {
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
    } finally { /* ... (cleanup as before) ... */ }
    return jobResult;
}
// --- End of runSingleJob and its helpers ---


async function actorMainLogic() {
    console.log('ACTOR_MAIN_LOGIC: Entered main logic function.');
    await ApifyModule.Actor.init();
    console.log('ACTOR_MAIN_LOGIC: Actor.init() completed.');
    
    // Simplified GlobalLogger initialization
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
    GlobalLogger.info('Actor input received.'); // Log after attempting to get input
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
        concurrencyInterval: 5, // seconds
        timeout: 120, // seconds for page.goto
        maxSecondsAds: 15,
        skipAdsAfter: ["5", "10"], // Default as strings, will be parsed
        autoSkipAds: true,
        stopSpawningOnOverload: true,
        useAV1: true, // Note: AV1 support depends on Playwright's bundled Chromium and codecs
        // For fields from INPUT_SCHEMA that are booleans and might not be present if not checked by user
        disableProxyTests: false, // Default from schema
        enableEngagement: false,  // Default from schema
        leaveComment: false,      // Default from schema
        performLike: false,       // Default from schema
        subscribeToChannel: false // Default from schema
    };

    // Robust merging of input with defaults
    const rawInput = input || {}; // Use empty object if input is null
    const effectiveInput = { ...defaultInput };

    for (const key in defaultInput) {
        if (rawInput.hasOwnProperty(key) && rawInput[key] !== undefined && rawInput[key] !== null) {
            if (key === 'skipAdsAfter' && Array.isArray(rawInput[key])) {
                effectiveInput[key] = rawInput[key].map(s => parseInt(s,10)).filter(n => !isNaN(n));
            } else if (key === 'videoUrls' && Array.isArray(rawInput[key])) {
                effectiveInput[key] = rawInput[key].length > 0 ? rawInput[key] : defaultInput[key];
            } else if (key === 'proxyGroups' && Array.isArray(rawInput[key])) {
                 effectiveInput[key] = rawInput[key].length > 0 ? rawInput[key] : defaultInput[key];
            }
            else {
                effectiveInput[key] = rawInput[key];
            }
        }
    }
    // Ensure skipAdsAfter is always an array of numbers even if input was faulty
    if (!Array.isArray(effectiveInput.skipAdsAfter) || !effectiveInput.skipAdsAfter.every(n => typeof n === 'number')) {
        effectiveInput.skipAdsAfter = defaultInput.skipAdsAfter.map(s => parseInt(s,10));
    }


    if (!effectiveInput.videoUrls || effectiveInput.videoUrls.length === 0) {
        GlobalLogger.error('No video URLs provided or resolved after defaults. Exiting.');
        if (ApifyModule.Actor.fail) await ApifyModule.Actor.fail('Missing videoUrls in input.'); 
        return;
    }
    GlobalLogger.info('Effective input settings:', effectiveInput);


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
        if (effectiveInput.stopSpawningOnOverload && typeof ApifyModule.Actor.isAtCapacity === 'function' && await ApifyModule.Actor.isAtCapacity()) {
            GlobalLogger.warning('Actor is at capacity, pausing further job spawning for 30s.');
            await new Promise(r => setTimeout(r, 30000));
            if (await ApifyModule.Actor.isAtCapacity()) { GlobalLogger.error('Actor remains at capacity. Stopping further job processing.'); break; }
        }
        while (activeWorkers.size >= effectiveInput.concurrency) {
            GlobalLogger.debug(`Concurrency limit (${effectiveInput.concurrency}) reached. Waiting... Active: ${activeWorkers.size}`);
            await Promise.race(Array.from(activeWorkers));
        }
        const jobPromise = runSingleJob(job, effectiveInput, actorProxyConfiguration, effectiveInput.proxyUrls)
            .then(async (result) => {
                overallResults.details.push(result);
                result.status === 'success' ? overallResults.successfulJobs++ : overallResults.failedJobs++;
                if (ApifyModule.Actor.pushData) await ApifyModule.Actor.pushData(result);
            })
            .catch(async (error) => {
                GlobalLogger.error(`Unhandled job promise error for ${job.id}: ${error.message}`, { stack: error.stack });
                const errRes = { 
                    jobId: job.id, url: job.url, videoId: job.videoId, platform: job.platform, 
                    status: 'catastrophic_loop_failure', 
                    error: error.message, 
                    stack: error.stack, 
                    log: [`[${new Date().toISOString()}] [ERROR] Unhandled promise: ${error.message}`]
                };
                overallResults.details.push(errRes); 
                overallResults.failedJobs++;
                if (ApifyModule.Actor.pushData) await ApifyModule.Actor.pushData(errRes);
            })
            .finally(() => {
                activeWorkers.delete(jobPromise);
                GlobalLogger.info(`Worker slot freed. Active: ${activeWorkers.size}. Job ID ${job.id.substring(0,6)} done.`);
            });
        activeWorkers.add(jobPromise);
        GlobalLogger.info(`Job ${job.id.substring(0,6)} (${i + 1}/${jobs.length}) dispatched. Active: ${activeWorkers.size}`);
        if (effectiveInput.concurrencyInterval > 0 && i < jobs.length - 1 && activeWorkers.size < effectiveInput.concurrency) {
            GlobalLogger.debug(`Concurrency interval: ${effectiveInput.concurrencyInterval}s`);
            await new Promise(r => setTimeout(r, effectiveInput.concurrencyInterval * 1000));
        }
    }
    GlobalLogger.info(`All jobs dispatched. Waiting for ${activeWorkers.size} active workers to complete...`);
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
