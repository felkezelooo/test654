const { Actor } = require('apify');
const playwright = require('playwright');
const { v4: uuidv4 } = require('uuid');
const { ProxyChain } = require('proxy-chain'); // Though likely not needed if Playwright handles proxies directly

const ANTI_DETECTION_ARGS = [
    '--disable-blink-features=AutomationControlled',
    '--disable-features=IsolateOrigins,site-per-process,ImprovedCookieControls,LazyFrameLoading,GlobalMediaControls,DestroyProfileOnBrowserClose,MediaRouter,DialMediaRouteProvider,AcceptCHFrame,AutoExpandDetailsElement,CertificateTransparencyEnforcement,AvoidUnnecessaryBeforeUnloadCheckSync,Translate',
    '--disable-component-extensions-with-background-pages',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-site-isolation-trials',
    '--disable-sync',
    '--enable-automation', // Often removed for anti-detection, but Playwright might need it. Test this.
    '--force-webrtc-ip-handling-policy=default_public_interface_only', // Mask WebRTC IP
    '--no-first-run',
    '--no-service-autorun',
    '--password-store=basic',
    '--use-mock-keychain',
    '--enable-precise-memory-info'
];

async function applyAntiDetectionScripts(page) {
    await page.evaluateOnNewDocument(() => {
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
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function (parameter) {
                // Spoof vendor and renderer
                if (parameter === 37445) return 'Google Inc. (Intel)'; // WEBGL_debug_renderer_info VENDOR
                if (parameter === 37446) return 'ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics 640, OpenGL 4.1)'; // WEBGL_debug_renderer_info RENDERER
                return getParameter.apply(this, arguments);
            };
        } catch (e) {
            console.warn('Error modifying WebGL fingerprint:', e.message);
        }

        // Modify Canvas fingerprint
        try {
            const toDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function() {
                // Add slight noise, can be more sophisticated
                const shift = {
                    'r': Math.floor(Math.random() * 10) - 5,
                    'g': Math.floor(Math.random() * 10) - 5,
                    'b': Math.floor(Math.random() * 10) - 5,
                    'a': Math.floor(Math.random() * 10) - 5
                };
                constlesssim = this.getContext('2d');
                if (lesssim) {
                    const imageData = lesssim.getImageData(0, 0, this.width, this.height);
                    for (let i = 0; i < imageData.data.length; i += 4) {
                        imageData.data[i] = imageData.data[i] + shift.r;
                        imageData.data[i+1] = imageData.data[i+1] + shift.g;
                        imageData.data[i+2] = imageData.data[i+2] + shift.b;
                        imageData.data[i+3] = imageData.data[i+3] + shift.a;
                    }
                    lesssim.putImageData(imageData,0,0);
                }
                return toDataURL.apply(this, arguments);
            };
        } catch (e) {
            console.warn('Error modifying Canvas fingerprint:', e.message);
        }

        // Override permissions
        if (navigator.permissions && typeof navigator.permissions.query === 'function') {
            const originalQuery = navigator.permissions.query;
            navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
        }

        // Spoof screen resolution and color depth
        if (window.screen) {
            Object.defineProperty(window.screen, 'availWidth', { get: () => 1920 });
            Object.defineProperty(window.screen, 'availHeight', { get: () => 1080 });
            Object.defineProperty(window.screen, 'width', { get: () => 1920 });
            Object.defineProperty(window.screen, 'height', { get: () => 1080 });
            Object.defineProperty(window.screen, 'colorDepth', { get: () => 24 });
            Object.defineProperty(window.screen, 'pixelDepth', { get: () => 24 });
        }
        
        // Spoof timezone
        try {
            Date.prototype.getTimezoneOffset = function() { return - (new Date().getTimezoneOffset()); }; // Example: UTC
        } catch (e) {
             console.warn('Error modifying timezone:', e.message);
        }

    });
}

function extractVideoId(url) {
    try {
        const urlObj = new URL(url);
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return urlObj.searchParams.get('v') || urlObj.pathname.substring(1);
        } else if (url.includes('rumble.com')) {
            const pathParts = urlObj.pathname.split('/');
            // Rumble video IDs are often in the format like "v2j3hyu-example-video.html"
            // We want the "v2j3hyu" part or the full filename.
            const lastPart = pathParts[pathParts.length - 1];
            return lastPart.split('-')[0] || lastPart; // Prefer the part before '-' or full if no '-'
        }
    } catch (error) {
        Actor.log.warning(`Error extracting video ID from URL ${url}: ${error.message}`);
    }
    return null;
}

