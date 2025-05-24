const { Actor } = require('apify');
const playwright = require('playwright');
const { v4: uuidv4 } = require('uuid');
// const { ProxyChain } = require('proxy-chain'); // Likely not needed if Playwright handles proxies directly

const ANTI_DETECTION_ARGS = [
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process,ImprovedCookieControls,LazyFrameLoading,GlobalMediaControls,DestroyProfileOnBrowserClose,MediaRouter,DialMediaRouteProvider,AcceptCHFrame,AutoExpandDetailsElement,CertificateTransparencyEnforcement,AvoidUnnecessaryBeforeUnloadCheckSync,Translate',
    '--disable-component-extensions-with-background-pages',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-site-isolation-trials',
    '--disable-sync',
    // '--enable-automation', // Often removed for anti-detection, but Playwright might need it. Test this.
    '--force-webrtc-ip-handling-policy=default_public_interface_only', // Mask WebRTC IP
    '--no-first-run',
    '--no-service-autorun',
    '--password-store=basic',
    '--use-mock-keychain',
    '--enable-precise-memory-info',
    '--window-size=1920,1080', // Consistent window size
    // The following might be too aggressive or cause issues, test individually
    // '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 Edg/110.0.1518.8',
    '--disable-infobars',
    '--disable-notifications',
    '--disable-popup-blocking',
    '--disable-dev-shm-usage', // Important for Docker/Linux environments
    '--no-sandbox', // Often needed in Docker, use with caution
    '--disable-gpu', // Can help in headless environments or if GPU issues arise
    '--disable-setuid-sandbox',
    '--disable-software-rasterizer',
    '--mute-audio',
    '--ignore-certificate-errors',
];

