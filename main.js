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

// --- NEW HELPER FUNCTIONS ---
function getTimezoneForProxy(proxyCountry, useProxiesSetting) {
    if (!useProxiesSetting || !proxyCountry) {
        // Default fallback if not using proxies or no country specified
        (GlobalLogger || console).debug('[GeoHelper] No proxy country or proxies not used, defaulting timezone to America/New_York.');
        return 'America/New_York';
    }

    const countryToTimezone = {
        'US': 'America/New_York', 'GB': 'Europe/London', 'DE': 'Europe/Berlin', 'FR': 'Europe/Paris',
        'CA': 'America/Toronto', 'AU': 'Australia/Sydney', 'JP': 'Asia/Tokyo', 'BR': 'America/Sao_Paulo',
        'IN': 'Asia/Kolkata', 'RU': 'Europe/Moscow', 'IT': 'Europe/Rome', 'ES': 'Europe/Madrid',
        'NL': 'Europe/Amsterdam', 'SE': 'Europe/Stockholm', 'NO': 'Europe/Oslo', 'PL': 'Europe/Warsaw',
        'MX': 'America/Mexico_City', 'AR': 'America/Argentina/Buenos_Aires', 'ZA': 'Africa/Johannesburg',
        'SG': 'Asia/Singapore', 'HK': 'Asia/Hong_Kong', 'KR': 'Asia/Seoul', 'TH': 'Asia/Bangkok',
        'MY': 'Asia/Kuala_Lumpur', 'ID': 'Asia/Jakarta', 'PH': 'Asia/Manila', 'VN': 'Asia/Ho_Chi_Minh',
        'TR': 'Europe/Istanbul', 'AE': 'Asia/Dubai', 'SA': 'Asia/Riyadh', 'EG': 'Africa/Cairo',
        'NG': 'Africa/Lagos', 'KE': 'Africa/Nairobi', 'GH': 'Africa/Accra', 'NZ': 'Pacific/Auckland',
        'FI': 'Europe/Helsinki', 'DK': 'Europe/Copenhagen', 'CH': 'Europe/Zurich', 'AT': 'Europe/Vienna',
        'BE': 'Europe/Brussels', 'CZ': 'Europe/Prague', 'HU': 'Europe/Budapest', 'RO': 'Europe/Bucharest',
        'BG': 'Europe/Sofia', 'HR': 'Europe/Zagreb', 'SI': 'Europe/Ljubljana', 'SK': 'Europe/Bratislava',
        'LT': 'Europe/Vilnius', 'LV': 'Europe/Riga', 'EE': 'Europe/Tallinn', 'IE': 'Europe/Dublin',
        'PT': 'Europe/Lisbon', 'GR': 'Europe/Athens', 'CY': 'Europe/Nicosia', 'MT': 'Europe/Malta',
        'LU': 'Europe/Luxembourg', 'IS': 'Atlantic/Reykjavik', 'CL': 'America/Santiago',
        'PE': 'America/Lima', 'CO': 'America/Bogota', 'VE': 'America/Caracas', 'EC': 'America/Guayaquil',
        'UY': 'America/Montevideo', 'PY': 'America/Asuncion', 'BO': 'America/La_Paz',
        'CR': 'America/Costa_Rica', 'PA': 'America/Panama', 'GT': 'America/Guatemala',
        'SV': 'America/El_Salvador', 'HN': 'America/Tegucigalpa', 'NI': 'America/Managua',
        'BZ': 'America/Belize', 'JM': 'America/Jamaica', 'CU': 'America/Havana',
        'DO': 'America/Santo_Domingo', 'PR': 'America/Puerto_Rico', 'TT': 'America/Port_of_Spain',
        'BB': 'America/Barbados', 'GY': 'America/Guyana', 'SR': 'America/Paramaribo',
        'FK': 'Atlantic/Stanley'
    };

    const timezone = countryToTimezone[proxyCountry.toUpperCase()];
    if (timezone) {
        (GlobalLogger || console).debug(`[GeoHelper] Mapped proxyCountry '${proxyCountry}' to timezone '${timezone}'.`);
        return timezone;
    }
    (GlobalLogger || console).debug(`[GeoHelper] ProxyCountry '${proxyCountry}' not in map, defaulting timezone to America/New_York.`);
    return 'America/New_York'; // Safe default
}

function getLocaleForCountry(countryCode) {
    if (!countryCode) {
        (GlobalLogger || console).debug('[GeoHelper] No country code for locale, defaulting to en-US.');
        return 'en-US';
    }
    const countryToLocale = {
        'US': 'en-US', 'GB': 'en-GB', 'DE': 'de-DE', 'FR': 'fr-FR', 'CA': 'en-CA', 'AU': 'en-AU',
        'JP': 'ja-JP', 'BR': 'pt-BR', 'IN': 'en-IN', 'RU': 'ru-RU', 'IT': 'it-IT', 'ES': 'es-ES',
        'NL': 'nl-NL', 'SE': 'sv-SE', 'NO': 'no-NO', 'PL': 'pl-PL', 'MX': 'es-MX', 'AR': 'es-AR',
        'ZA': 'en-ZA', 'SG': 'en-SG', 'HK': 'zh-HK', 'KR': 'ko-KR', 'TH': 'th-TH', 'MY': 'ms-MY',
        'ID': 'id-ID', 'PH': 'en-PH', 'VN': 'vi-VN', 'TR': 'tr-TR', 'AE': 'ar-AE', 'SA': 'ar-SA',
        'EG': 'ar-EG', 'NG': 'en-NG', 'KE': 'en-KE', 'GH': 'en-GH', 'NZ': 'en-NZ', 'FI': 'fi-FI',
        'DK': 'da-DK', 'CH': 'de-CH', 'AT': 'de-AT', 'BE': 'nl-BE', 'CZ': 'cs-CZ', 'HU': 'hu-HU',
        'RO': 'ro-RO', 'BG': 'bg-BG', 'HR': 'hr-HR', 'SI': 'sl-SI', 'SK': 'sk-SK', 'LT': 'lt-LT',
        'LV': 'lv-LV', 'EE': 'et-EE', 'IE': 'en-IE', 'PT': 'pt-PT', 'GR': 'el-GR', 'CY': 'el-CY',
        'MT': 'mt-MT', 'LU': 'fr-LU', 'IS': 'is-IS'
        // Note: For countries with multiple common locales (e.g. CH, CA, BE), one primary is chosen.
    };
    const locale = countryToLocale[countryCode.toUpperCase()];
    if (locale) {
        (GlobalLogger || console).debug(`[GeoHelper] Mapped countryCode '${countryCode}' to locale '${locale}'.`);
        return locale;
    }
    (GlobalLogger || console).debug(`[GeoHelper] CountryCode '${countryCode}' not in locale map, defaulting to en-US.`);
    return 'en-US';
}

