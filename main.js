// Initial console logs, as Actor.log might not be available yet
console.log('MAIN.JS: Script execution started.');
console.log(`MAIN.JS: Node.js version: ${process.version}`);

const ApifyModule = require('apify');
const playwright = require('playwright'); // Directly use playwright
const { v4: uuidv4 } = require('uuid');
// const { ProxyChain } = require('proxy-chain');

// --- Constants and Helper Functions ---
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

let GlobalLogger = {
    info: (message, data) => console.log(`INFO: ${message}`, data || ''),
    warning: (message, data) => console.warn(`WARN: ${message}`, data || ''),
    error: (message, data) => console.error(`ERROR: ${message}`, data || ''),
    debug: (message, data) => console.log(`DEBUG: ${message}`, data || ''),
};

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
        } catch (e) { /* GlobalLogger.debug('Failed WebGL spoof:', e.message) */ }
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
                    } catch(e) { /* GlobalLogger.debug('Failed Canvas noise:', e.message) */ }
                }
                return originalToDataURL.apply(this, arguments);
            };
        } catch (e) { /* GlobalLogger.debug('Failed Canvas spoof:', e.message) */ }
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
            } catch (e) { /* GlobalLogger.debug('Failed screen spoof:', e.message) */ }
        }
        try { Date.prototype.getTimezoneOffset = function() { return 5 * 60; }; } catch (e) { /* GlobalLogger.debug('Failed timezone spoof:', e.message) */ }
        if (navigator.plugins) try { Object.defineProperty(navigator, 'plugins', { get: () => [], configurable: true }); } catch(e) { /* GlobalLogger.debug('Failed plugin spoof:', e.message) */ }
        if (navigator.mimeTypes) try { Object.defineProperty(navigator, 'mimeTypes', { get: () => [], configurable: true }); } catch(e) { /* GlobalLogger.debug('Failed mimeType spoof:', e.message) */ }
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
        GlobalLogger.error(`Error extracting video ID from URL ${url}: ${error.message}`);
    }
    return null;
}