async function applyAntiDetectionScripts(pageOrContext) {
    const script = () => {
        // Override navigator properties
        if (navigator.webdriver === true) {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        }
        if (navigator.languages && navigator.languages.length > 0 && !navigator.languages.includes('en-US')) {
             Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });
        }
        if (navigator.language !== 'en-US') {
            Object.defineProperty(navigator, 'language', {
                get: () => 'en-US',
            });
        }

        // Modify WebGL fingerprint
        try {
            const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function (parameter) {
                if (this.canvas.id === 'webgl-fingerprint-canvas') { // Apply only to a specific dummy canvas if needed
                    return originalGetParameter.apply(this, arguments);
                }
                // Spoof vendor and renderer
                if (parameter === 37445) return 'Google Inc. (Intel)'; // WEBGL_debug_renderer_info VENDOR
                if (parameter === 37446) return 'ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics 640, OpenGL 4.1)'; // WEBGL_debug_renderer_info RENDERER
                return originalGetParameter.apply(this, arguments);
            };
        } catch (e) {
            // console.warn('Error modifying WebGL fingerprint:', e.message);
        }

        // Modify Canvas fingerprint
        try {
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function() {
                if (this.id === 'canvas-fingerprint-element') { // Apply only to a specific dummy canvas if needed
                    return originalToDataURL.apply(this, arguments);
                }
                // Add slight noise, can be more sophisticated
                const shift = {
                    'r': Math.floor(Math.random() * 10) - 5,
                    'g': Math.floor(Math.random() * 10) - 5,
                    'b': Math.floor(Math.random() * 10) - 5,
                    'a': Math.floor(Math.random() * 10) - 5
                };
                const context = this.getContext('2d');
                if (context) {
                    // Only apply if canvas has some content
                    if (this.width > 0 && this.height > 0) {
                        try {
                            const imageData = context.getImageData(0, 0, this.width, this.height);
                            for (let i = 0; i < imageData.data.length; i += 4) {
                                imageData.data[i] = Math.min(255, Math.max(0, imageData.data[i] + shift.r));
                                imageData.data[i+1] = Math.min(255, Math.max(0, imageData.data[i+1] + shift.g));
                                imageData.data[i+2] = Math.min(255, Math.max(0, imageData.data[i+2] + shift.b));
                                imageData.data[i+3] = Math.min(255, Math.max(0, imageData.data[i+3] + shift.a));
                            }
                            context.putImageData(imageData,0,0);
                        } catch (e) {
                            // console.warn('Error modifying canvas data:', e.message);
                        }
                    }
                }
                return originalToDataURL.apply(this, arguments);
            };
        } catch (e) {
            // console.warn('Error modifying Canvas fingerprint:', e.message);
        }

        // Override permissions
        if (navigator.permissions && typeof navigator.permissions.query === 'function') {
            const originalPermissionsQuery = navigator.permissions.query;
            navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission || 'prompt' }) : // Use 'prompt' if permission is not yet set
                    originalPermissionsQuery.call(navigator.permissions, parameters)
            );
        }

        // Spoof screen resolution and color depth
        if (window.screen) {
            try {
                Object.defineProperty(window.screen, 'availWidth', { get: () => 1920, configurable: true });
                Object.defineProperty(window.screen, 'availHeight', { get: () => 1080, configurable: true });
                Object.defineProperty(window.screen, 'width', { get: () => 1920, configurable: true });
                Object.defineProperty(window.screen, 'height', { get: () => 1080, configurable: true });
                Object.defineProperty(window.screen, 'colorDepth', { get: () => 24, configurable: true });
                Object.defineProperty(window.screen, 'pixelDepth', { get: () => 24, configurable: true });
            } catch (e) {
                // console.warn('Error spoofing screen properties:', e.message);
            }
        }
        
        // Spoof timezone (less reliable way, but better than nothing)
        try {
            const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
            Date.prototype.getTimezoneOffset = function() { 
                // Example: Spoof to UTC-5 (New York EST, without DST for simplicity)
                return 5 * 60; 
            };
        } catch (e) {
             // console.warn('Error modifying timezone:', e.message);
        }

        // Spoof plugins (return empty array)
        if (navigator.plugins) {
            try {
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [],
                    configurable: true
                });
            } catch (e) {
                // console.warn('Error spoofing navigator.plugins:', e.message);
            }
        }

        // Spoof mimeTypes (return empty array)
        if (navigator.mimeTypes) {
             try {
                Object.defineProperty(navigator, 'mimeTypes', {
                    get: () => [],
                    configurable: true
                });
            } catch (e) {
                // console.warn('Error spoofing navigator.mimeTypes:', e.message);
            }
        }
    };

    if (pageOrContext.addInitScript) { // For BrowserContext
        await pageOrContext.addInitScript(script);
    } else { // For Page
        await pageOrContext.evaluateOnNewDocument(script);
    }
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
        console.error(`Error extracting video ID from URL ${url}: ${error.message}`);
    }
    return null;
}

