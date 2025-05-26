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

// --- GEO HELPER FUNCTIONS (from previous update) ---
function getTimezoneForProxy(proxyCountry, useProxiesSetting) {
    if (!useProxiesSetting || !proxyCountry) {
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
    return 'America/New_York';
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
    const gl = (countryCode || 'US').toUpperCase();
    const hl = detectedLocale.replace('_', '-');
    (GlobalLogger || console).debug(`[GeoHelper] YouTube Search URL params: gl=${gl}, hl=${hl} for keyword "${keyword}"`);
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword)}&gl=${gl}&hl=${hl}`;
}
// --- END GEO HELPER FUNCTIONS ---

async function applyAntiDetectionScripts(pageOrContext, detectedTimezoneId) {
    const antiDetectionFunctionInBrowser = (tzId) => {
        if (navigator.webdriver === true) Object.defineProperty(navigator, 'webdriver', { get: () => false });
        if (navigator.languages && !navigator.languages.includes('en-US')) Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        if (navigator.language !== 'en-US') Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
        const getOffsetForTargetTimezone = (targetTimezoneIdString) => {
            try {
                const now = new Date();
                const utcTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
                const timeInTargetZoneStr = utcTime.toLocaleString("en-US", {timeZone: targetTimezoneIdString});
                const timeInTargetZone = new Date(timeInTargetZoneStr);
                const offsetMinutes = (utcTime.getTime() - timeInTargetZone.getTime()) / 60000;
                return Math.round(offsetMinutes);
            } catch (e) {
                console.debug('[AntiDetection] Failed to calculate dynamic timezone offset for spoofing, using 0 (UTC):', e.message, targetTimezoneIdString);
                return 0;
            }
        };
        const targetOffsetMinutes = getOffsetForTargetTimezone(tzId);
        try {
            Date.prototype.getTimezoneOffset = function() { return targetOffsetMinutes; };
        } catch (e) { console.debug('[AntiDetection] Failed to spoof Date.prototype.getTimezoneOffset:', e.message); }
        try {
            const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function (parameter) {
                if (this.canvas && this.canvas.id === 'webgl-fingerprint-canvas') return originalGetParameter.apply(this, arguments);
                if (parameter === 37445) return 'Google Inc. (Intel)';
                if (parameter === 37446) return 'ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics 640, OpenGL 4.1)';
                return originalGetParameter.apply(this, arguments);
            };
        } catch (e) { console.debug('[AntiDetection] Failed WebGL spoof:', e.message); }
        try {
            const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function() {
                if (this.id === 'canvas-fingerprint-element') return originalToDataURL.apply(this, arguments);
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
        if (navigator.permissions && typeof navigator.permissions.query === 'function') {
            const originalPermissionsQuery = navigator.permissions.query;
            navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications'
                    ? Promise.resolve({ state: Notification.permission || 'prompt' })
                    : originalPermissionsQuery.call(navigator.permissions, parameters)
            );
        }
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
        if (navigator.plugins) try { Object.defineProperty(navigator, 'plugins', { get: () => [], configurable: true }); } catch(e) { console.debug('[AntiDetection] Failed plugin spoof:', e.message); }
        if (navigator.mimeTypes) try { Object.defineProperty(navigator, 'mimeTypes', { get: () => [], configurable: true }); } catch(e) { console.debug('[AntiDetection] Failed mimeType spoof:', e.message); }
    };
    (GlobalLogger || console).debug(`[AntiDetection] Injecting anti-detection script with dynamic timezoneId: ${detectedTimezoneId}`);
    if (pageOrContext.addInitScript) {
        await pageOrContext.addInitScript(antiDetectionFunctionInBrowser, detectedTimezoneId);
    } else if (pageOrContext.evaluateOnNewDocument) {
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

// --- NEW ensureVideoPlaying FUNCTION ---
async function ensureVideoPlaying(page, playButtonSelectors, logEntry) {
    logEntry('Ensuring video is playing with enhanced interaction...');

    for (let attempt = 0; attempt < 5; attempt++) {
        const videoState = await page.evaluate(() => {
            const video = document.querySelector('video.html5-main-video, video.rumble-player-video');
            if (video) {
                return {
                    paused: video.paused,
                    currentTime: video.currentTime,
                    readyState: video.readyState,
                    autoplay: video.autoplay,
                    muted: video.muted
                };
            }
            return null;
        }).catch(e => {
            logEntry(`Error getting video state in ensureVideoPlaying: ${e.message}`, 'warn');
            return null;
        });

        if (!videoState) {
            logEntry('No video element found in ensureVideoPlaying', 'warn');
            // Optional: could add a small wait and retry for the element to appear
            if (attempt < 4) {
                 await page.waitForTimeout(1000); continue;
            }
            return false;
        }

        if (!videoState.paused) {
            logEntry(`Video is playing (attempt ${attempt + 1}). Time: ${videoState.currentTime?.toFixed(2)}s`);
            return true;
        }

        logEntry(`Video is paused (attempt ${attempt + 1}). Current time: ${videoState.currentTime?.toFixed(2)}s. ReadyState: ${videoState.readyState}. Muted: ${videoState.muted}. Trying multiple play strategies.`);

        // Strategy 1: Click video element directly
        try {
            logEntry('Strategy 1: Clicking video element directly.');
            await page.locator('video.html5-main-video, video.rumble-player-video').first().click({ timeout: 2000, force: true }); // Added force:true
            await page.waitForTimeout(1000 + Math.random() * 500); // Increased wait
            const stillPausedS1 = await page.evaluate(() => document.querySelector('video.html5-main-video, video.rumble-player-video')?.paused);
            if (stillPausedS1 === false) { // Explicitly check for false
                logEntry('Video started playing after video element click.');
                return true;
            }
             logEntry('Video still paused after video element click or state unchanged.');
        } catch (e) {
            logEntry(`Video element click failed: ${e.message}`, 'debug');
        }

        // Strategy 2: Try play buttons
        logEntry('Strategy 2: Trying play buttons.');
        for (const selector of playButtonSelectors) {
            // Using a temporary logger to pass to clickIfExists
            const tempLoggerForClick = {info: logEntry, debug: logEntry, warning: logEntry, error: logEntry};
            if (await clickIfExists(page, selector, 2000, tempLoggerForClick)) {
                logEntry(`Clicked play button: ${selector}`);
                await page.waitForTimeout(1000 + Math.random() * 500);
                const stillPausedS2 = await page.evaluate(() => document.querySelector('video.html5-main-video, video.rumble-player-video')?.paused);
                 if (stillPausedS2 === false) {
                    logEntry('Video started playing after play button click.');
                    return true;
                }
                logEntry(`Video still paused after clicking ${selector}.`);
            }
        }

        // Strategy 3: JavaScript play() method
        try {
            logEntry('Strategy 3: Attempting JavaScript video.play().');
            await page.evaluate(() => {
                const video = document.querySelector('video.html5-main-video, video.rumble-player-video');
                if (video) {
                    if (video.muted) { // Try unmuting if it helps
                        console.log('[In-Page Eval] Video is muted, unmuting before play attempt.');
                        video.muted = false;
                    }
                    video.play().then(() => {
                        console.log('[In-Page Eval] video.play() promise resolved.');
                    }).catch(err => console.warn('[In-Page Eval] JS video.play() failed:', err.message, err.name));
                } else {
                    console.warn('[In-Page Eval] Video element not found for JS play.');
                }
            });
            await page.waitForTimeout(1500 + Math.random() * 500); // Longer wait for JS play
            const stillPausedS3 = await page.evaluate(() => document.querySelector('video.html5-main-video, video.rumble-player-video')?.paused);
            if (stillPausedS3 === false) {
                logEntry('Video started playing after JavaScript play().');
                return true;
            }
            logEntry('Video still paused after JavaScript play() attempt.');
        } catch (e) {
            logEntry(`JavaScript play evaluation failed: ${e.message}`, 'debug');
        }

        // Strategy 4: Spacebar to play/pause (focus body first)
        try {
            logEntry('Strategy 4: Attempting Spacebar press.');
            await page.locator('body').first().focus().catch(e => logEntry('Failed to focus body for spacebar.', 'debug'));
            await page.keyboard.press('Space');
            await page.waitForTimeout(1000 + Math.random() * 500);
            const stillPausedS4 = await page.evaluate(() => document.querySelector('video.html5-main-video, video.rumble-player-video')?.paused);
            if (stillPausedS4 === false) {
                logEntry('Video started playing after spacebar press.');
                return true;
            }
             logEntry('Video still paused after spacebar press.');
        } catch (e) {
            logEntry(`Spacebar press failed: ${e.message}`, 'debug');
        }

        if (attempt < 4) {
            logEntry(`Waiting ${2000 + attempt * 500}ms before next play attempt...`);
            await page.waitForTimeout(2000 + attempt * 500);
        }
    }

    logEntry('Failed to start video playback after all attempts', 'error');
    return false;
}
// --- END NEW ensureVideoPlaying FUNCTION ---


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
            ? ['.ytp-large-play-button', '.ytp-play-button[aria-label*="Play"]', 'button[title*="Play"]'] // Added more generic play
            : ['.rumbles-player-play-button', 'video.rumble-player-video', 'button[data-plyr="play"]'];

        if (!await ensureVideoPlaying(page, playButtonSelectors, logEntry)) {
            // If ensureVideoPlaying returns false, it means it couldn't start the video.
            // Check if consent dialog might have reappeared. This is a common reason for playback issues.
            logEntry('Video playback could not be confirmed. Checking for reappeared consent dialog...', 'warn');
            const consentHandledAgain = await handleYouTubeConsent(page, loggerToUse);
            if (consentHandledAgain) {
                logEntry('Reappeared consent dialog handled. Retrying video play assurance.');
                if (!await ensureVideoPlaying(page, playButtonSelectors, logEntry)) {
                     throw new Error('Video playback failed even after re-handling consent.');
                }
            } else {
                throw new Error('Video playback failed and no reappeared consent dialog found or handled.');
            }
        }


        await page.evaluate(() => {
            const v = document.querySelector('video.html5-main-video, video.rumble-player-video');
            if(v) {
                v.muted=false; // Ensure unmuted
                v.volume=0.05 + Math.random() * 0.1; // Set a low, randomized volume
                console.log(`[In-Page Eval] Video unmuted, volume set to ${v.volume.toFixed(2)}`);
            }
        }).catch(e => logEntry(`Unmute/volume setting failed: ${e.message}`, 'debug'));

        const duration = await getVideoDuration(page, loggerToUse);
        if (!duration || duration <= 0) throw new Error('Could not determine valid video duration after multiple attempts.');
        jobResult.durationFoundSec = duration;

        const targetWatchTimeSec = Math.floor(duration * (effectiveInput.watchTimePercentage / 100));
        jobResult.watchTimeRequestedSec = targetWatchTimeSec;
        logEntry(`Target watch: ${targetWatchTimeSec.toFixed(2)}s of ${duration.toFixed(2)}s.`);
        if (targetWatchTimeSec <= 0) throw new Error(`Calculated target watch time ${targetWatchTimeSec}s is invalid.`);

        let currentActualWatchTime = 0;
        const watchIntervalMs = 5000; // Check every 5 seconds
        const maxWatchLoops = Math.ceil(targetWatchTimeSec / (watchIntervalMs / 1000)) + 12; // Add buffer for ads/pauses

        for (let i = 0; i < maxWatchLoops; i++) {
            logEntry(`Watch loop ${i+1}/${maxWatchLoops}. Ads check.`);
            await handleAds(page, job.platform, effectiveInput, loggerToUse);
            const videoState = await page.evaluate(() => {
                const v = document.querySelector('video.html5-main-video, video.rumble-player-video');
                return v ? { ct:v.currentTime, p:v.paused, e:v.ended, rs:v.readyState, ns:v.networkState, vol: v.volume, mut: v.muted } : null;
            }).catch(e => { logEntry(`Video state error: ${e.message}`, 'warn'); return null; });

            if (!videoState) {
                logEntry('Video element not found in evaluate (watch loop), attempting to find again.', 'warn');
                await page.waitForTimeout(1000);
                const videoExists = await page.locator('video.html5-main-video, video.rumble-player-video').count() > 0;
                if (!videoExists) throw new Error('Video element disappeared definitively during watch loop.');
                continue;
            }

            logEntry(`State: time=${videoState.ct?.toFixed(2)}, paused=${videoState.p}, ended=${videoState.e}, ready=${videoState.rs}, net=${videoState.ns}, vol=${videoState.vol?.toFixed(2)}, muted=${videoState.mut}`);

            if (videoState.p && !videoState.e) {
                logEntry('Video is paused mid-watch, attempting to ensure it plays.');
                if (!await ensureVideoPlaying(page, playButtonSelectors, logEntry)) {
                    // If still paused after trying to resume, check for consent again
                    logEntry('Video remains paused. Checking for reappeared consent dialog...', 'warn');
                    const consentReappeared = await handleYouTubeConsent(page, loggerToUse);
                    if (consentReappeared) {
                         logEntry('Reappeared consent handled during watch loop. Retrying play assurance.');
                         if(!await ensureVideoPlaying(page, playButtonSelectors, logEntry)) {
                            logEntry('Still could not resume video after re-handling consent. Breaking watch loop.', 'error');
                            break; // Could not resume video
                         }
                    } else {
                        logEntry('Video remains paused, no consent dialog issue. Breaking watch loop.', 'error');
                        break; // Could not resume video
                    }
                }
            }

            currentActualWatchTime = videoState.ct || 0;
            jobResult.watchTimeActualSec = currentActualWatchTime;

            if (currentActualWatchTime >= targetWatchTimeSec || videoState.e) {
                logEntry(`Target watch time reached or video ended. Actual: ${currentActualWatchTime.toFixed(2)}s`);
                break;
            }

            if (i % 6 === 0 && i > 0) { // Every 30 seconds
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

// --- NEW handleYouTubeConsent FUNCTION ---
async function handleYouTubeConsent(page, loggerToUse = GlobalLogger) {
    loggerToUse.info('Handling YouTube consent with Shadow DOM piercing...');

    const findConsentDialog = async () => {
        try {
            const regularDialog = await page.locator('ytd-consent-bump-v2-lightbox').first();
            if (await regularDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
                loggerToUse.info('Found consent dialog in regular DOM');
                return { type: 'regular', locator: regularDialog };
            }
        } catch (e) {
            loggerToUse.debug(`Error checking regular DOM for consent: ${e.message.split('\n')[0]}`);
        }

        try {
            const shadowConsent = await page.evaluate(() => {
                const checkShadowDOM = (element) => {
                    if (element.shadowRoot) {
                        const consentElements = element.shadowRoot.querySelectorAll(
                            'ytd-consent-bump-v2-lightbox, [role="dialog"], tp-yt-paper-dialog' // Common tags for consent dialogs
                        );
                        if (consentElements.length > 0) {
                            // Check if any of these are actually visible (basic check)
                            for(const el of consentElements) {
                                if (el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0) return true;
                            }
                        }
                        for (const child of element.shadowRoot.children) {
                            if (checkShadowDOM(child)) return true;
                        }
                    }
                    return false;
                };
                for (const element of document.querySelectorAll('*')) { // Check all elements
                    if (checkShadowDOM(element)) return true;
                }
                return false;
            });

            if (shadowConsent) {
                loggerToUse.info('Found potential consent dialog indicators in Shadow DOM (via page.evaluate)');
                return { type: 'shadow', locator: null }; // Locator is null as it's within shadow DOM
            }
        } catch (e) {
            loggerToUse.debug(`Shadow DOM consent check (page.evaluate) failed or returned false: ${e.message.split('\n')[0]}`);
        }
        return null;
    };

    const clickConsentButton = async () => {
        const strategies = [
            { name: 'Direct aria-label', selectors: ['button[aria-label*="Accept the use of cookies"]', 'button[aria-label*="Accept all"]'] },
            { name: 'Text content', selectors: ['button:has-text("Accept all")', 'button:has-text("Accept")', '*:has-text("Accept all"):visible:last-child'] }, // added :visible
            { name: 'Within consent container', selectors: ['ytd-consent-bump-v2-lightbox button', 'tp-yt-paper-dialog button', '[role="dialog"] button'] },
            { name: 'Shadow DOM', selectors: ['shadow-button-accept'] } // Placeholder for Shadow DOM logic
        ];

        for (const strategy of strategies) {
            loggerToUse.debug(`Trying consent button strategy: ${strategy.name}`);
            if (strategy.name === 'Shadow DOM') {
                try {
                    const shadowClicked = await page.evaluate(() => {
                        const findAndClickInShadow = (element) => {
                            if (element.shadowRoot) {
                                const buttons = element.shadowRoot.querySelectorAll('button');
                                for (const button of buttons) {
                                    const text = (button.textContent || button.innerText || '').trim().toLowerCase();
                                    const label = (button.getAttribute('aria-label') || '').toLowerCase();
                                    if (text.includes('accept') || label.includes('accept')) {
                                        if (button.offsetWidth > 0 || button.offsetHeight > 0 || button.getClientRects().length > 0) { // Visibility check
                                            button.click();
                                            return true;
                                        }
                                    }
                                }
                                for (const child of element.shadowRoot.children) {
                                    if (findAndClickInShadow(child)) return true;
                                }
                            }
                            return false;
                        };
                        for (const element of document.querySelectorAll('*')) { // Iterate all elements to find the one hosting the shadow DOM
                            if (findAndClickInShadow(element)) return true;
                        }
                        return false;
                    });
                    if (shadowClicked) {
                        loggerToUse.info('Successfully clicked consent button in Shadow DOM via page.evaluate');
                        return true;
                    }
                } catch (e) {
                    loggerToUse.debug(`Shadow DOM click via page.evaluate failed: ${e.message.split('\n')[0]}`);
                }
            } else {
                for (const selector of strategy.selectors) {
                    if (await clickIfExists(page, selector, 3000, loggerToUse)) { // clickIfExists already logs success
                        // loggerToUse.info(`Successfully clicked consent button with selector: ${selector}`); // Redundant due to clickIfExists logging
                        return true;
                    }
                }
            }
        }
        return false;
    };

    for (let attempt = 1; attempt <= 4; attempt++) {
        loggerToUse.info(`Consent attempt ${attempt}/4`);
        await page.waitForTimeout(2000 + (attempt * 1000)); // Wait for page to settle

        const consentDialog = await findConsentDialog();
        if (!consentDialog) {
            loggerToUse.debug(`No consent dialog found in attempt ${attempt}.`);
            if (attempt < 4) continue;
            else {
                loggerToUse.info('No consent dialog found after all attempts - assuming already dismissed or not present.');
                return true; // Assume consent already handled or page doesn't require it
            }
        }

        loggerToUse.info(`Found consent dialog (type: ${consentDialog.type}) - attempting to click accept button.`);
        if (await clickConsentButton()) {
            loggerToUse.info('Consent button clicked. Waiting for dialog to disappear (5s)...');
            await page.waitForTimeout(5000); // Increased wait after click

            const stillVisible = await findConsentDialog(); // Re-check
            if (!stillVisible) {
                loggerToUse.info('Consent dialog successfully dismissed (confirmed by re-check).');
                return true;
            } else {
                loggerToUse.warning(`Consent dialog (type: ${stillVisible.type}) still visible after click attempt ${attempt}.`);
            }
        } else {
            loggerToUse.warning(`Failed to click any consent button in attempt ${attempt}.`);
        }

        if (attempt < 4) {
            loggerToUse.info(`Consent not resolved in attempt ${attempt}, retrying...`);
            // Optional: could try a page reload here or other recovery strategy if attempts keep failing
            // await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => loggerToUse.warn('Page reload failed during consent retry.'));
            // await page.waitForTimeout(3000);
        }
    }

    loggerToUse.error('Failed to handle/dismiss consent dialog after all attempts.');
    // Capture screenshot on final failure if running on Apify
    if (page && typeof ApifyModule !== 'undefined' && ApifyModule.Actor && ApifyModule.Actor.isAtHome() && !page.isClosed()) {
        try {
            const screenshotBuffer = await page.screenshot({fullPage: true, timeout: 10000});
            await ApifyModule.Actor.setValue(`SCREENSHOT_CONSENT_FINAL_FAIL_ATTEMPTS_${uuidv4().substring(0,8)}`, screenshotBuffer, { contentType: 'image/png' });
            loggerToUse.info('Saved screenshot on final consent handling failure.');
        } catch (captureError) {
            loggerToUse.warning(`Could not capture screenshot on final consent failure: ${captureError.message}`);
        }
    }
    return false;
}
// --- END NEW handleYouTubeConsent FUNCTION ---


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

    const detectedTimezone = getTimezoneForProxy(effectiveInput.proxyCountry, effectiveInput.useProxies);
    const detectedLocale = getLocaleForCountry(effectiveInput.proxyCountry);
    logEntry(`Geo settings: Timezone='${detectedTimezone}', Locale='${detectedLocale}' (based on proxyCountry: '${effectiveInput.proxyCountry || 'N/A'}')`);

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

        // --- MODIFIED Viewport and extraHTTPHeaders ---
        context = await browser.newContext({
            bypassCSP: true, ignoreHTTPSErrors: true,
            viewport: {
                width: Math.min(1920, 1280 + Math.floor(Math.random() * 200)),
                height: Math.min(1080, 720 + Math.floor(Math.random() * 100))
            },
            locale: detectedLocale,
            timezoneId: detectedTimezone,
            javaScriptEnabled: true,
            extraHTTPHeaders: { // Added Accept-Language
                'Accept-Language': `${detectedLocale.replace('_', '-')},en;q=0.9`,
            }
        });
        // --- END MODIFIED Viewport ---

        await applyAntiDetectionScripts(context, detectedTimezone);

        if (job.watchType === 'referer' && job.refererUrl) {
            logEntry(`Setting referer to: ${job.refererUrl}`);
            await context.setExtraHTTPHeaders({ 'Referer': job.refererUrl }); // Note: this might override Accept-Language if not careful
        }

        page = await context.newPage();
        // --- MODIFIED page.setViewportSize ---
        await page.setViewportSize({
            width: Math.min(1920, 1200 + Math.floor(Math.random() * 120)),
            height: Math.min(1080, 700 + Math.floor(Math.random() * 80))
        });
        // --- END MODIFIED page.setViewportSize ---


        if (job.watchType === 'search' && job.searchKeywords && job.searchKeywords.length > 0) {
            const keyword = job.searchKeywords[Math.floor(Math.random() * job.searchKeywords.length)];
            logEntry(`Performing search for keyword: "${keyword}" to find video ID: ${job.videoId}`);

            const searchUrl = job.platform === 'youtube'
                ? getYouTubeSearchUrl(keyword, effectiveInput.proxyCountry, detectedLocale)
                : `https://rumble.com/search/video?q=${encodeURIComponent(keyword)}`;

            logEntry(`Navigating to search results: ${searchUrl}`);
            await page.goto(searchUrl, { timeout: effectiveInput.timeout * 1000, waitUntil: 'domcontentloaded' });
            logEntry('Search results page loaded (domcontentloaded).');

            const consentSuccess = await handleYouTubeConsent(page, jobScopedLogger); // Using new consent handler
            if (!consentSuccess) {
                // The new handleYouTubeConsent already logs extensively.
                // It returns true if it thinks consent is handled (even if no dialog was seen).
                // It returns false if it tried and failed.
                logEntry('Consent handling returned false. Proceeding with caution or potential failure.', 'warn');
                // Optional: Could throw an error here if consent is strictly required to proceed.
                // For now, let's proceed as the function might have determined no dialog was present.
            } else {
                 logEntry('Consent handling returned true.');
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

            // --- NEW Search Link Clicking Logic ---
            const findAndClickVideoLink = async () => {
                const videoSelectors = [ // Rumble selectors might need adjustment if this path is taken for Rumble
                    `a#video-title[href*="/watch?v=${job.videoId}"]`,
                    `a[href*="/watch?v=${job.videoId}"]`, // Broader
                    `a[href*="${job.videoId}"]`, // Even broader, good for general cases
                    `ytd-video-renderer a[href*="${job.videoId}"]`, // More specific to YouTube structure
                    `ytd-rich-item-renderer a[href*="${job.videoId}"]` // Another YouTube structure
                ];

                for (const selector of videoSelectors) {
                    try {
                        logEntry(`Looking for video link with selector: ${selector}`);
                        const videoLink = page.locator(selector).first();

                        if (await videoLink.isVisible({ timeout: 5000 }).catch(() => false)) {
                            logEntry('Video link found, scrolling into view...');
                            await videoLink.scrollIntoViewIfNeeded({ timeout: 5000 });
                            await page.waitForTimeout(200 + Math.random() * 300); // Small pause after scroll

                            // Enhanced clicking with human-like behavior
                            const bb = await videoLink.boundingBox();
                            if (bb) {
                                await page.mouse.move(
                                    bb.x + bb.width / 2 + (Math.random() * 20 - 10), // Move towards center with slight random
                                    bb.y + bb.height / 2 + (Math.random() * 20 - 10),
                                    { steps: 3 + Math.floor(Math.random() * 3) } // 3-5 steps
                                );
                                await page.waitForTimeout(100 + Math.random() * 200);
                            } else {
                                 logEntry('Could not get bounding box for mouse move, proceeding with hover/click directly.', 'debug');
                            }


                            await videoLink.hover({ timeout: 3000, force: true }); // force:true can be helpful if obscured
                            await page.waitForTimeout(500 + Math.random() * 1000);

                            const linkHref = await videoLink.getAttribute('href');
                            logEntry(`About to click link with href: ${linkHref} (selector: ${selector})`);

                            await videoLink.click({
                                timeout: 5000,
                                button: 'left',
                                clickCount: 1,
                                delay: 100 + Math.random() * 150, // Randomized delay
                                force: true // Consider force if clicks are not registering
                            });

                            logEntry('Video link click initiated, waiting for navigation...');
                            return true;
                        } else {
                             logEntry(`Selector ${selector} not visible.`, 'debug');
                        }
                    } catch (e) {
                        logEntry(`Attempt with selector ${selector} failed: ${e.message.split('\n')[0]}`, 'debug');
                    }
                }
                return false;
            };

            if (await findAndClickVideoLink()) {
                const navigationPatterns = [
                    `**/watch?v=${job.videoId}`,      // Exact match
                    `**/watch?v=${job.videoId}&*`, // Match with parameters
                    `**/${job.videoId}*`,           // Contains video ID (e.g., for shorts or other formats)
                    `**/watch*`                     // General watch page (less specific)
                ];
                let navigationSuccess = false;
                for (let i = 0; i < navigationPatterns.length; i++) {
                    try {
                        await page.waitForURL(navigationPatterns[i], {
                            timeout: 10000 + (i * 2000), // Increase timeout for broader patterns
                            waitUntil: 'domcontentloaded'
                        });
                        logEntry(`Navigation successful with pattern: ${navigationPatterns[i]}. Current URL: ${page.url()}`);
                        navigationSuccess = true;
                        break;
                    } catch (e) {
                        logEntry(`URL pattern ${navigationPatterns[i]} failed or timed out, trying next... Error: ${e.message.split('\n')[0]}`, 'debug');
                    }
                }

                if (!navigationSuccess) {
                    logEntry('waitForURL patterns failed. Fallback: checking current URL after a delay.', 'warn');
                    await page.waitForTimeout(3000 + Math.random() * 2000); // Wait a bit more for any redirects
                    const currentUrl = page.url();
                    if (currentUrl.includes(job.videoId) || (job.platform === 'youtube' && currentUrl.includes('/watch'))) {
                        logEntry(`Navigation seems to have succeeded based on URL content check: ${currentUrl}`);
                        navigationSuccess = true;
                    } else if (job.platform === 'rumble' && currentUrl.includes(job.videoId)) {
                        logEntry(`Rumble navigation seems to have succeeded based on URL content check: ${currentUrl}`);
                        navigationSuccess = true;
                    }
                }

                if (!navigationSuccess) {
                    const finalUrlForError = page.url();
                    logEntry(`Navigation failed after successful link click. Final URL: ${finalUrlForError}`, 'error');
                    throw new Error(`Navigation failed after link click. Final URL: ${finalUrlForError}`);
                }
                 logEntry(`Successfully navigated to video page (presumably): ${page.url()}`);

            } else {
                 // --- Fallback from original code if findAndClickVideoLink returns false ---
                logEntry(`Could not find or click video link for "${keyword}" (ID: ${job.videoId}) using enhanced findAndClickVideoLink.`, 'error');
                logEntry('Attempting direct navigation as fallback (search failed)...');
                try {
                    await page.goto(job.url, { timeout: 30000, waitUntil: 'domcontentloaded' });
                    logEntry(`Direct navigation fallback succeeded. New URL: ${page.url()}`);
                    const fallbackConsentSuccess = await handleYouTubeConsent(page, jobScopedLogger);
                     if (!fallbackConsentSuccess) {
                        logEntry('Consent handling on direct nav fallback returned false. Proceeding cautiously.', 'warn');
                    } else {
                        logEntry('Consent handling on direct nav fallback returned true.');
                    }
                } catch (directNavError) {
                    logEntry(`Direct navigation fallback also failed: ${directNavError.message.split('\n')[0]}`, 'error');
                    // Save screenshot/HTML (omitted for brevity but would be here)
                    throw new Error(`Failed to find video via search AND direct navigation fallback also failed: ${directNavError.message.split('\n')[0]}`);
                }
            }
            // --- END NEW Search Link Clicking Logic ---

        } else {
            logEntry(`Navigating (direct/referer) to ${job.url} with waitUntil: 'domcontentloaded' (timeout ${effectiveInput.timeout}s).`);
            await page.goto(job.url, { timeout: effectiveInput.timeout * 1000, waitUntil: 'domcontentloaded' });
            logEntry(`Initial navigation to ${job.url} (domcontentloaded) complete.`);
            const consentSuccess = await handleYouTubeConsent(page, jobScopedLogger); // Using new consent handler
            if (!consentSuccess) {
                 logEntry('Consent handling (direct navigation) returned false. Proceeding cautiously.', 'warn');
            } else {
                 logEntry('Consent handling (direct navigation) returned true.');
            }
        }

        try {
            logEntry('Waiting for network idle (up to 30s after navigation/search click/consent)...');
            await page.waitForLoadState('networkidle', { timeout: 30000 });
            logEntry('Network is idle.');
        } catch(e) {
            logEntry(`Network did not become idle within 30s: ${e.message.split('\n')[0]}. Proceeding anyway.`, 'warn');
        }

        const playerSelector = job.platform === 'youtube' ? '#movie_player video.html5-main-video, ytd-player video, video.html5-main-video' : '.rumble-player-video-wrapper video, video.rumble-player, video[class*="video-player"]';
        try {
            logEntry(`Waiting for player element (${playerSelector}) to be visible (60s).`);
            await page.waitForSelector(playerSelector, { state: 'visible', timeout: 60000 });
            logEntry(`Player element (${playerSelector}) is visible.`);
        } catch (videoWaitError) {
            logEntry(`Player element (${playerSelector}) not visible within 60s: ${videoWaitError.message.split('\n')[0]}`, 'error');
            if (page && ApifyModule.Actor.isAtHome() && !page.isClosed()) {
                // Screenshot logic from original code
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
           // Screenshot logic from original code
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