async function getVideoDuration(page) {
    Actor.log.info('Attempting to get video duration.');
    for (let i = 0; i < 10; i++) { // Try for a few seconds
        const duration = await page.evaluate(() => {
            const video = document.querySelector('video');
            return video ? video.duration : null;
        });
        if (duration && duration !== Infinity && duration > 0) {
            Actor.log.info(`Video duration found: ${duration} seconds.`);
            return duration;
        }
        await page.waitForTimeout(1000);
    }
    Actor.log.warning('Could not determine video duration after 10 seconds.');
    return null; // Or a default duration if appropriate
}

async function clickIfExists(page, selector, timeout = 2000) {
    try {
        await page.waitForSelector(selector, { state: 'visible', timeout });
        await page.click(selector);
        Actor.log.info(`Clicked on selector: ${selector}`);
        return true;
    } catch (e) {
        // Actor.log.debug(`Selector not found or not clickable: ${selector}`);
        return false;
    }
}

async function handleAds(page, platform, effectiveInput) {
    Actor.log.info('Starting ad handling logic.');
    const adCheckInterval = 5000; // Check for ads every 5 seconds
    let adWatchLoop = 0; // safety break for loop
    const maxAdLoopIterations = (effectiveInput.maxSecondsAds * 1000 / adCheckInterval) + 5; // Max iterations for ad watching

    while (adWatchLoop < maxAdLoopIterations) {
        adWatchLoop++;
        let isAdPlaying = false;
        let adDuration = 0;
        let adCurrentTime = 0;
        let canSkip = false;

        if (platform === 'youtube') {
            isAdPlaying = await page.locator('.ytp-ad-player-overlay-instream-info, .video-ads .ad-showing').isVisible();
            if (isAdPlaying) {
                Actor.log.info('YouTube ad detected.');
                canSkip = await page.locator('.ytp-ad-skip-button-modern, .ytp-ad-skip-button').isVisible();
                // Simplified ad duration/currentTime for now as it's hard to get accurately
                adDuration = await page.evaluate(() => document.querySelector('.ytp-ad-duration-remaining')?.textContent.split(':').reduce((acc,time) => (60 * acc) + +time) || 30);
                adCurrentTime = await page.evaluate(() => document.querySelector('.ytp-ad-progress-list')?.children.length * 5 || 0); // rough estimate
            }
        } else if (platform === 'rumble') {
            // Rumble ad detection logic (example, needs verification)
            isAdPlaying = await page.locator('.video-ad-indicator, .ima-ad-container *:not([style*="display: none"])').isVisible({timeout:1000}).catch(()=>false);
             if (isAdPlaying) {
                Actor.log.info('Rumble ad detected.');
                canSkip = await page.locator('button[aria-label*="Skip Ad"], div[class*="skip-button"]').isVisible({timeout:1000}).catch(()=>false);
             }
        }

        if (!isAdPlaying) {
            Actor.log.info('No ad currently playing.');
            break; // No ad, proceed with video
        }

        const minSkipTime = Array.isArray(effectiveInput.skipAdsAfter) && effectiveInput.skipAdsAfter.length > 0 ? parseInt(effectiveInput.skipAdsAfter[0], 10) : 5;
        const maxAdWatchTime = effectiveInput.maxSecondsAds;

        if (effectiveInput.autoSkipAds && canSkip) {
            Actor.log.info('Attempting to skip ad (autoSkipAds).');
            await clickIfExists(page, '.ytp-ad-skip-button-modern, .ytp-ad-skip-button, button[aria-label*="Skip Ad"], div[class*="skip-button"]');
            await page.waitForTimeout(1000); // wait for ad to disappear
            continue;
        }

        if (adCurrentTime >= minSkipTime && canSkip) {
            Actor.log.info(`Ad has played for ${adCurrentTime}s, attempting to skip (skipAdsAfter).`);
            await clickIfExists(page, '.ytp-ad-skip-button-modern, .ytp-ad-skip-button, button[aria-label*="Skip Ad"], div[class*="skip-button"]');
            await page.waitForTimeout(1000);
            continue;
        }
        
        if (adCurrentTime >= maxAdWatchTime) {
             Actor.log.info(`Ad has played for ${adCurrentTime}s (maxSecondsAds reached), attempting to skip if possible.`);
             if (canSkip) {
                await clickIfExists(page, '.ytp-ad-skip-button-modern, .ytp-ad-skip-button, button[aria-label*="Skip Ad"], div[class*="skip-button"]');
             } else {
                Actor.log.info('Max ad watch time reached, but cannot skip yet.');
             }
             // If still cannot skip, we might be stuck or need to wait longer if canSkip is false
        }

        await page.waitForTimeout(adCheckInterval);
    }
    if (adWatchLoop >= maxAdLoopIterations) {
        Actor.log.warning('Max ad loop iterations reached. Proceeding with video watching.');
    }
    Actor.log.info('Ad handling finished.');
}