async function getVideoDuration(page, logger) {
    logger.info('Attempting to get video duration.');
    for (let i = 0; i < 15; i++) { // Try for up to 15 seconds
        try {
            const duration = await page.evaluate(() => {
                const video = document.querySelector('video');
                return video ? video.duration : null;
            });
            if (duration && duration !== Infinity && duration > 0) {
                logger.info(`Video duration found: ${duration} seconds.`);
                return duration;
            }
        } catch (e) {
            logger.debug(`Attempt ${i+1} to get duration failed: ${e.message}`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    logger.warning('Could not determine video duration after 15 seconds.');
    return null;
}

async function clickIfExists(page, selector, logger, timeout = 3000) {
    try {
        await page.waitForSelector(selector, { state: 'visible', timeout });
        await page.click(selector, { timeout: timeout / 2 }); // Give click its own timeout
        logger.info(`Clicked on selector: ${selector}`);
        return true;
    } catch (e) {
        logger.debug(`Selector not found or not clickable within ${timeout}ms: ${selector} - Error: ${e.message}`);
        return false;
    }
}

async function handleAds(page, platform, effectiveInput, logger) {
    logger.info('Starting ad handling logic.');
    const adCheckInterval = 3000; // Check for ads more frequently
    let adWatchLoop = 0;
    const maxAdLoopIterations = Math.ceil((effectiveInput.maxSecondsAds * 1000) / adCheckInterval) + 5;

    for (adWatchLoop = 0; adWatchLoop < maxAdLoopIterations; adWatchLoop++) {
        let isAdPlaying = false;
        let canSkip = false;
        let adCurrentTime = 0; // Placeholder, accurate ad time is hard

        if (platform === 'youtube') {
            isAdPlaying = await page.locator('.ytp-ad-player-overlay-instream-info, .video-ads .ad-showing').count() > 0;
            if (isAdPlaying) {
                logger.info('YouTube ad detected.');
                canSkip = await page.locator('.ytp-ad-skip-button-modern, .ytp-ad-skip-button').count() > 0;
                // For simplicity, we'll assume adCurrentTime increases with loops
                adCurrentTime = adWatchLoop * (adCheckInterval / 1000);
            }
        } else if (platform === 'rumble') {
            isAdPlaying = await page.locator('.video-ad-indicator, .ima-ad-container *:not([style*="display: none"])').count() > 0;
            if (isAdPlaying) {
                logger.info('Rumble ad detected.');
                canSkip = await page.locator('button[aria-label*="Skip Ad"], div[class*="skip-button"]').count() > 0;
                adCurrentTime = adWatchLoop * (adCheckInterval / 1000);
            }
        }

        if (!isAdPlaying) {
            logger.info('No ad currently playing or ad finished.');
            break;
        }

        const minSkipTime = Array.isArray(effectiveInput.skipAdsAfter) && effectiveInput.skipAdsAfter.length > 0 ? parseInt(effectiveInput.skipAdsAfter[0], 10) : 5;
        
        if (effectiveInput.autoSkipAds && canSkip) {
            logger.info('Attempting to skip ad (autoSkipAds).');
            await clickIfExists(page, '.ytp-ad-skip-button-modern, .ytp-ad-skip-button, button[aria-label*="Skip Ad"], div[class*="skip-button"]', logger, 1000);
            await page.waitForTimeout(2000); // wait for ad to potentially disappear
            continue; // Re-check immediately if ad is gone
        }

        if (adCurrentTime >= minSkipTime && canSkip) {
            logger.info(`Ad has played for ~${adCurrentTime.toFixed(1)}s, attempting to skip (skipAdsAfter).`);
            await clickIfExists(page, '.ytp-ad-skip-button-modern, .ytp-ad-skip-button, button[aria-label*="Skip Ad"], div[class*="skip-button"]', logger, 1000);
            await page.waitForTimeout(2000);
            continue;
        }
        
        if (adCurrentTime >= effectiveInput.maxSecondsAds) {
             logger.info(`Ad has played for ~${adCurrentTime.toFixed(1)}s (maxSecondsAds reached), attempting to skip if possible.`);
             if (canSkip) {
                await clickIfExists(page, '.ytp-ad-skip-button-modern, .ytp-ad-skip-button, button[aria-label*="Skip Ad"], div[class*="skip-button"]', logger, 1000);
             } else {
                logger.info('Max ad watch time reached, but cannot skip yet. Continuing to watch video/ad.');
             }
             break; // Exit ad loop if max ad time is reached, whether skipped or not
        }
        await page.waitForTimeout(adCheckInterval);
    }
    if (adWatchLoop >= maxAdLoopIterations) {
        logger.warning('Max ad loop iterations reached. Proceeding as if ad finished.');
    }
    logger.info('Ad handling finished or timed out.');
}


async function watchVideoOnPage(page, platform, job, effectiveInput, logger) {
    const jobResult = {
        jobId: job.id,
        url: job.url,
        videoId: job.videoId,
        platform,
        status: 'pending',
        watchTimeRequestedSec: 0,
        watchTimeActualSec: 0,
        durationFoundSec: null,
        startTime: new Date().toISOString(),
        endTime: null,
        error: null,
        log: []
    };
    
    const logEntry = (msg, level = 'info') => {
        logger[level](msg);
        jobResult.log.push(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`);
    };

    try {
        logEntry('Handling initial ads.');
        await handleAds(page, platform, effectiveInput, { info: logEntry, warning: (m) => logEntry(m, 'warn'), debug: (m) => logEntry(m, 'debug') });

        logEntry(`Attempting to play video: ${job.url}`);
        let playButtonSelectors = [];
        if (platform === 'youtube') {
            playButtonSelectors = ['.ytp-large-play-button', '.ytp-play-button[aria-label*="Play"]', 'video.html5-main-video'];
        } else if (platform === 'rumble') {
            playButtonSelectors = ['.rumbles-player-play-button', 'video.rumble-player-video'];
        }

        let played = false;
        for (const selector of playButtonSelectors) {
            if (await clickIfExists(page, selector, { info: logEntry, debug: (m) => logEntry(m, 'debug') }, 3000)) {
                played = true;
                logEntry(`Clicked play button: ${selector}`);
                break;
            }
        }
        if (!played) {
             logEntry('No specific play button found, attempting to click video element directly.');
             await page.locator('video').first().click({timeout: 5000}).catch(e => logEntry(`Failed to click video element: ${e.message}`, 'warn'));
        }
        
        await page.evaluate(() => {
            const video = document.querySelector('video');
            if (video) {
                video.muted = false;
                video.volume = 0.1 + Math.random() * 0.2; // Small, slightly random volume
            }
        }).catch(e => logEntry(`Could not unmute/set volume: ${e.message}`, 'debug'));

        const duration = await getVideoDuration(page, { info: logEntry, warning: (m) => logEntry(m, 'warn'), debug: (m) => logEntry(m, 'debug') });
        if (!duration || duration <= 0) {
            throw new Error('Could not determine valid video duration.');
        }
        jobResult.durationFoundSec = duration;

        const targetWatchTimeSec = Math.floor(duration * (effectiveInput.watchTimePercentage / 100));
        jobResult.watchTimeRequestedSec = targetWatchTimeSec;
        logEntry(`Target watch time: ${targetWatchTimeSec.toFixed(2)} seconds for video of ${duration.toFixed(2)}s.`);

        if (targetWatchTimeSec <= 0) {
            throw new Error(`Calculated target watch time is ${targetWatchTimeSec}s, which is invalid.`);
        }

        let currentActualWatchTime = 0;
        const watchIntervalMs = 5000;
        const maxWatchLoops = Math.ceil(targetWatchTimeSec / (watchIntervalMs / 1000)) + 12; // Extra loops for ads/buffering

        for (let i = 0; i < maxWatchLoops; i++) {
            logEntry(`Watch loop ${i+1}/${maxWatchLoops}. Handling ads before checking video state.`);
            await handleAds(page, platform, effectiveInput, { info: logEntry, warning: (m) => logEntry(m, 'warn'), debug: (m) => logEntry(m, 'debug') });

            const videoState = await page.evaluate(() => {
                const video = document.querySelector('video');
                return video ? { currentTime: video.currentTime, paused: video.paused, ended: video.ended, readyState: video.readyState, networkState: video.networkState } : null;
            }).catch(e => {
                logEntry(`Error getting video state: ${e.message}`, 'warn');
                return null;
            });

            if (!videoState) {
                throw new Error('Video element disappeared or not found during watch loop.');
            }

            logEntry(`Video state: currentTime=${videoState.currentTime?.toFixed(2)}, paused=${videoState.paused}, ended=${videoState.ended}, readyState=${videoState.readyState}, networkState=${videoState.networkState}`);

            if (videoState.paused && !videoState.ended) {
                logEntry('Video is paused, attempting to play.');
                for (const selector of playButtonSelectors) {
                    if (await clickIfExists(page, selector, { info: logEntry, debug: (m) => logEntry(m, 'debug') }, 2000)) break;
                }
                // Fallback click on video if specific buttons fail
                await page.locator('video').first().click({timeout: 2000}).catch(e => logEntry(`Fallback video click failed: ${e.message}`, 'debug'));
            }
            
            currentActualWatchTime = videoState.currentTime || 0;
            jobResult.watchTimeActualSec = currentActualWatchTime;

            if (currentActualWatchTime >= targetWatchTimeSec || videoState.ended) {
                logEntry(`Target watch time reached or video ended. Actual: ${currentActualWatchTime.toFixed(2)}s`);
                break;
            }
            
            if (i % 6 === 0) { // every ~30 seconds
                 await page.mouse.move(Math.random() * 500, Math.random() * 300, {steps: 5}).catch(()=>{});
                 logEntry('Simulated mouse movement.', 'debug');
            }

            await page.waitForTimeout(watchIntervalMs);
        }
        
        if (currentActualWatchTime < targetWatchTimeSec) {
            logEntry(`Watched ${currentActualWatchTime.toFixed(2)}s, less than target ${targetWatchTimeSec.toFixed(2)}s.`, 'warn');
        }

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

async function runSingleJob(job, effectiveInput, actorProxyConfiguration, customProxyPool, logger) {
    const jobScopedLogger = {
        info: (msg) => logger.info(`[Job ${job.id.substring(0,6)}] ${msg}`),
        warning: (msg) => logger.warning(`[Job ${job.id.substring(0,6)}] ${msg}`),
        error: (msg, data) => logger.error(`[Job ${job.id.substring(0,6)}] ${msg}`, data),
        debug: (msg) => logger.debug(`[Job ${job.id.substring(0,6)}] ${msg}`),
    };

    jobScopedLogger.info(`Starting job for URL: ${job.url}`);
    let browser;
    let context;
    let proxyUrlToUse = null;

    const jobResult = {
        jobId: job.id,
        url: job.url,
        videoId: job.videoId,
        platform: job.platform,
        proxyUsed: 'None',
        status: 'initiated',
        error: null,
        log: [] // Initialize log array for this job
    };
     const logEntry = (msg, level = 'info') => { // Local log function for jobResult
        jobScopedLogger[level](msg);
        jobResult.log.push(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`);
    };


    try {
        const launchOptions = {
            headless: effectiveInput.headless,
            args: [...ANTI_DETECTION_ARGS],
        };

        if (effectiveInput.useProxies) {
            if (customProxyPool && customProxyPool.length > 0) {
                proxyUrlToUse = customProxyPool[Math.floor(Math.random() * customProxyPool.length)];
                logEntry(`Using custom proxy: ${proxyUrlToUse.split('@')[0]}`); // Mask credentials for custom
                launchOptions.proxy = { server: proxyUrlToUse };
                jobResult.proxyUsed = `Custom: ${proxyUrlToUse.split('@')[1] || proxyUrlToUse.split('//')[1] || 'details hidden'}`;
            } else if (actorProxyConfiguration) {
                const session = uuidv4(); // Unique session per job
                proxyUrlToUse = await actorProxyConfiguration.newUrl(session);
                logEntry(`Using Apify proxy (Session: ${session})`);
                launchOptions.proxy = { server: proxyUrlToUse };
                jobResult.proxyUsed = 'ApifyProxy';
            } else {
                logEntry('No proxies configured or available. Running directly.', 'warn');
            }
        }

        browser = await playwright.chromium.launch(launchOptions); // Using Actor.launchPlaywright might be better if Apify platform provides optimized versions
        
        // Create a new incognito context for each job
        context = await browser.newContext({
            bypassCSP: true,
            ignoreHTTPSErrors: true,
            viewport: { width: 1280 + Math.floor(Math.random() * 200), height: 720 + Math.floor(Math.random() * 100) }, // Slightly more variation
            locale: 'en-US',
            timezoneId: 'America/New_York', // Consider randomizing from a list or using input
            javaScriptEnabled: true,
            // userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${100 + Math.floor(Math.random()*10)}.0.0.0 Safari/537.36 Edg/${100 + Math.floor(Math.random()*10)}.0.1518.${Math.floor(Math.random()*20)+70}`
        });

        await applyAntiDetectionScripts(context);
        const page = await context.newPage();
        
        // Randomize viewport again slightly per page for more variability
        await page.setViewportSize({ 
            width: 1200 + Math.floor(Math.random() * 120), 
            height: 700 + Math.floor(Math.random() * 80) 
        });

        await page.goto(job.url, { timeout: effectiveInput.timeout * 1000, waitUntil: 'domcontentloaded' });
        logEntry(`Navigated to ${job.url}`);

        const watchResult = await watchVideoOnPage(page, job.platform, job, effectiveInput, {info: logEntry, warning: (m)=>logEntry(m,'warn'), debug:(m)=>logEntry(m,'debug'), error:(m,d)=>logEntry(m,'error',d)});
        
        Object.assign(jobResult, watchResult); // Merge results, watchResult.log is already handled by logEntry

    } catch (e) {
        logEntry(`Critical error in job ${job.url}: ${e.message}`, 'error');
        jobResult.status = 'failure';
        jobResult.error = e.message + (e.stack ? `\nStack: ${e.stack}` : '');
    } finally {
        if (page && !page.isClosed()) {
            await page.close().catch(e => jobScopedLogger.debug(`Error closing page: ${e.message}`));
        }
        if (context) {
            await context.close().catch(e => jobScopedLogger.debug(`Error closing context: ${e.message}`));
        }
        if (browser) {
            await browser.close().catch(e => jobScopedLogger.warning(`Error closing browser: ${e.message}`));
        }
        jobScopedLogger.info(`Finished job for ${job.url} with status: ${jobResult.status}`);
    }
    return jobResult;
}

async function actorMainLogic() {
    console.log('ACTOR_MAIN_LOGIC: Entered main logic function.');

    await Actor.init();
    console.log('ACTOR_MAIN_LOGIC: Actor.init() completed.');

    const actorLog = Actor.log; // Store in a variable for easier access
    if (!actorLog || typeof actorLog.info !== 'function') {
        console.error('ACTOR_MAIN_LOGIC: FATAL - Actor.log or Actor.log.info is not available after init. Exiting.');
        if (Actor.fail && typeof Actor.fail === 'function') {
            await Actor.fail('Actor.log not initialized.');
        }
        process.exit(1);
    }

    actorLog.info('Starting YouTube & Rumble View Bot Actor (Apify SDK v3 compatible).');

    const input = await Actor.getInput();
    actorLog.info('Actor input:', input || 'No input received, using defaults later.');

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
        skipAdsAfter: ["5", "10"],
        autoSkipAds: true,
        stopSpawningOnOverload: true,
        useAV1: true,
    };

    const effectiveInput = {
        ...defaultInput,
        ...(input || {}),
        skipAdsAfter: ((input && input.skipAdsAfter) || defaultInput.skipAdsAfter).map(s => parseInt(s,10)),
        videoUrls: (input && input.videoUrls && input.videoUrls.length > 0) ? input.videoUrls : defaultInput.videoUrls,
        proxyGroups: (input && input.proxyGroups && input.proxyGroups.length > 0) ? input.proxyGroups : defaultInput.proxyGroups,
    };
    
    if (!effectiveInput.videoUrls || effectiveInput.videoUrls.length === 0) {
        actorLog.error('No video URLs provided and no default. Exiting.');
        await Actor.fail('Missing videoUrls in input.');
        return;
    }
    
    actorLog.info('Effective input settings:', effectiveInput);

    let actorProxyConfiguration = null;
    if (effectiveInput.useProxies && (!effectiveInput.proxyUrls || effectiveInput.proxyUrls.length === 0)) {
        const proxyConfigOptions = {
            groups: effectiveInput.proxyGroups,
        };
        if (effectiveInput.proxyCountry && effectiveInput.proxyCountry.trim() !== "") {
            proxyConfigOptions.countryCode = effectiveInput.proxyCountry;
        }
        actorProxyConfiguration = await Actor.createProxyConfiguration(proxyConfigOptions);
        actorLog.info(`Apify Proxy Configuration created. Country: ${effectiveInput.proxyCountry || 'Any'}`);
    } else if (effectiveInput.useProxies && effectiveInput.proxyUrls && effectiveInput.proxyUrls.length > 0) {
        actorLog.info(`Using ${effectiveInput.proxyUrls.length} custom proxies.`);
    }

    const jobs = effectiveInput.videoUrls.map(url => {
        const videoId = extractVideoId(url);
        if (!videoId) {
            actorLog.warning(`Could not extract videoId from URL: ${url}. Skipping.`);
            return null;
        }
        const platform = url.includes('youtube.com') || url.includes('youtu.be') ? 'youtube' : (url.includes('rumble.com') ? 'rumble' : 'unknown');
        if (platform === 'unknown') {
             actorLog.warning(`Unknown platform for URL: ${url}. Skipping.`);
             return null;
        }
        return {
            id: uuidv4(),
            url,
            videoId,
            platform,
        };
    }).filter(job => job !== null);

    if (jobs.length === 0) {
        actorLog.error('No valid video URLs could be processed after filtering. Exiting.');
        await Actor.fail('No valid video URLs to process.');
        return;
    }
    actorLog.info(`Created ${jobs.length} valid jobs to process.`);
    
    const overallResults = {
        totalJobs: jobs.length,
        successfulJobs: 0,
        failedJobs: 0,
        details: [],
        startTime: new Date().toISOString(),
        endTime: null,
    };

    const activeWorkers = new Set();
    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];

        if (effectiveInput.stopSpawningOnOverload && typeof Actor.isAtCapacity === 'function') {
            const atCapacity = await Actor.isAtCapacity();
            if (atCapacity) {
                actorLog.warning('Actor is at capacity based on platform limits, pausing further job spawning for 30s.');
                await new Promise(resolve => setTimeout(resolve, 30000));
                if (await Actor.isAtCapacity()) {
                    actorLog.error('Actor remains at capacity. Stopping further job processing.');
                    break; 
                }
            }
        }
        
        while (activeWorkers.size >= effectiveInput.concurrency) {
            actorLog.debug(`Concurrency limit (${effectiveInput.concurrency}) reached. Waiting for a slot... Active: ${activeWorkers.size}`);
            await Promise.race(Array.from(activeWorkers));
        }

        const jobPromise = runSingleJob(job, effectiveInput, actorProxyConfiguration, effectiveInput.proxyUrls, actorLog)
            .then(async (result) => {
                overallResults.details.push(result);
                if (result.status === 'success') {
                    overallResults.successfulJobs++;
                } else {
                    overallResults.failedJobs++;
                }
                await Actor.pushData(result);
            })
            .catch(async (error) => {
                actorLog.error(`Unhandled promise rejection for job ${job.id}: ${error.message}`, { stack: error.stack });
                const errorResult = {
                    jobId: job.id,
                    url: job.url,
                    videoId: job.videoId,
                    platform: job.platform,
                    status: 'catastrophic_failure_in_main_loop',
                    error: error.message,
                    stack: error.stack,
                    log: [`[${new Date().toISOString()}] [ERROR] Unhandled promise rejection: ${error.message}`]
                };
                overallResults.details.push(errorResult);
                overallResults.failedJobs++;
                await Actor.pushData(errorResult);
            })
            .finally(() => {
                activeWorkers.delete(jobPromise);
                actorLog.info(`Worker slot freed. Active workers: ${activeWorkers.size}. Completed job ID ${job.id.substring(0,6)}`);
            });

        activeWorkers.add(jobPromise);
        actorLog.info(`Job ${job.id.substring(0,6)} (${i + 1}/${jobs.length}) dispatched. Active workers: ${activeWorkers.size}`);

        if (effectiveInput.concurrencyInterval > 0 && i < jobs.length - 1 && activeWorkers.size < effectiveInput.concurrency) {
            actorLog.debug(`Waiting for concurrency interval: ${effectiveInput.concurrencyInterval}s`);
            await new Promise(resolve => setTimeout(resolve, effectiveInput.concurrencyInterval * 1000));
        }
    }

    actorLog.info(`All jobs dispatched. Waiting for ${activeWorkers.size} active workers to complete...`);
    await Promise.all(Array.from(activeWorkers));

    overallResults.endTime = new Date().toISOString();
    actorLog.info('All jobs processed. Final results:', overallResults);
    await Actor.setValue('RESULTS', overallResults);
    await Actor.exit();
}

Actor.main(actorMainLogic);