function getYouTubeSearchUrl(keyword, countryCode, detectedLocale) {
    const gl = (countryCode || 'US').toUpperCase(); // Geographic location parameter for YouTube
    const hl = detectedLocale.replace('_', '-'); // Language and regional setting, e.g., en-GB
    (GlobalLogger || console).debug(`[GeoHelper] YouTube Search URL params: gl=${gl}, hl=${hl} for keyword "${keyword}"`);
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}&gl=${gl}&hl=${hl}`;
}
// --- END NEW HELPER FUNCTIONS ---

async function applyAntiDetectionScripts(pageOrContext, detectedTimezoneId) {
    // This entire function (antiDetectionFunctionInBrowser) is serialized and executed in the browser context.
    // It receives the detectedTimezoneId from Node.js as `tzId`.
    const antiDetectionFunctionInBrowser = (tzId) => {
        // Spoof navigator.webdriver
        if (navigator.webdriver === true) Object.defineProperty(navigator, 'webdriver', { get: () => false });

        // Spoof navigator.languages and navigator.language (remains hardcoded to en-US for now, as per original script)
        // Note: The browser context's locale (set via newContext({locale: detectedLocale})) will primarily govern navigator.language.
        // This explicit spoof might override it or be redundant. For full consistency, this part could also use detectedLocale if passed.
        if (navigator.languages && !navigator.languages.includes('en-US')) Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        if (navigator.language !== 'en-US') Object.defineProperty(navigator, 'language', { get: () => 'en-US' });

        // Dynamic Timezone Spoofing
        const getOffsetForTargetTimezone = (targetTimezoneIdString) => {
            try {
                const now = new Date();
                const utcTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000)); // Current time as UTC
                // Get string representation of this UTC time, formatted as if it's in the target timezone
                const timeInTargetZoneStr = utcTime.toLocaleString("en-US", {timeZone: targetTimezoneIdString});
                // Convert this string back to a Date object. This Date's "local" time is effectively the target timezone's current time.
                const timeInTargetZone = new Date(timeInTargetZoneStr);
                // Calculate offset in minutes. Positive if local is behind UTC (e.g., America), negative if ahead.
                const offsetMinutes = (utcTime.getTime() - timeInTargetZone.getTime()) / 60000;
                return Math.round(offsetMinutes);
            } catch (e) {
                console.debug('[AntiDetection] Failed to calculate dynamic timezone offset for spoofing, using 0 (UTC):', e.message, targetTimezoneIdString);
                return 0; // Fallback to UTC
            }
        };
        const targetOffsetMinutes = getOffsetForTargetTimezone(tzId); // tzId is the detectedTimezoneId passed from Node.js
        try {
            Date.prototype.getTimezoneOffset = function() { return targetOffsetMinutes; };
        } catch (e) { console.debug('[AntiDetection] Failed to spoof Date.prototype.getTimezoneOffset:', e.message); }

        // WebGL Spoofing
        try {
            const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function (parameter) {
                if (this.canvas && this.canvas.id === 'webgl-fingerprint-canvas') return originalGetParameter.apply(this, arguments);
                if (parameter === 37445) return 'Google Inc. (Intel)'; // UNMASKED_VENDOR_WEBGL
                if (parameter === 37446) return 'ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics 640, OpenGL 4.1)'; // UNMASKED_RENDERER_WEBGL
                return originalGetParameter.apply(this, arguments);
            };
        } catch (e) { console.debug('[AntiDetection] Failed WebGL spoof:', e.message); }

        // Canvas Spoofing
        try {
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function() {
                if (this.id === 'canvas-fingerprint-element') return originalToDataURL.apply(this, arguments); // Bypass for known elements
                const shift = {
                    r: Math.floor(Math.random()*10)-5, g: Math.floor(Math.random()*10)-5,
                    b: Math.floor(Math.random()*10)-5, a: Math.floor(Math.random()*10)-5
                };
                const ctx = this.getContext('2d');
                if (ctx && this.width > 0 && this.height > 0) {
                    try {
                        const imageData = ctx.getImageData(0,0,this.width,this.height);
                        for(let i=0; i<imageData.data.length; i+=4){
                            imageData.data[i]   = Math.min(255,Math.max(0,imageData.data[i]   + shift.r));
                            imageData.data[i+1] = Math.min(255,Math.max(0,imageData.data[i+1] + shift.g));
                            imageData.data[i+2] = Math.min(255,Math.max(0,imageData.data[i+2] + shift.b));
                            imageData.data[i+3] = Math.min(255,Math.max(0,imageData.data[i+3] + shift.a));
                        }
                        ctx.putImageData(imageData,0,0);
                    } catch(e) { console.debug('[AntiDetection] Failed Canvas noise application:', e.message); }
                }
                return originalToDataURL.apply(this, arguments);
            };
        } catch (e) { console.debug('[AntiDetection] Failed Canvas spoof setup:', e.message); }

        // Permissions Spoofing (Notifications)
        if (navigator.permissions && typeof navigator.permissions.query === 'function') {
            const originalPermissionsQuery = navigator.permissions.query;
            navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications'
                    ? Promise.resolve({ state: Notification.permission || 'prompt' })
                    : originalPermissionsQuery.call(navigator.permissions, parameters)
            );
        }

        // Screen Spoofing (Hardcoded values from original script)
        if (window.screen) {
            try {
                Object.defineProperty(window.screen, 'availWidth', { get: () => 1920, configurable: true });
                Object.defineProperty(window.screen, 'availHeight', { get: () => 1080, configurable: true });
                Object.defineProperty(window.screen, 'width', { get: () => 1920, configurable: true });
                Object.defineProperty(window.screen, 'height', { get: () => 1080, configurable: true });
                Object.defineProperty(window.screen, 'colorDepth', { get: () => 24, configurable: true });
                Object.defineProperty(window.screen, 'pixelDepth', { get: () => 24, configurable: true });
            } catch (e) { console.debug('[AntiDetection] Failed screen spoof:', e.message); }
        }

        // Plugins and MimeTypes Spoofing (Empty arrays)
        if (navigator.plugins) try { Object.defineProperty(navigator, 'plugins', { get: () => [], configurable: true }); } catch(e) { console.debug('[AntiDetection] Failed plugin spoof:', e.message); }
        if (navigator.mimeTypes) try { Object.defineProperty(navigator, 'mimeTypes', { get: () => [], configurable: true }); } catch(e) { console.debug('[AntiDetection] Failed mimeType spoof:', e.message); }
    }; // End of antiDetectionFunctionInBrowser

    (GlobalLogger || console).debug(`[AntiDetection] Injecting anti-detection script with dynamic timezoneId: ${detectedTimezoneId}`);

    if (pageOrContext.addInitScript) {
        await pageOrContext.addInitScript(antiDetectionFunctionInBrowser, detectedTimezoneId);
    } else if (pageOrContext.evaluateOnNewDocument) { // Fallback, though addInitScript is preferred and usually available
        const scriptString = `(${antiDetectionFunctionInBrowser.toString()})(${JSON.stringify(detectedTimezoneId)});`;
        await pageOrContext.evaluateOnNewDocument(scriptString);
    } else {
        (GlobalLogger || console).warning('[AntiDetection] Could not inject anti-detection script: No suitable method on pageOrContext.');
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

async function clickIfExists(pageOrFrame, selector, timeout = 3000, loggerToUse = GlobalLogger, isFrameContext = false) {
    const logSuffix = isFrameContext ? ' (in iframe)' : '';
    try {
        const element = pageOrFrame.locator(selector).first();
        await element.waitFor({ state: 'visible', timeout });
        try {
            await element.click({ timeout: timeout / 2, force: false, noWaitAfter: false });
            (loggerToUse || console).info(`Clicked on selector: ${selector}${logSuffix}`);
            return true;
        } catch (clickError) {
            (loggerToUse || console).debug(`Normal click failed for ${selector}${logSuffix}, trying with force. Error: ${clickError.message.split('\n')[0]}`);
            const elementForForce = pageOrFrame.locator(selector).first();
            await elementForForce.waitFor({ state: 'visible', timeout });
            await elementForForce.click({ timeout: timeout / 2, force: true, noWaitAfter: false });
            (loggerToUse || console).info(`Clicked on selector with force: ${selector}${logSuffix}`);
            return true;
        }
    } catch (e) {
        (loggerToUse || console).debug(`Selector not found/clickable: ${selector}${logSuffix} - Error: ${e.message.split('\n')[0]}`);
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

async function ensureVideoPlaying(page, playButtonSelectors, logEntry) {
    logEntry('Ensuring video is playing...');
    for (let attempt = 0; attempt < 3; attempt++) {
        const isPaused = await page.evaluate(() => {
            const video = document.querySelector('video.html5-main-video, video.rumble-player-video');
            if (video) {
                if (video.paused) {
                    video.play().catch(e => console.warn('Direct video.play() in evaluate failed:', e.message));
                }
                return video.paused;
            }
            return true;
        }).catch(e => { logEntry(`Error evaluating video state for play: ${e.message}`, 'warn'); return true; });

        if (!isPaused) {
            logEntry(`Video is playing (attempt ${attempt + 1}).`);
            return true;
        }

        logEntry(`Video is paused (attempt ${attempt + 1}), trying to click play buttons.`);
        for (const selector of playButtonSelectors) {
            if (await clickIfExists(page, selector, 1500, {info: logEntry, debug: logEntry, warning: logEntry, error: logEntry })) {
                logEntry(`Clicked play button: ${selector}`);
                await page.waitForTimeout(500);
                const stillPaused = await page.evaluate(() => document.querySelector('video')?.paused);
                if (!stillPaused) {
                    logEntry('Video started playing after click.');
                    return true;
                }
            }
        }
        logEntry('Trying to click video element directly to play.');
        await page.locator('video').first().click({ timeout: 2000, force: true }).catch(e => logEntry(`Failed to click video element: ${e.message}`, 'warn'));
        await page.waitForTimeout(500);
        const finalCheckPaused = await page.evaluate(() => document.querySelector('video')?.paused);
        if (!finalCheckPaused) {
            logEntry('Video started playing after general video click.');
            return true;
        }
        if (attempt < 2) await page.waitForTimeout(1000);
    }
    logEntry('Failed to ensure video is playing after multiple attempts.', 'warn');
    return false;
}


async function watchVideoOnPage(page, job, effectiveInput, loggerToUse = GlobalLogger) {
    const jobResult = {
        jobId: job.id, url: job.url, videoId: job.videoId, platform: job.platform, status: 'pending',
        watchTimeRequestedSec: 0, watchTimeActualSec: 0, durationFoundSec: null,
        startTime: new Date().toISOString(), endTime: null, error: null, log: []
    };

    const logEntry = (msg, level = 'info') => {
        const formattedMessage = `[Job ${job.id.substring(0,6)}] ${msg}`;
        if (loggerToUse && typeof loggerToUse[level] === 'function') {
            loggerToUse[level](formattedMessage);
        } else {
            (GlobalLogger || console)[level](formattedMessage);
        }
        jobResult.log.push(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`);
    };

    try {
        logEntry('Handling initial ads.');
        await handleAds(page, job.platform, effectiveInput, loggerToUse);
        logEntry(`Attempting to play video: ${job.url}`);

        const playButtonSelectors = job.platform === 'youtube'
            ? ['.ytp-large-play-button', '.ytp-play-button[aria-label*="Play"]', 'video.html5-main-video']
            : ['.rumbles-player-play-button', 'video.rumble-player-video'];

        await ensureVideoPlaying(page, playButtonSelectors, logEntry);

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

            if (!videoState) {
                logEntry('Video element not found in evaluate, attempting to find again.', 'warn');
                await page.waitForTimeout(1000);
                const videoExists = await page.locator('video').count() > 0;
                if (!videoExists) throw new Error('Video element disappeared definitively.');
                continue;
            }

            logEntry(`State: time=${videoState.ct?.toFixed(2)}, paused=${videoState.p}, ended=${videoState.e}, ready=${videoState.rs}, net=${videoState.ns}`);

            if (videoState.p && !videoState.e) {
                logEntry('Video is paused, attempting to ensure it plays.');
                await ensureVideoPlaying(page, playButtonSelectors, logEntry);
            }

            currentActualWatchTime = videoState.ct || 0;
            jobResult.watchTimeActualSec = currentActualWatchTime;

            if (currentActualWatchTime >= targetWatchTimeSec || videoState.e) {
                logEntry(`Target watch time reached or video ended. Actual: ${currentActualWatchTime.toFixed(2)}s`);
                break;
            }

            if (i % 6 === 0) {
                 await page.mouse.move(Math.random()*500,Math.random()*300,{steps:5}).catch(()=>{});
                 logEntry('Simulated mouse move.','debug');
            }
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

async function handleYouTubeConsent(page, loggerToUse = GlobalLogger) {
    loggerToUse.info('Handling YouTube consent with updated selectors...');

    const mainDialogOuterSelector = 'ytd-consent-bump-v2-lightbox';
    const mainDialogInnerSelector = `${mainDialogOuterSelector} tp-yt-paper-dialog[role="dialog"]`;

    const consentIframeSelectors = [
        'iframe[src*="consent.google.com"]',
        'iframe[src*="consent.youtube.com"]'
    ];

    const acceptButtonSelectorsOnMainPage = [
        'ytd-consent-bump-v2-lightbox ytd-button-renderer button[aria-label*="Accept the use of cookies"]',
        'ytd-consent-bump-v2-lightbox ytd-button-renderer button:has-text("Accept all")',
        'ytd-consent-bump-v2-lightbox button[aria-label*="Accept the use of cookies"]',
        'ytd-consent-bump-v2-lightbox button:has-text("Accept all")',
        'ytd-consent-bump-v2-lightbox .yt-spec-button-shape-next[aria-label*="Accept"]',
        'ytd-consent-bump-v2-lightbox .yt-spec-button-shape-next:has-text("Accept all")',
        'button[aria-label*="Accept the use of cookies and other data"]',
        'button:has-text("Accept all")',
        'ytd-button-renderer button[aria-label*="Accept"]'
    ];

    const acceptButtonSelectorsInIframe = [
        'button[aria-label*="Accept all"]',
        'button:has-text("Accept all")',
        'button[jsname*="LgbsSe"]'
    ];

    let clickedConsent = false;
    let consentHandledBy = null;
    let dialogElementLocatorToCheckForHiding = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
        loggerToUse.info(`Consent attempt ${attempt}`);
        await page.waitForTimeout(1500 + (attempt * 500));

        for (const frameSelector of consentIframeSelectors) {
            try {
                const frameLocator = page.locator(frameSelector).first();
                await frameLocator.waitFor({ state: 'visible', timeout: 4000 });
                const elementHandle = await frameLocator.elementHandle();
                if (elementHandle) {
                    const frame = await elementHandle.contentFrame();
                    if (frame) {
                        loggerToUse.info(`Consent iframe found: ${frameSelector}. Trying to click 'Accept all' inside.`);
                        for (const selector of acceptButtonSelectorsInIframe) {
                            if (await clickIfExists(frame, selector, 3000, loggerToUse, true)) {
                                clickedConsent = true; consentHandledBy = 'iframe';
                                dialogElementLocatorToCheckForHiding = frameLocator;
                                break;
                            }
                        }
                        if (clickedConsent) break;
                    }
                }
            } catch (e) { loggerToUse.debug(`Iframe ${frameSelector} not found/visible in attempt ${attempt}.`); }
        }
        if (clickedConsent) break;

        if (!consentHandledBy) {
            loggerToUse.info('No iframe consent. Checking main page dialog.');
            try {
                const dialogLocator = page.locator(mainDialogOuterSelector).first();
                await dialogLocator.waitFor({ state: 'visible', timeout: 7000 + (attempt * 1000) });
                loggerToUse.info(`Main page consent dialog container (${mainDialogOuterSelector}) is visible. Attempting clicks.`);
                dialogElementLocatorToCheckForHiding = dialogLocator;

                for (const selector of acceptButtonSelectorsOnMainPage) {
                    if (await clickIfExists(page, selector, 5000, loggerToUse)) {
                        clickedConsent = true; consentHandledBy = 'mainPage'; break;
                    }
                }
            } catch (e) {
                loggerToUse.debug(`Main page consent dialog not found or error in attempt ${attempt}: ${e.message.split('\n')[0]}`);
            }
        }

        if (clickedConsent) break;

        if (attempt < 3) {
            loggerToUse.info(`Consent not resolved in attempt ${attempt}, retrying...`);
            await page.waitForTimeout(3000 + Math.random() * 1500);
        }
    }

    if (clickedConsent) {
        loggerToUse.info(`An "Accept" button was clicked (via ${consentHandledBy}). Waiting for page to fully stabilize after potential refresh (up to 25s).`);
        try {
            await page.waitForLoadState('domcontentloaded', { timeout: 25000 });
            loggerToUse.info('Page reached "domcontentloaded" after consent click (potential refresh handled).');
            await page.waitForTimeout(3000 + Math.random() * 1000);

            if (!dialogElementLocatorToCheckForHiding) {
                 loggerToUse.warning('dialogElementLocatorToCheckForHiding was not set despite consent click!');
                 dialogElementLocatorToCheckForHiding = page.locator(mainDialogOuterSelector).first();
            }
            const isStillVisible = await dialogElementLocatorToCheckForHiding.isVisible({timeout: 5000}).catch(() => false);

            if (isStillVisible) {
                loggerToUse.warning('Consent dialog STILL VISIBLE after click and page stabilization. This indicates a problem.');
                if (page && typeof ApifyModule !== 'undefined' && ApifyModule.Actor && ApifyModule.Actor.isAtHome()  && !page.isClosed()) {
                    const screenshotBuffer = await page.screenshot({fullPage: true, timeout: 10000});
                    await ApifyModule.Actor.setValue(`SCREENSHOT_CONSENT_STILL_VISIBLE_${uuidv4().substring(0,8)}`, screenshotBuffer, { contentType: 'image/png' });
                }
                return false;
            } else {
                loggerToUse.info('Consent dialog confirmed hidden after click and stabilization.');
            }
        } catch (stabilizationError) {
            loggerToUse.warning(`Error or timeout during page stabilization after consent click: ${stabilizationError.message.split('\n')[0]}.`);
            try {
                const finalCheckLocator = dialogElementLocatorToCheckForHiding || page.locator(mainDialogOuterSelector).first();
                await finalCheckLocator.waitFor({ state: 'hidden', timeout: 10000 });
                loggerToUse.info('Consent dialog confirmed hidden despite earlier stabilization timeout.');
            } catch (finalHiddenError) {
                loggerToUse.error(`Consent dialog did NOT become hidden after all waits. Error: ${finalHiddenError.message.split('\n')[0]}`);
                return false;
            }
        }
        loggerToUse.info('Consent handling process finished successfully.');
        return true;
    }

    loggerToUse.error('Failed to handle consent dialog after all attempts (no button successfully clicked or confirmed dismissed).');
    if (page && typeof ApifyModule !== 'undefined' && ApifyModule.Actor && ApifyModule.Actor.isAtHome() && !page.isClosed()) {
        try {
            loggerToUse.info('Attempting to capture HTML/Screenshot on final consent failure...');
            const htmlContent = await page.content({timeout: 10000}).catch(e => `Failed to get HTML: ${e.message}`);
            await ApifyModule.Actor.setValue(`HTML_CONSENT_FINAL_FAIL_${uuidv4().substring(0,8)}`, htmlContent, {contentType: 'text/html'});

            const screenshotBuffer = await page.screenshot({fullPage: true, timeout: 10000});
            await ApifyModule.Actor.setValue(`SCREENSHOT_CONSENT_FINAL_FAIL_${uuidv4().substring(0,8)}`, screenshotBuffer, { contentType: 'image/png' });
            loggerToUse.info('Saved HTML and screenshot on final consent handling failure.');
        } catch (captureError) {
            loggerToUse.warning(`Could not capture debug info on final consent failure: ${captureError.message}`);
        }
    }
    return false;
}