async function watchVideoOnPage(page, platform, job, effectiveInput) {
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
    };

    try {
        // Initial ad handling
        await handleAds(page, platform, effectiveInput);

        // Try to play the video
        Actor.log.info(`Attempting to play video: ${job.url}`);
        if (platform === 'youtube') {
            await clickIfExists(page, '.ytp-large-play-button', 5000); // Click large play button
            await clickIfExists(page, 'video, .html5-main-video', 5000); // Click video player itself
        } else if (platform === 'rumble') {
            await clickIfExists(page, '.rumbles-player-play-button, video', 5000);
        }
        
        // Ensure video is unmuted (some sites auto-mute)
        await page.evaluate(() => {
            const video = document.querySelector('video');
            if (video) video.muted = false;
        }).catch(e => Actor.log.debug(`Could not unmute video: ${e.message}`));


        const duration = await getVideoDuration(page);
        if (!duration) {
            throw new Error('Could not determine video duration.');
        }
        jobResult.durationFoundSec = duration;

        const targetWatchTimeSec = Math.floor(duration * (effectiveInput.watchTimePercentage / 100));
        jobResult.watchTimeRequestedSec = targetWatchTimeSec;
        Actor.log.info(`Target watch time: ${targetWatchTimeSec} seconds for video of ${duration}s.`);

        let currentActualWatchTime = 0;
        const watchInterval = 5000; // Check every 5 seconds
        const maxWatchLoops = Math.ceil(targetWatchTimeSec / (watchInterval / 1000)) + 10; // safety margin

        for (let i = 0; i < maxWatchLoops; i++) {
            // Ad check during playback
            await handleAds(page, platform, effectiveInput);

            const videoState = await page.evaluate(() => {
                const video = document.querySelector('video');
                return video ? { currentTime: video.currentTime, paused: video.paused, ended: video.ended } : null;
            });

            if (!videoState) {
                throw new Error('Video element disappeared or not found during watch.');
            }

            if (videoState.paused) {
                Actor.log.info('Video is paused, attempting to play.');
                await clickIfExists(page, 'video, .html5-main-video, .ytp-play-button', 2000);
            }
            
            currentActualWatchTime = videoState.currentTime;
            jobResult.watchTimeActualSec = currentActualWatchTime;
             Actor.log.info(`Current watch time: ${currentActualWatchTime.toFixed(2)}s / ${targetWatchTimeSec}s`);


            if (currentActualWatchTime >= targetWatchTimeSec || videoState.ended) {
                Actor.log.info(`Target watch time reached or video ended. Actual: ${currentActualWatchTime.toFixed(2)}s`);
                break;
            }
            
            // Simulate some activity
            if (i % 6 === 0) { // every 30 seconds
                 await page.mouse.move(Math.random() * 500, Math.random() * 300).catch(()=>{});
            }

            await page.waitForTimeout(watchInterval);
        }
        
        if (currentActualWatchTime < targetWatchTimeSec) {
            Actor.log.warning(`Watched ${currentActualWatchTime.toFixed(2)}s, less than target ${targetWatchTimeSec}s.`);
        }

        jobResult.status = 'success';

    } catch (e) {
        Actor.log.error(`Error watching video ${job.url}: ${e.message}`);
        jobResult.status = 'failure';
        jobResult.error = e.message + (e.stack ? `\nStack: ${e.stack}` : '');
    } finally {
        jobResult.endTime = new Date().toISOString();
    }
    return jobResult;
}