async function getVideoDuration(page) {
    GlobalLogger.info('Attempting to get video duration.');
    for (let i = 0; i < 15; i++) { // Try for up to 15 seconds
        try {
            const duration = await page.evaluate(() => {
                const video = document.querySelector('video');
                return video ? video.duration : null;
            });
            if (duration && duration !== Infinity && duration > 0) {
                GlobalLogger.info(`Video duration found: ${duration} seconds.`);
                return duration;
            }
        } catch (e) {
            GlobalLogger.debug(`Attempt ${i+1} to get duration failed: ${e.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    GlobalLogger.warning('Could not determine video duration after 15 seconds.');
    return null;
}

async function clickIfExists(page, selector, timeout = 3000) {
    try {
        // Wait for element to be visible and stable, then click
        const element = page.locator(selector).first(); // Take the first if multiple
        await element.waitFor({ state: 'visible', timeout });
        await element.click({ timeout: timeout / 2, force: false, noWaitAfter: false }); // Ensure click completes
        GlobalLogger.info(`Clicked on selector: ${selector}`);
        return true;
    } catch (e) {
        GlobalLogger.debug(`Selector not found or not clickable within ${timeout}ms: ${selector} - Error: ${e.message}`);
        return false;
    }
}

async function handleAds(page, platform, effectiveInput) {
    GlobalLogger.info('Starting ad handling logic.');
    const adCheckInterval = 3000;
    let adWatchLoop = 0;
    const maxAdLoopIterations = Math.ceil((effectiveInput.maxSecondsAds * 1000) / adCheckInterval) + 5;

    for (adWatchLoop = 0; adWatchLoop < maxAdLoopIterations; adWatchLoop++) {
        let isAdPlaying = false;
        let canSkip = false;
        let adCurrentTime = adWatchLoop * (adCheckInterval / 1000); // Approximate

        if (platform === 'youtube') {
            isAdPlaying = await page.locator('.ytp-ad-player-overlay-instream-info, .video-ads .ad-showing').count() > 0;
            if (isAdPlaying) {
                GlobalLogger.info('YouTube ad detected.');
                canSkip = await page.locator('.ytp-ad-skip-button-modern, .ytp-ad-skip-button').count() > 0;
            }
        } else if (platform === 'rumble') {
            isAdPlaying = await page.locator('.video-ad-indicator, .ima-ad-container *:not([style*="display: none"])').count() > 0;
             if (isAdPlaying) {
                GlobalLogger.info('Rumble ad detected.');
                canSkip = await page.locator('button[aria-label*="Skip Ad"], div[class*="skip-button"]').count() > 0;
             }
        }

        if (!isAdPlaying) {
            GlobalLogger.info('No ad currently playing or ad finished.');
            break;
        }

        const minSkipTime = Array.isArray(effectiveInput.skipAdsAfter) && effectiveInput.skipAdsAfter.length > 0 ? parseInt(effectiveInput.skipAdsAfter[0], 10) : 5;
        
        if (effectiveInput.autoSkipAds && canSkip) {
            GlobalLogger.info('Attempting to skip ad (autoSkipAds).');
            await clickIfExists(page, '.ytp-ad-skip-button-modern, .ytp-ad-skip-button, button[aria-label*="Skip Ad"], div[class*="skip-button"]', 1000);
            await page.waitForTimeout(2000); // Wait for ad to potentially disappear
            continue; // Re-check immediately if ad is gone
        }

        if (adCurrentTime >= minSkipTime && canSkip) {
            GlobalLogger.info(`Ad has played for ~${adCurrentTime.toFixed(1)}s, attempting to skip (skipAdsAfter).`);
            await clickIfExists(page, '.ytp-ad-skip-button-modern, .ytp-ad-skip-button, button[aria-label*="Skip Ad"], div[class*="skip-button"]', 1000);
            await page.waitForTimeout(2000);
            continue;
        }
        
        if (adCurrentTime >= effectiveInput.maxSecondsAds) {
             GlobalLogger.info(`Ad has played for ~${adCurrentTime.toFixed(1)}s (maxSecondsAds reached).`);
             if (canSkip) {
                await clickIfExists(page, '.ytp-ad-skip-button-modern, .ytp-ad-skip-button, button[aria-label*="Skip Ad"], div[class*="skip-button"]', 1000);
             } else {
                GlobalLogger.info('Max ad watch time reached, but cannot skip yet.');
             }
             break; // Exit ad loop if max ad time is reached
        }
        await page.waitForTimeout(adCheckInterval);
    }
    if (adWatchLoop >= maxAdLoopIterations) {
        GlobalLogger.warning('Max ad loop iterations reached. Proceeding as if ad finished.');
    }
    GlobalLogger.info('Ad handling finished or timed out.');
}

async function watchVideoOnPage(page, platform, job, effectiveInput) {
    const jobResult = {
        jobId: job.id, url: job.url, videoId: job.videoId, platform, status: 'pending',
        watchTimeRequestedSec: 0, watchTimeActualSec: 0, durationFoundSec: null,
        startTime: new Date().toISOString(), endTime: null, error: null, log: []
    };
    const logEntry = (msg, level = 'info') => {
        const formattedMessage = `[Job ${job.id.substring(0,6)}] ${msg}`;
        GlobalLogger[level](formattedMessage);
        jobResult.log.push(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`);
    };

    try {
        logEntry('Handling initial ads.');
        await handleAds(page, platform, effectiveInput);
        logEntry(`Attempting to play video: ${job.url}`);
        let playButtonSelectors = platform === 'youtube' 
            ? ['.ytp-large-play-button', '.ytp-play-button[aria-label*="Play"]', 'video.html5-main-video']
            : ['.rumbles-player-play-button', 'video.rumble-player-video'];
        
        let played = false;
        for (const selector of playButtonSelectors) {
            if (await clickIfExists(page, selector, 3000)) { played = true; logEntry(`Clicked play button: ${selector}`); break; }
        }
        if (!played) {
             logEntry('No specific play button found, attempting to click video element directly.');
             await page.locator('video').first().click({timeout: 5000, force: true}).catch(e => logEntry(`Failed to click video: ${e.message}`, 'warn'));
        }
        await page.evaluate(() => { const v = document.querySelector('video'); if(v) { v.muted=false; v.volume=0.1+Math.random()*0.2; }}).catch(e => logEntry(`Unmute/volume failed: ${e.message}`, 'debug'));

        const duration = await getVideoDuration(page);
        if (!duration || duration <= 0) throw new Error('Could not determine valid video duration.');
        jobResult.durationFoundSec = duration;

        const targetWatchTimeSec = Math.floor(duration * (effectiveInput.watchTimePercentage / 100));
        jobResult.watchTimeRequestedSec = targetWatchTimeSec;
        logEntry(`Target watch: ${targetWatchTimeSec.toFixed(2)}s of ${duration.toFixed(2)}s.`);
        if (targetWatchTimeSec <= 0) throw new Error(`Calculated target watch time ${targetWatchTimeSec}s is invalid.`);

        let currentActualWatchTime = 0;
        const watchIntervalMs = 5000;
        const maxWatchLoops = Math.ceil(targetWatchTimeSec / (watchIntervalMs / 1000)) + 12; // Extra loops for ads/buffering

        for (let i = 0; i < maxWatchLoops; i++) {
            logEntry(`Watch loop ${i+1}/${maxWatchLoops}. Ads check.`);
            await handleAds(page, platform, effectiveInput);
            const videoState = await page.evaluate(() => { const v = document.querySelector('video'); return v ? { ct:v.currentTime, p:v.paused, e:v.ended, rs:v.readyState, ns:v.networkState } : null; }).catch(e => { logEntry(`Video state error: ${e.message}`, 'warn'); return null; });
            if (!videoState) throw new Error('Video element disappeared.');
            logEntry(`State: time=${videoState.ct?.toFixed(2)}, paused=${videoState.p}, ended=${videoState.e}, ready=${videoState.rs}, net=${videoState.ns}`);
            if (videoState.p && !videoState.e) {
                logEntry('Paused, trying to play.');
                for (const sel of playButtonSelectors) if (await clickIfExists(page, sel, 2000)) break;
                await page.locator('video').first().click({timeout:2000, force: true}).catch(e => logEntry(`Fallback click failed: ${e.message}`, 'debug'));
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

async function runSingleJob(job, effectiveInput, actorProxyConfiguration, customProxyPool) {
    const jobScopedLogger = {
        info: (msg) => GlobalLogger.info(`[Job ${job.id.substring(0,6)}] ${msg}`),
        warning: (msg) => GlobalLogger.warning(`[Job ${job.id.substring(0,6)}] ${msg}`),
        error: (msg, data) => GlobalLogger.error(`[Job ${job.id.substring(0,6)}] ${msg}`, data),
        debug: (msg) => GlobalLogger.debug(`[Job ${job.id.substring(0,6)}] ${msg}`),
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
        jobScopedLogger[level](msg); // Log to Actor.log (or console if Actor.log is not set)
        jobResult.log.push(tsMsg); // Also add to job's specific log array
    };

    try {
        const launchOptions = { headless: effectiveInput.headless, args: [...ANTI_DETECTION_ARGS] };
        if (effectiveInput.useProxies) {
            if (customProxyPool && customProxyPool.length > 0) {
                proxyUrlToUse = customProxyPool[Math.floor(Math.random() * customProxyPool.length)];
                logEntry(`Using custom proxy: ${proxyUrlToUse.split('@')[0]}`); // Mask credentials
                launchOptions.proxy = { server: proxyUrlToUse };
                jobResult.proxyUsed = `Custom: ${proxyUrlToUse.split('@')[1] || proxyUrlToUse.split('//')[1] || 'details hidden'}`;
            } else if (actorProxyConfiguration) {
                const sessionId = uuidv4().replace(/-/g, '');
                proxyUrlToUse = await actorProxyConfiguration.newUrl(sessionId);
                logEntry(`Using Apify proxy (Session: ${sessionId})`);
                launchOptions.proxy = { server: proxyUrlToUse };
                jobResult.proxyUsed = 'ApifyProxy';
            } else {
                logEntry('No proxies configured. Running directly.', 'warn');
            }
        }

        browser = await playwright.chromium.launch(launchOptions); // Use playwright module directly
        
        context = await browser.newContext({
            bypassCSP: true, ignoreHTTPSErrors: true,
            viewport: { width: 1280 + Math.floor(Math.random() * 200), height: 720 + Math.floor(Math.random() * 100) },
            locale: 'en-US', timezoneId: 'America/New_York', javaScriptEnabled: true,
        });
        await applyAntiDetectionScripts(context);
        page = await context.newPage();
        await page.setViewportSize({ width: 1200 + Math.floor(Math.random()*120), height: 700 + Math.floor(Math.random()*80) });

        logEntry(`Navigating to ${job.url} with waitUntil: 'load' and timeout ${effectiveInput.timeout}s.`);
        await page.goto(job.url, { timeout: effectiveInput.timeout * 1000, waitUntil: 'load' });
        logEntry(`Navigation to ${job.url} complete.`);

        // Attempt to handle cookie consent popups
        const consentSelectors = [
            'button[aria-label*="Accept all"]', 'button[aria-label*="Agree"]', 'button:has-text("Accept All")', 'button:has-text("I Agree")',
            'div[aria-modal="true"] button:has-text("Accept all")', 'div[aria-modal="true"] button:has-text("I agree")'
            // Add more selectors if specific ones are identified for YouTube/Rumble
        ];
        let consentClicked = false;
        for (const selector of consentSelectors) {
            if (await clickIfExists(page, selector, 5000)) {
                logEntry(`Clicked a consent button: ${selector}`);
                await page.waitForTimeout(2000 + Math.random() * 1000); // Allow page to react
                consentClicked = true;
                break;
            }
        }
        if (!consentClicked) {
            logEntry('No common consent popups found/clicked.', 'debug');
        }
        
        const playerSelector = platform === 'youtube' ? '#movie_player, video.html5-main-video' : '.rumble-player-video-wrapper, video.rumble-player';
        try {
            logEntry(`Waiting for player element (${playerSelector}) to be visible.`);
            await page.waitForSelector(playerSelector, { state: 'visible', timeout: 45000 }); // Increased timeout
            logEntry(`Player element (${playerSelector}) is visible.`);
        } catch (videoWaitError) {
            logEntry(`Player element (${playerSelector}) did not become visible within 45s: ${videoWaitError.message}`, 'error');
            const pageContent = await page.content().catch(() => 'Could not get page content.');
            logEntry(`Page content sample: ${pageContent.substring(0, 500)}`, 'debug');
            throw new Error(`Player element not visible: ${videoWaitError.message}`); // Re-throw to fail the job
        }

        const watchResult = await watchVideoOnPage(page, job.platform, job, effectiveInput);
        Object.assign(jobResult, watchResult);
    } catch (e) {
        logEntry(`Critical error in job ${job.url}: ${e.message}\n${e.stack}`, 'error');
        jobResult.status = 'failure';
        jobResult.error = e.message + (e.stack ? `\nStack: ${e.stack}` : '');
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
        console.log('ACTOR_MAIN_LOGIC: Actor.log is available. Switching GlobalLogger.');
        GlobalLogger = ApifyModule.Actor.log;
    } else if (ApifyModule.utils && ApifyModule.utils.log && typeof ApifyModule.utils.log.info === 'function') {
        console.log('ACTOR_MAIN_LOGIC: Actor.log not available, but Apify.utils.log is. Switching GlobalLogger.');
        GlobalLogger = ApifyModule.utils.log;
    }
     else {
        console.error('ACTOR_MAIN_LOGIC: Neither Actor.log nor Apify.utils.log is available. Using console for logging.');
    }
    GlobalLogger.info('Starting YouTube & Rumble View Bot Actor (Apify SDK v3 compatible).');

    const input = await ApifyModule.Actor.getInput();
    GlobalLogger.info('Actor input:', input || 'No input received, using defaults.');
    const defaultInput = {
        videoUrls: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'], watchTimePercentage: 80, useProxies: true,
        proxyUrls: [], proxyCountry: null, proxyGroups: ['RESIDENTIAL'], headless: true, concurrency: 1,
        concurrencyInterval: 5, timeout: 120, maxSecondsAds: 15, skipAdsAfter: ["5", "10"],
        autoSkipAds: true, stopSpawningOnOverload: true, useAV1: true,
    };
    const effectiveInput = {
        ...defaultInput, ...(input || {}),
        skipAdsAfter: ((input && input.skipAdsAfter) || defaultInput.skipAdsAfter).map(s => parseInt(s,10)),
        videoUrls: (input && input.videoUrls && Array.isArray(input.videoUrls) && input.videoUrls.length > 0) ? input.videoUrls : defaultInput.videoUrls,
        proxyGroups: (input && input.proxyGroups && Array.isArray(input.proxyGroups) && input.proxyGroups.length > 0) ? input.proxyGroups : defaultInput.proxyGroups,
    };
    if (!effectiveInput.videoUrls || effectiveInput.videoUrls.length === 0) {
        GlobalLogger.error('No video URLs. Exiting.');
        if (ApifyModule.Actor.fail) await ApifyModule.Actor.fail('Missing videoUrls.'); return;
    }
    GlobalLogger.info('Effective input settings:', effectiveInput);

    let actorProxyConfiguration = null;
    if (effectiveInput.useProxies && (!effectiveInput.proxyUrls || effectiveInput.proxyUrls.length === 0)) {
        const opts = { groups: effectiveInput.proxyGroups };
        if (effectiveInput.proxyCountry && effectiveInput.proxyCountry.trim() !== "") opts.countryCode = effectiveInput.proxyCountry;
        actorProxyConfiguration = await ApifyModule.Actor.createProxyConfiguration(opts);
        GlobalLogger.info(`Apify Proxy. Country: ${effectiveInput.proxyCountry || 'Any'}`);
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
        GlobalLogger.error('No valid jobs. Exiting.');
        if (ApifyModule.Actor.fail) await ApifyModule.Actor.fail('No valid jobs.'); return;
    }
    GlobalLogger.info(`Created ${jobs.length} valid jobs.`);
    
    const overallResults = {
        totalJobs: jobs.length, successfulJobs: 0, failedJobs: 0,
        details: [], startTime: new Date().toISOString(), endTime: null,
    };

    const activeWorkers = new Set();
    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        if (effectiveInput.stopSpawningOnOverload && typeof ApifyModule.Actor.isAtCapacity === 'function' && await ApifyModule.Actor.isAtCapacity()) {
            GlobalLogger.warning('At capacity, pausing for 30s.');
            await new Promise(r => setTimeout(r, 30000));
            if (await ApifyModule.Actor.isAtCapacity()) { GlobalLogger.error('Still at capacity. Stopping.'); break; }
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
                const errRes = { jobId: job.id, url: job.url, videoId: job.videoId, platform: job.platform, status: 'catastrophic_loop_failure', error: error.message, stack: error.stack, log: [`[${new Date().toISOString()}] [ERROR] Unhandled promise: ${error.message}`]};
                overallResults.details.push(errRes); overallResults.failedJobs++;
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