async function runSingleJob(job, effectiveInput, actorProxyConfiguration, customProxyPool, logger) {
    const jobScopedLogger = {
        info: (msg) => logger.info(`[Job ${job.id.substring(0,6)}] ${msg}`),
        warning: (msg) => logger.warning(`[Job ${job.id.substring(0,6)}] ${msg}`),
        error: (msg, data) => logger.error(`[Job ${job.id.substring(0,6)}] ${msg}`, data),
        debug: (msg) => logger.debug(`[Job ${job.id.substring(0,6)}] ${msg}`),
    };

    const jobResult = {
        jobId: job.id, url: job.url, videoId: job.videoId, platform: job.platform,
        proxyUsed: 'None', status: 'initiated', error: null, log: []
    };

    const logEntry = (msg, level = 'info') => {
        const tsMsg = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`;
        if (jobScopedLogger && typeof jobScopedLogger[level] === 'function') {
            jobScopedLogger[level](msg);
        } else {
            const fallbackLogger = GlobalLogger || console;
            if (fallbackLogger && typeof fallbackLogger[level] === 'function') {
                 fallbackLogger[level](`[Job ${job.id.substring(0,6)}] ${msg}`);
            } else {
                console.log(`[${level.toUpperCase()}] [Job ${job.id.substring(0,6)}] ${msg}`);
            }
        }
        jobResult.log.push(tsMsg);
    };

    logEntry(`Starting job for URL: ${job.url} with watchType: ${job.watchType}`);

    let browser;
    let context;
    let page;
    let proxyUrlToUse = null;

    // --- Determine Geo settings early ---
    const detectedTimezone = getTimezoneForProxy(effectiveInput.proxyCountry, effectiveInput.useProxies);
    const detectedLocale = getLocaleForCountry(effectiveInput.proxyCountry);
    logEntry(`Geo settings: Timezone='${detectedTimezone}', Locale='${detectedLocale}' (based on proxyCountry: '${effectiveInput.proxyCountry || 'N/A'}')`);
    // --- End Geo settings ---

    try {
        const launchOptions = { headless: effectiveInput.headless, args: [...ANTI_DETECTION_ARGS] };
        if (effectiveInput.useProxies) {
            if (customProxyPool && customProxyPool.length > 0) {
                proxyUrlToUse = customProxyPool[Math.floor(Math.random() * customProxyPool.length)];
                logEntry(`Using custom proxy (host: ${proxyUrlToUse.split('@').pop().split(':')[0]})`);
                try {
                    const parsedProxyUrl = new URL(proxyUrlToUse);
                    launchOptions.proxy = {
                        server: `${parsedProxyUrl.protocol}//${parsedProxyUrl.hostname}:${parsedProxyUrl.port}`,
                        username: parsedProxyUrl.username || undefined,
                        password: parsedProxyUrl.password || undefined
                    };
                    jobResult.proxyUsed = `Custom: ${launchOptions.proxy.server} (auth: ${launchOptions.proxy.username ? 'yes' : 'no'})`;
                } catch (e) {
                    logEntry(`Invalid custom proxy URL format: ${proxyUrlToUse}. Using as is. Error: ${e.message}`, 'warn');
                    launchOptions.proxy = { server: proxyUrlToUse };
                    jobResult.proxyUsed = `Custom: ${proxyUrlToUse.split('@')[1] || proxyUrlToUse.split('//')[1] || 'details hidden'}`;
                }
            } else if (actorProxyConfiguration) {
                const sessionId = uuidv4().replace(/-/g, '');
                try {
                    proxyUrlToUse = await actorProxyConfiguration.newUrl(sessionId);
                    const parsedProxyUrl = new URL(proxyUrlToUse);
                    launchOptions.proxy = {
                        server: `${parsedProxyUrl.protocol}//${parsedProxyUrl.hostname}:${parsedProxyUrl.port}`,
                        username: parsedProxyUrl.username || undefined,
                        password: parsedProxyUrl.password || undefined
                    };
                    const proxyIp = parsedProxyUrl.hostname;
                    logEntry(`Using Apify proxy (Session: ${sessionId}, IP: ${proxyIp}, Auth: ${launchOptions.proxy.username ? 'yes' : 'no'})`);
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
            locale: detectedLocale,      // DYNAMIC LOCALE
            timezoneId: detectedTimezone, // DYNAMIC TIMEZONE
            javaScriptEnabled: true,
        });

        // Pass detectedTimezone to anti-detection scripts
        await applyAntiDetectionScripts(context, detectedTimezone);


        if (job.watchType === 'referer' && job.refererUrl) {
            logEntry(`Setting referer to: ${job.refererUrl}`);
            await context.setExtraHTTPHeaders({ 'Referer': job.refererUrl });
        }

        page = await context.newPage();
        await page.setViewportSize({ width: 1200 + Math.floor(Math.random()*120), height: 700 + Math.floor(Math.random()*80) });

        if (job.watchType === 'search' && job.searchKeywords && job.searchKeywords.length > 0) {
            const keyword = job.searchKeywords[Math.floor(Math.random() * job.searchKeywords.length)];
            logEntry(`Performing search for keyword: "${keyword}" to find video ID: ${job.videoId}`);
            
            // Use new function for YouTube search URL
            const searchUrl = job.platform === 'youtube'
                ? getYouTubeSearchUrl(keyword, effectiveInput.proxyCountry, detectedLocale)
                : `https://rumble.com/search/video?q=${encodeURIComponent(keyword)}`;

            logEntry(`Navigating to search results: ${searchUrl}`);
            await page.goto(searchUrl, { timeout: effectiveInput.timeout * 1000, waitUntil: 'domcontentloaded' });
            logEntry('Search results page loaded (domcontentloaded).');

            const consentSuccess = await handleYouTubeConsent(page, jobScopedLogger);
            if (!consentSuccess) {
                const mainDialogOuterSelectorForCheck = 'ytd-consent-bump-v2-lightbox';
                const dialogStillPresent = await page.locator(mainDialogOuterSelectorForCheck)
                                                    .first().isVisible({timeout:2000}).catch(() => false);
                if (dialogStillPresent) {
                    logEntry('Consent handling failed and dialog is still present. Throwing error.', 'error');
                    throw new Error('Failed to handle consent dialog, and it appears to still be present after all attempts.');
                } else {
                    logEntry('Consent handling function returned false, but dialog not visible after check. Proceeding with caution.', 'warn');
                }
            }

            logEntry('Waiting for page stabilization after consent...');
            await page.waitForTimeout(3000 + Math.random() * 2000);

            try {
                await page.waitForFunction(() => {
                    const results = document.querySelectorAll('ytd-video-renderer, #contents ytd-rich-item-renderer');
                    return results.length > 0;
                }, { timeout: 10000 });
                logEntry('Search results confirmed loaded.');
            } catch (e) {
                logEntry(`Search results check failed: ${e.message.split('\n')[0]}`, 'warn');
            }

            try {
                await page.waitForLoadState('networkidle', { timeout: 20000 });
                logEntry('Network idle on search page after consent & stabilization.');
            } catch (e) {
                logEntry(`Network idle timed out on search page (after consent & stabilization), proceeding. Error: ${e.message.split('\n')[0]}`, 'warn');
            }

            const videoLinkSelector = job.platform === 'youtube'
                ? `a#video-title[href*="/watch?v=${job.videoId}"], a[href*="/watch?v=${job.videoId}"]`
                : `a.video-item--a[href*="${job.videoId}"]`;

            logEntry(`Looking for video link with selector: ${videoLinkSelector}`);
            const videoLink = page.locator(videoLinkSelector).first();

            try {
                await videoLink.waitFor({ state: 'visible', timeout: 45000 });
                logEntry('Video link found in search results. Scrolling into view if needed...');
                await videoLink.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(e => logEntry(`Scroll to video link failed: ${e.message.split('\n')[0]}`, 'debug'));
                logEntry('Attempting to click video link.');
                await videoLink.click({timeout: 10000, force: true });
                logEntry('Clicked video link. Waiting for navigation to video page...');

                const possibleUrlPatterns = [
                    `**/watch?v=${job.videoId}*`, `**/watch*v=${job.videoId}*`,
                    `**/${job.videoId}*`, `**/watch*`
                ];
                let navigationSuccess = false;
                for (const pattern of possibleUrlPatterns) {
                    try {
                        await page.waitForURL(pattern, { timeout: 15000, waitUntil: 'domcontentloaded' });
                        logEntry(`Navigation success with pattern: ${pattern}. Current URL: ${page.url()}`);
                        navigationSuccess = true;
                        break;
                    } catch (e) {
                        logEntry(`Pattern ${pattern} didn't match (timeout 15s), trying next... Error: ${e.message.split('\n')[0]}`, 'debug');
                    }
                }
                if (!navigationSuccess) {
                    const currentUrl = page.url();
                    if (currentUrl.includes(job.videoId)) {
                        logEntry(`Navigation succeeded based on current URL content check: ${currentUrl}`);
                        navigationSuccess = true;
                    } else {
                         logEntry(`All URL patterns failed and current URL (${currentUrl}) does not contain VideoID (${job.videoId}).`, 'warn');
                    }
                }
                if (!navigationSuccess) {
                    throw new Error(`Failed to navigate to video page after clicking link (URL patterns and ID check failed). Final URL: ${page.url()}`);
                }
                logEntry(`Navigated to video page: ${page.url()}`);

            } catch (searchError) {
                logEntry(`Could not find or click video link for "${keyword}" (ID: ${job.videoId}). Error: ${searchError.message.split('\n')[0]}`, 'error');
                logEntry('Attempting direct navigation as fallback...');
                try {
                    await page.goto(job.url, { timeout: 30000, waitUntil: 'domcontentloaded' });
                    logEntry(`Direct navigation fallback succeeded. New URL: ${page.url()}`);
                    const fallbackConsentSuccess = await handleYouTubeConsent(page, jobScopedLogger);
                     if (!fallbackConsentSuccess) {
                        const mainDialogOuterSelectorForCheck = 'ytd-consent-bump-v2-lightbox';
                        const dialogStillPresent = await page.locator(mainDialogOuterSelectorForCheck)
                                                            .first().isVisible({timeout:2000}).catch(() => false);
                        if (dialogStillPresent) {
                            logEntry('Consent handling failed on direct nav fallback & dialog is still present. Throwing error.', 'error');
                            throw new Error('Failed to handle consent on direct navigation fallback, and dialog appears to still be present.');
                        } else {
                            logEntry('Consent handling (direct nav fallback) function returned false, but dialog not visible. Proceeding cautiously.', 'warn');
                        }
                    }
                } catch (directNavError) {
                    logEntry(`Direct navigation fallback also failed: ${directNavError.message.split('\n')[0]}`, 'error');
                    if (page && ApifyModule.Actor.isAtHome() && !page.isClosed()) {
                        try {
                            const htmlContent = await page.content({timeout: 5000}).catch(e => `HTML capture failed: ${e.message}`);
                            await ApifyModule.Actor.setValue(`HTML_SEARCH_AND_DIRECT_NAV_FAIL_${job.id.replace(/-/g,'')}`, htmlContent, {contentType: 'text/html'});
                            const screenshotBuffer = await page.screenshot({fullPage: true, timeout: 10000});
                            await ApifyModule.Actor.setValue(`SCREENSHOT_SEARCH_AND_DIRECT_NAV_FAIL_${job.id.replace(/-/g,'')}`, screenshotBuffer, { contentType: 'image/png' });
                            logEntry('Saved HTML/Screenshot on search and direct navigation failure.');
                        } catch (captureErr) {
                            logEntry(`Failed to capture debug info on combined failure: ${captureErr.message}`, 'warn');
                        }
                    }
                    throw new Error(`Failed to find video via search (Error: ${searchError.message.split('\n')[0]}) AND direct navigation fallback also failed (Error: ${directNavError.message.split('\n')[0]})`);
                }
            }
        } else {
            logEntry(`Navigating (direct/referer) to ${job.url} with waitUntil: 'domcontentloaded' (timeout ${effectiveInput.timeout}s).`);
            await page.goto(job.url, { timeout: effectiveInput.timeout * 1000, waitUntil: 'domcontentloaded' });
            logEntry(`Initial navigation to ${job.url} (domcontentloaded) complete.`);
            const consentSuccess = await handleYouTubeConsent(page, jobScopedLogger);
            if (!consentSuccess) {
                const mainDialogOuterSelectorForCheck = 'ytd-consent-bump-v2-lightbox';
                const dialogStillPresent = await page.locator(mainDialogOuterSelectorForCheck)
                                                    .first().isVisible({timeout:2000}).catch(() => false);
                if (dialogStillPresent) {
                     logEntry('Consent handling failed and dialog is still present. Throwing error.', 'error');
                     throw new Error('Failed to handle consent dialog, and it appears to still be present after all attempts.');
                } else {
                    logEntry('Consent dialog not clicked by handler, but also not visible after check. Proceeding with caution.', 'warn');
                }
            }
        }

        try {
            logEntry('Waiting for network idle (up to 30s after navigation/search click/consent)...');
            await page.waitForLoadState('networkidle', { timeout: 30000 });
            logEntry('Network is idle.');
        } catch(e) {
            logEntry(`Network did not become idle within 30s: ${e.message.split('\n')[0]}. Proceeding anyway.`, 'warn');
        }

        const playerSelector = job.platform === 'youtube' ? '#movie_player video.html5-main-video, ytd-player video' : '.rumble-player-video-wrapper video, video.rumble-player';
        try {
            logEntry(`Waiting for player element (${playerSelector}) to be visible (60s).`);
            await page.waitForSelector(playerSelector, { state: 'visible', timeout: 60000 });
            logEntry(`Player element (${playerSelector}) is visible.`);
        } catch (videoWaitError) {
            logEntry(`Player element (${playerSelector}) not visible within 60s: ${videoWaitError.message.split('\n')[0]}`, 'error');
            if (page && ApifyModule.Actor.isAtHome() && !page.isClosed()) {
                try {
                    logEntry('Attempting to capture HTML on player wait failure...');
                    const htmlContent = await page.content({timeout: 10000}).catch(e => `Failed to get HTML: ${e.message}`);
                    await ApifyModule.Actor.setValue(`HTML_PLAYER_FAIL_${job.id.replace(/-/g,'')}`, htmlContent, {contentType: 'text/html'});
                    logEntry('HTML content saved on player wait failure.');

                    const screenshotBuffer = await page.screenshot({fullPage: true, timeout: 10000});
                    const key = `SCREENSHOT_PLAYER_FAIL_${job.id.replace(/-/g,'')}`;
                    if (ApifyModule.Actor.setValue) await ApifyModule.Actor.setValue(key, screenshotBuffer, { contentType: 'image/png' });
                    logEntry(`Screenshot taken on player wait failure: ${key}`);
                } catch (screenshotError) {
                    logEntry(`Failed to take screenshot/HTML: ${screenshotError.message}`, 'warn');
                }
            }
            logEntry(`Current URL: ${page.url()}`, 'debug');
            logEntry(`Page title: ${await page.title().catch(()=>'N/A')}`, 'debug');
            throw new Error(`Player element not visible after 60s: ${videoWaitError.message}`);
        }

        const watchResult = await watchVideoOnPage(page, job, effectiveInput, jobScopedLogger);
        Object.assign(jobResult, watchResult);

    } catch (e) {
        logEntry(`Critical error in job ${job.url}: ${e.message}\n${e.stack}`, 'error');
        jobResult.status = 'failure';
        jobResult.error = e.message + (e.stack ? `\nStack: ${e.stack}` : '');
        if (page && typeof ApifyModule !== 'undefined' && ApifyModule.Actor && ApifyModule.Actor.isAtHome() && !page.isClosed()) {
            try {
                logEntry('Attempting to capture HTML on critical error...');
                const htmlContent = await page.content({timeout: 10000}).catch(err => `Failed to get HTML: ${err.message}`);
                await ApifyModule.Actor.setValue(`HTML_ERROR_${job.id.replace(/-/g,'')}`, htmlContent, {contentType: 'text/html'});
                logEntry('HTML content saved on critical error.');

                const screenshotBuffer = await page.screenshot({fullPage: true, timeout: 10000});
                const key = `SCREENSHOT_ERROR_${job.id.replace(/-/g,'')}`;
                if (ApifyModule.Actor.setValue) await ApifyModule.Actor.setValue(key, screenshotBuffer, { contentType: 'image/png' });
                logEntry(`Screenshot taken on critical error: ${key}`);
            } catch (captureError) {
                logEntry(`Failed to take screenshot/HTML on critical error: ${captureError.message}`, 'warn');
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

    const defaultInput = {
        videoUrls: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
        watchTypes: ['direct'],
        refererUrls: [''],
        searchKeywordsForEachVideo: ['default keyword, another default'],
        watchTimePercentage: 80,
        useProxies: true,
        proxyUrls: [],
        proxyCountry: null, // Default to null, so geo-helpers can default appropriately
        proxyGroups: ['RESIDENTIAL'],
        headless: true,
        concurrency: 1,
        concurrencyInterval: 5,
        timeout: 120,
        maxSecondsAds: 15,
        skipAdsAfter: ["5", "10"],
        autoSkipAds: true,
        stopSpawningOnOverload: true,
        useAV1: false,
        disableProxyTests: false,
        enableEngagement: false,
        leaveComment: false,
        performLike: false,
        subscribeToChannel: false
    };

    const rawInput = input || {};
    const effectiveInput = { ...defaultInput };

    for (const key of Object.keys(defaultInput)) {
        if (rawInput.hasOwnProperty(key) && rawInput[key] !== undefined && rawInput[key] !== null) {
            if (Array.isArray(defaultInput[key])) {
                if (Array.isArray(rawInput[key]) && rawInput[key].length > 0) {
                    effectiveInput[key] = rawInput[key];
                } else if (Array.isArray(rawInput[key]) && rawInput[key].length === 0 &&
                           (key === 'proxyUrls' || key === 'watchTypes' || key === 'refererUrls' || key === 'searchKeywordsForEachVideo')) {
                    effectiveInput[key] = [];
                }
            } else {
                effectiveInput[key] = rawInput[key];
            }
        }
    }

    let tempSkipAds = effectiveInput.skipAdsAfter;
    if (Array.isArray(tempSkipAds) && tempSkipAds.every(s => typeof s === 'string' || typeof s === 'number')) {
        effectiveInput.skipAdsAfter = tempSkipAds.map(s => parseInt(String(s), 10)).filter(n => !isNaN(n));
        if (effectiveInput.skipAdsAfter.length === 0 && defaultInput.skipAdsAfter.length > 0) {
            GlobalLogger.warning(`User provided 'skipAdsAfter' (${JSON.stringify(tempSkipAds)}) resulted in empty array after parsing. Using default.`);
            effectiveInput.skipAdsAfter = defaultInput.skipAdsAfter.map(s => parseInt(s,10));
        }
    } else {
        GlobalLogger.warning(`Input 'skipAdsAfter' was not a valid array. Using default. Received: ${JSON.stringify(tempSkipAds)}`);
        effectiveInput.skipAdsAfter = defaultInput.skipAdsAfter.map(s => parseInt(s,10));
    }

    // Ensure proxyCountry is uppercase if it exists, for map lookups
    if (effectiveInput.proxyCountry && typeof effectiveInput.proxyCountry === 'string') {
        effectiveInput.proxyCountry = effectiveInput.proxyCountry.toUpperCase();
    }


    GlobalLogger.info('Effective input settings:', effectiveInput);

    if (!effectiveInput.videoUrls || !Array.isArray(effectiveInput.videoUrls) || effectiveInput.videoUrls.length === 0) {
        GlobalLogger.error('No videoUrls provided or resolved after defaults. Exiting.');
        if (ApifyModule.Actor.fail) await ApifyModule.Actor.fail('Missing videoUrls in input.');
        return;
    }

    let actorProxyConfiguration = null;
    if (effectiveInput.useProxies && (!effectiveInput.proxyUrls || effectiveInput.proxyUrls.length === 0)) {
        const opts = { groups: effectiveInput.proxyGroups };
        if (effectiveInput.proxyCountry && effectiveInput.proxyCountry.trim() !== "") opts.countryCode = effectiveInput.proxyCountry;
        actorProxyConfiguration = await ApifyModule.Actor.createProxyConfiguration(opts);
        GlobalLogger.info(`Apify Proxy Configuration created. Country: ${effectiveInput.proxyCountry || 'Any (as per proxy group default)'}`);
    } else if (effectiveInput.useProxies && effectiveInput.proxyUrls && effectiveInput.proxyUrls.length > 0) {
        GlobalLogger.info(`Using ${effectiveInput.proxyUrls.length} custom proxies. Note: proxyCountry input will be used for geo settings but custom proxy locations are not auto-detected.`);
    }

    const jobs = [];
    for (let i = 0; i < effectiveInput.videoUrls.length; i++) {
        const url = effectiveInput.videoUrls[i];
        if (!url || typeof url !== 'string') {
            GlobalLogger.warning(`Invalid URL at index ${i}: ${url}. Skipping.`);
            continue;
        }
        const videoId = extractVideoId(url);
        if (!videoId) { GlobalLogger.warning(`Invalid URL (no ID for ${url}). Skipping.`); continue; }
        const platform = url.includes('youtube.com')||url.includes('youtu.be') ? 'youtube' : (url.includes('rumble.com') ? 'rumble' : 'unknown');
        if (platform === 'unknown') { GlobalLogger.warning(`Unknown platform for ${url}. Skipping.`); continue; }

        const watchType = (effectiveInput.watchTypes && effectiveInput.watchTypes[i]) || defaultInput.watchTypes[0] || 'direct';
        const refererUrl = (watchType === 'referer' && effectiveInput.refererUrls && effectiveInput.refererUrls[i]) || null;

        let searchKeywords = [];
        if (watchType === 'search' && effectiveInput.searchKeywordsForEachVideo && typeof effectiveInput.searchKeywordsForEachVideo[i] === 'string') {
            searchKeywords = effectiveInput.searchKeywordsForEachVideo[i].split(',').map(kw => kw.trim()).filter(kw => kw.length > 0);
        }

        if (watchType === 'search' && searchKeywords.length === 0) {
            GlobalLogger.warning(`Watch type is 'search' for ${url} but no valid search keywords found for index ${i}. Defaulting to 'direct'.`);
            jobs.push({ id: uuidv4(), url, videoId, platform, watchType: 'direct', refererUrl: null, searchKeywords: [] });
        } else {
            jobs.push({ id: uuidv4(), url, videoId, platform, watchType, refererUrl, searchKeywords });
        }
    }


    if (jobs.length === 0) {
        GlobalLogger.error('No valid jobs after processing input. Exiting.');
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
            GlobalLogger.warning('At capacity, pausing for 30s.');
            await new Promise(r => setTimeout(r, 30000));
            if (await ApifyModule.Actor.isAtCapacity()) { GlobalLogger.error('Still at capacity. Stopping.'); break; }
        }
        while (activeWorkers.size >= effectiveInput.concurrency) {
            GlobalLogger.debug(`Concurrency limit (${effectiveInput.concurrency}) reached. Waiting... Active: ${activeWorkers.size}`);
            await Promise.race(Array.from(activeWorkers));
        }

        const jobPromise = runSingleJob(job, effectiveInput, actorProxyConfiguration, effectiveInput.proxyUrls, GlobalLogger)
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
        GlobalLogger.info(`Job ${job.id.substring(0,6)} (${i + 1}/${jobs.length}) dispatched. WatchType: ${job.watchType}. Active: ${activeWorkers.size}`);
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