async function runSingleJob(job, effectiveInput, actorProxyConfiguration, customProxyPool) {
    Actor.log.info(`Starting job ${job.id} for URL: ${job.url}`);
    let browser;
    let proxyUrlToUse = null;
    let anonymizedProxyUrl = null; // For proxy-chain

    const jobResult = {
        jobId: job.id,
        url: job.url,
        videoId: job.videoId,
        platform: job.platform,
        proxyUsed: null,
        status: 'initiated',
        error: null,
    };

    try {
        const launchOptions = {
            headless: effectiveInput.headless,
            args: [...ANTI_DETECTION_ARGS],
        };

        if (effectiveInput.useProxies) {
            if (customProxyPool && customProxyPool.length > 0) {
                proxyUrlToUse = customProxyPool[Math.floor(Math.random() * customProxyPool.length)];
                Actor.log.info(`Using custom proxy for job ${job.id}: ${proxyUrlToUse.split('@')[1] || proxyUrlToUse}`); // Hide credentials
                // If proxy-chain is needed for custom proxies (e.g. to hide upstream)
                // anonymizedProxyUrl = await ProxyChain.anonymizeProxy(proxyUrlToUse);
                // launchOptions.proxy = { server: anonymizedProxyUrl };
                launchOptions.proxy = { server: proxyUrlToUse }; // Direct usage
                jobResult.proxyUsed = proxyUrlToUse.includes('@') ? proxyUrlToUse.split('@')[1] : proxyUrlToUse;

            } else if (actorProxyConfiguration) {
                const session = Actor.getDefaultInstance().isInsideExecution ? Actor.getApifyProxySession() : uuidv4(); // Create a session for proxy rotation per job
                proxyUrlToUse = await actorProxyConfiguration.newUrl(session);
                Actor.log.info(`Using Apify proxy for job ${job.id}: ${proxyUrlToUse.split('@')[1] || proxyUrlToUse}`);
                launchOptions.proxy = { server: proxyUrlToUse };
                jobResult.proxyUsed = 'ApifyProxy';
            } else {
                Actor.log.info(`No proxies configured or available for job ${job.id}. Running directly.`);
            }
        }


        browser = await Actor.launchPlaywright(launchOptions);
        const context = await browser.newContext({
            bypassCSP: true,
            ignoreHTTPSErrors: true, // Be cautious with this
            viewport: { width: 1280 + Math.floor(Math.random() * 100), height: 720 + Math.floor(Math.random() * 100) },
            locale: 'en-US', // Consistent locale
            timezoneId: 'America/New_York', // Example timezone
            javaScriptEnabled: true,
            userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36 Edg/${Math.floor(Math.random() * 10) + 100}.0.1518.8` // Randomize Edge version
        });

        await applyAntiDetectionScripts(context); // Apply to context for all new pages
        const page = await context.newPage();
        
        await page.goto(job.url, { timeout: effectiveInput.timeout * 1000, waitUntil: 'domcontentloaded' });

        const watchResult = await watchVideoOnPage(page, job.platform, job, effectiveInput);
        
        // Merge watchResult into jobResult
        for (const key in watchResult) {
            if (watchResult.hasOwnProperty(key)) {
                jobResult[key] = watchResult[key];
            }
        }


    } catch (e) {
        Actor.log.error(`Error in job ${job.id} for ${job.url}: ${e.message}`);
        jobResult.status = 'failure';
        jobResult.error = e.message + (e.stack ? `\nStack: ${e.stack}` : '');
    } finally {
        if (browser) {
            await browser.close().catch(e => Actor.log.warning(`Error closing browser: ${e.message}`));
        }
        if (anonymizedProxyUrl) {
            // await ProxyChain.closeAnonymizedProxy(anonymizedProxyUrl, true); // If using proxy-chain
        }
        Actor.log.info(`Finished job ${job.id} for ${job.url} with status: ${jobResult.status}`);
    }
    return jobResult;
}


Actor.main(async () => {
    await Actor.init();
    Actor.log.info('Starting YouTube & Rumble View Bot Actor (Apify SDK v3 compatible).');

    const input = await Actor.getInput();
    Actor.log.info('Actor input:', input);

    if (!input || !input.videoUrls || !Array.isArray(input.videoUrls) || input.videoUrls.length === 0) {
        Actor.log.error('No video URLs provided in input. Exiting.');
        await Actor.pushData({
            status: 'error',
            message: 'No video URLs provided in input. Please provide at least one video URL to watch.',
        });
        await Actor.fail('Missing videoUrls in input.');
        return;
    }
    
    const effectiveInput = { // Merge defaults with input
        videoUrls: input.videoUrls,
        watchTimePercentage: input.watchTimePercentage || 80,
        useProxies: typeof input.useProxies === 'boolean' ? input.useProxies : true,
        proxyUrls: input.proxyUrls || [],
        proxyCountry: input.proxyCountry || null, // null or empty for "any country"
        proxyGroups: input.proxyGroups || ['RESIDENTIAL'],
        headless: typeof input.headless === 'boolean' ? input.headless : true,
        concurrency: input.concurrency || 5,
        concurrencyInterval: input.concurrencyInterval || 5, // seconds
        timeout: input.timeout || 120, // seconds
        maxSecondsAds: input.maxSecondsAds || 15,
        skipAdsAfter: (input.skipAdsAfter || ["5", "10"]).map(s => parseInt(s,10)),
        autoSkipAds: typeof input.autoSkipAds === 'boolean' ? input.autoSkipAds : true,
        stopSpawningOnOverload: typeof input.stopSpawningOnOverload === 'boolean' ? input.stopSpawningOnOverload : true,
        // disableProxyTests: input.disableProxyTests || false, // Apify handles proxy health for its own proxies
        useAV1: typeof input.useAV1 === 'boolean' ? input.useAV1 : true, // AV1 handling may need specific browser flags not easily set here
    };
    Actor.log.info('Effective input settings:', effectiveInput);


    let actorProxyConfiguration = null;
    if (effectiveInput.useProxies && (!effectiveInput.proxyUrls || effectiveInput.proxyUrls.length === 0)) {
        const proxyConfigOptions = {
            groups: effectiveInput.proxyGroups,
        };
        if (effectiveInput.proxyCountry) {
            proxyConfigOptions.countryCode = effectiveInput.proxyCountry;
        }
        actorProxyConfiguration = await Actor.createProxyConfiguration(proxyConfigOptions);
        Actor.log.info(`Apify Proxy Configuration created. Country: ${effectiveInput.proxyCountry || 'Any'}`);
    } else if (effectiveInput.useProxies && effectiveInput.proxyUrls && effectiveInput.proxyUrls.length > 0) {
        Actor.log.info(`Using ${effectiveInput.proxyUrls.length} custom proxies.`);
    }


    const jobs = effectiveInput.videoUrls.map(url => {
        const videoId = extractVideoId(url);
        return {
            id: uuidv4(),
            url,
            videoId: videoId || `unknown-${uuidv4()}`, // Fallback if ID extraction fails
            platform: url.includes('youtube.com') || url.includes('youtu.be') ? 'youtube' : (url.includes('rumble.com') ? 'rumble' : 'unknown'),
            // Other job-specific data can be added here
        };
    }).filter(job => job.videoId && job.platform !== 'unknown');

    if (jobs.length === 0) {
        Actor.log.error('No valid video URLs could be processed. Exiting.');
        await Actor.fail('No valid video URLs to process.');
        return;
    }
    Actor.log.info(`Created ${jobs.length} jobs to process.`);
    
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

        if (effectiveInput.stopSpawningOnOverload && Actor.isAtCapacity && await Actor.isAtCapacity()) {
            Actor.log.warning('Actor is at capacity based on platform limits, pausing further job spawning for 30s.');
            await new Promise(resolve => setTimeout(resolve, 30000));
            // Re-check capacity before continuing the loop or decide to break
            if (await Actor.isAtCapacity()) {
                Actor.log.error('Actor remains at capacity. Stopping further job processing.');
                break; 
            }
        }
        
        while (activeWorkers.size >= effectiveInput.concurrency) {
            Actor.log.debug(`Concurrency limit (${effectiveInput.concurrency}) reached. Waiting for a slot...`);
            await Promise.race(Array.from(activeWorkers));
        }

        const jobPromise = runSingleJob(job, effectiveInput, actorProxyConfiguration, effectiveInput.proxyUrls)
            .then(async (result) => {
                overallResults.details.push(result);
                if (result.status === 'success') {
                    overallResults.successfulJobs++;
                } else {
                    overallResults.failedJobs++;
                }
                await Actor.pushData(result); // Push individual job result
            })
            .catch(async (error) => {
                Actor.log.error(`Unhandled error for job ${job.id}: ${error.message}`, { stack: error.stack });
                const errorResult = {
                    jobId: job.id,
                    url: job.url,
                    status: 'catastrophic_failure',
                    error: error.message,
                    stack: error.stack
                };
                overallResults.details.push(errorResult);
                overallResults.failedJobs++;
                await Actor.pushData(errorResult);
            })
            .finally(() => {
                activeWorkers.delete(jobPromise);
                Actor.log.info(`Worker slot freed. Active workers: ${activeWorkers.size}`);
            });

        activeWorkers.add(jobPromise);
        Actor.log.info(`Job ${job.id} (${i + 1}/${jobs.length}) dispatched. Active workers: ${activeWorkers.size}`);

        if (effectiveInput.concurrencyInterval > 0 && i < jobs.length - 1) {
            Actor.log.debug(`Waiting for concurrency interval: ${effectiveInput.concurrencyInterval}s`);
            await new Promise(resolve => setTimeout(resolve, effectiveInput.concurrencyInterval * 1000));
        }
    }

    await Promise.all(Array.from(activeWorkers)); // Wait for all remaining jobs to complete

    overallResults.endTime = new Date().toISOString();
    Actor.log.info('All jobs processed. Final results:', overallResults);
    await Actor.setValue('RESULTS', overallResults);

    await Actor.exit();
});
