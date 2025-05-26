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

// --- GEO HELPER FUNCTIONS ---
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

// --- NEW HELPER FUNCTIONS (from latest suggestions) ---
async function setPreventiveConsentCookies(page, loggerToUse) { // Changed parameter name for clarity
    try {
        await page.context().addCookies([
            { name: 'CONSENT', value: 'PENDING+987', domain: '.youtube.com', path: '/' },
            { name: 'SOCS', value: 'CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LmvBg', domain: '.youtube.com', path: '/', secure: true, sameSite: 'None'}, // Common example, might change
            { name: '__Secure-YT-GDPR', value: '1', domain: '.youtube.com', path: '/', secure: true, sameSite: 'Lax' }
        ]);
        loggerToUse.info('Set preventive consent cookies (CONSENT=PENDING+987, SOCS, __Secure-YT-GDPR=1).');
    } catch (e) {
        loggerToUse.debug(`Failed to set preventive cookies: ${e.message}`);
    }
}

// MODIFIED debugPageState to use loggerToUse.info and loggerToUse.warn
async function debugPageState(page, loggerToUse, context = '') {
    if (!page || page.isClosed()) {
        loggerToUse.warn(`Page debug ${context}: Page is closed or undefined. Cannot get state.`);
        return null;
    }
    try {
        const pageInfo = await page.evaluate(() => {
            const info = {
                url: window.location.href,
                title: document.title,
                bodyTextSample: document.body ? document.body.innerText.substring(0, 200).replace(/\s+/g, ' ') : 'No body',
                consentElements: [],
                buttons: []
            };
            const consentSelectors = ['ytd-consent-bump-v2-lightbox', '[role="dialog"]', 'tp-yt-paper-dialog', '.consent-bump', '#consent-bump', '[aria-modal="true"]'];
            consentSelectors.forEach(sel => {
                document.querySelectorAll(sel).forEach((elem, i) => {
                    const style = window.getComputedStyle(elem);
                    info.consentElements.push({
                        tag: elem.tagName,
                        id: elem.id,
                        class: elem.className, // Added class for more info
                        selector: sel,
                        index: i,
                        visible: style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && elem.offsetHeight > 0,
                        hasButtons: elem.querySelectorAll('button').length,
                        text: (elem.innerText || '').substring(0, 100).replace(/\s+/g, ' ')
                    });
                });
            });
            document.querySelectorAll('button').forEach((btn, i) => {
                const text = (btn.innerText || btn.textContent || '').trim();
                const label = (btn.getAttribute('aria-label') || '').trim();
                if (text.toLowerCase().includes('accept') || label.toLowerCase().includes('accept') || text.toLowerCase().includes('agree') || label.toLowerCase().includes('agree')) {
                    const style = window.getComputedStyle(btn);
                    info.buttons.push({
                        index: i,
                        text: text.substring(0, 50),
                        label: label.substring(0, 50),
                        visible: style.display !== 'none' && style.visibility !== 'hidden' && btn.offsetHeight > 0,
                        id: btn.id,
                        class: btn.className
                    });
                }
            });
            return info;
        });
        loggerToUse.info(`Page debug context [${context}]: ${JSON.stringify(pageInfo, null, 2)}`);
        return pageInfo;
    } catch (e) {
        loggerToUse.warn(`Page debug for context [${context}] failed: ${e.message}`);
        return null;
    }
}

async function debugClickElement(page, selector, loggerToUse) { // Changed parameter name
    if (!page || page.isClosed()) {
        loggerToUse.warn(`DebugClickElement: Page is closed for selector ${selector}.`);
        return null;
    }
    try {
        const element = page.locator(selector).first();
        const isPresent = await element.count() > 0;
        if (!isPresent) {
            loggerToUse.debug(`DebugClickElement: Element ${selector} not found.`);
            return { isPresent: false };
        }

        const isVisible = await element.isVisible().catch(() => false);
        const isEnabled = await element.isEnabled().catch(() => false);
        const boundingBox = await element.boundingBox().catch(() => null);
        let inViewport = false;
        if (boundingBox && page.viewportSize()) { // Added check for viewportSize()
            const viewport = page.viewportSize();
                 inViewport = boundingBox.x >= 0 && boundingBox.y >= 0 &&
                                 boundingBox.x + boundingBox.width <= viewport.width &&
                                 boundingBox.y + boundingBox.height <= viewport.height;
        }
        const isActuallyClickable = await page.evaluate((sel) => {
            const elem = document.querySelector(sel);
            if (!elem) return 'not-found';
            const rect = elem.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return 'zero-size';
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const topElement = document.elementFromPoint(centerX, centerY);
            if (!topElement) return 'no-element-at-point';
            if (topElement === elem || elem.contains(topElement)) return 'clickable';
            return `obscured-by-${topElement.tagName}#${topElement.id}.${topElement.className}`;
        }, selector).catch(e => `eval-error: ${e.message}`);

        const debugInfo = { selector, isPresent, isVisible, isEnabled, boundingBox, inViewport, isActuallyClickable };
        loggerToUse.info(`DebugClickElement for ${selector}: ${JSON.stringify(debugInfo)}`);
        return debugInfo;
    } catch (e) {
        loggerToUse.warn(`DebugClickElement for ${selector} failed: ${e.message}`);
        return null;
    }
}
// --- END NEW HELPER FUNCTIONS ---

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
        try { Date.prototype.getTimezoneOffset = function() { return targetOffsetMinutes; }; } catch (e) { console.debug('[AntiDetection] Failed to spoof Date.prototype.getTimezoneOffset:', e.message); }
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
                const shift = { r: Math.floor(Math.random()*10)-5, g: Math.floor(Math.random()*10)-5, b: Math.floor(Math.random()*10)-5, a: Math.floor(Math.random()*10)-5 };
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
            } catch (e) { console.debug('[AntiDetection] Failed screen spoof:', e.message); }
        }
        if (navigator.plugins) try { Object.defineProperty(navigator, 'plugins', { get: () => [], configurable: true }); } catch(e) { console.debug('[AntiDetection] Failed plugin spoof:', e.message); }
        if (navigator.mimeTypes) try { Object.defineProperty(navigator, 'mimeTypes', { get: () => [], configurable: true }); } catch(e) { console.debug('[AntiDetection] Failed mimeType spoof:', e.message); }
    };
    (GlobalLogger || console).debug(`[AntiDetection] Injecting anti-detection script with dynamic timezoneId: ${detectedTimezoneId}`);
    if (pageOrContext.addInitScript) {
        await pageOrContext.addInitScript(antiDetectionFunctionInBrowser, detectedTimezoneId);
    } else if (pageOrContext.evaluateOnNewDocument) { // Fallback for older Playwright or different contexts
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
        await new Promise(resolve => setTimeout(resolve, 1000)); // Use Promise for async/await
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
            const elementForForce = pageOrFrame.locator(selector).first(); // Re-locate for safety, though usually not needed
            await elementForForce.waitFor({ state: 'visible', timeout }); // Re-wait
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
    const maxAdLoopIterations = Math.ceil((effectiveInput.maxSecondsAds * 1000) / adCheckInterval) + 5; // Add buffer

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
        const minSkipTime = Array.isArray(effectiveInput.skipAdsAfter) && effectiveInput.skipAdsAfter.length > 0 ? parseInt(String(effectiveInput.skipAdsAfter[0]),10) : 5; // Ensure string conversion
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

async function ensureVideoPlaying(page, playButtonSelectors, loggerToUse) { // Changed from logEntry to loggerToUse
    loggerToUse.info('Ensuring video is playing with enhanced interaction...');
    for (let attempt = 0; attempt < 5; attempt++) {
        const videoState = await page.evaluate(() => {
            const video = document.querySelector('video.html5-main-video, video.rumble-player-video');
            if (video) return { paused: video.paused, currentTime: video.currentTime, readyState: video.readyState, muted: video.muted };
            return null;
        }).catch(e => { loggerToUse.warn(`Error getting video state in ensureVideoPlaying: ${e.message}`); return null; });

        if (!videoState) {
            loggerToUse.warn('No video element found in ensureVideoPlaying');
            if (attempt < 4) { await page.waitForTimeout(1000); continue; }
            return false;
        }
        if (!videoState.paused) {
            loggerToUse.info(`Video is playing (attempt ${attempt + 1}). Time: ${videoState.currentTime?.toFixed(2)}s`);
            return true;
        }
        loggerToUse.info(`Video is paused (attempt ${attempt + 1}). CT: ${videoState.currentTime?.toFixed(2)}s. RS: ${videoState.readyState}. Muted: ${videoState.muted}. Trying play strategies.`);

        try {
            loggerToUse.debug('Strategy 1: Clicking video element directly.');
            await page.locator('video.html5-main-video, video.rumble-player-video').first().click({ timeout: 2000, force: true });
            await page.waitForTimeout(1000 + Math.random() * 500);
            if (await page.evaluate(() => document.querySelector('video.html5-main-video, video.rumble-player-video')?.paused === false)) {
                loggerToUse.info('Video started playing after video element click.'); return true;
            }
            loggerToUse.debug('Video still paused after video element click.');
        } catch (e) { loggerToUse.debug(`Video element click failed: ${e.message}`); }

        loggerToUse.debug('Strategy 2: Trying play buttons.');
        for (const selector of playButtonSelectors) {
            if (await clickIfExists(page, selector, 2000, loggerToUse)) { // Pass loggerToUse directly
                loggerToUse.info(`Clicked play button: ${selector}`); // clickIfExists logs its own success, this is redundant but ok
                await page.waitForTimeout(1000 + Math.random() * 500);
                if (await page.evaluate(() => document.querySelector('video.html5-main-video, video.rumble-player-video')?.paused === false)) {
                    loggerToUse.info('Video started playing after play button click.'); return true;
                }
                loggerToUse.debug(`Video still paused after clicking ${selector}.`);
            }
        }

        try {
            loggerToUse.debug('Strategy 3: Attempting JavaScript video.play().');
            await page.evaluate(() => {
                const video = document.querySelector('video.html5-main-video, video.rumble-player-video');
                if (video) {
                    if (video.muted) { console.log('[In-Page Eval] Video is muted, unmuting before play.'); video.muted = false; }
                    video.play().then(() => console.log('[In-Page Eval] video.play() promise resolved.')).catch(err => console.warn('[In-Page Eval] JS video.play() failed:', err.message, err.name));
                } else console.warn('[In-Page Eval] Video element not found for JS play.');
            });
            await page.waitForTimeout(1500 + Math.random() * 500);
            if (await page.evaluate(() => document.querySelector('video.html5-main-video, video.rumble-player-video')?.paused === false)) {
                loggerToUse.info('Video started playing after JavaScript play().'); return true;
            }
            loggerToUse.debug('Video still paused after JavaScript play() attempt.');
        } catch (e) { loggerToUse.debug(`JavaScript play evaluation failed: ${e.message}`); }

        try {
            loggerToUse.debug('Strategy 4: Attempting Spacebar press.');
            await page.locator('body').first().focus({timeout:1000}).catch(e => loggerToUse.debug('Failed to focus body for spacebar.'));
            await page.keyboard.press('Space');
            await page.waitForTimeout(1000 + Math.random() * 500);
            if (await page.evaluate(() => document.querySelector('video.html5-main-video, video.rumble-player-video')?.paused === false)) {
                loggerToUse.info('Video started playing after spacebar press.'); return true;
            }
            loggerToUse.debug('Video still paused after spacebar press.');
        } catch (e) { loggerToUse.debug(`Spacebar press failed: ${e.message}`); }

        if (attempt < 4) {
            loggerToUse.debug(`Waiting ${2000 + attempt * 500}ms before next play attempt...`);
            await page.waitForTimeout(2000 + attempt * 500);
        }
    }
    loggerToUse.error('Failed to start video playback after all attempts');
    return false;
}

async function watchVideoOnPage(page, job, effectiveInput, loggerToUse = GlobalLogger) {
    const jobResult = {
        jobId: job.id, url: job.url, videoId: job.videoId, platform: job.platform, status: 'pending',
        watchTimeRequestedSec: 0, watchTimeActualSec: 0, durationFoundSec: null,
        startTime: new Date().toISOString(), endTime: null, error: null, log: []
    };
    // Define logEntry for this scope, using the passed loggerToUse
    const logEntry = (msg, level = 'info') => {
        const formattedMessage = `[Job ${job.id.substring(0,6)}] ${msg}`; // Ensure job context in message
        if (loggerToUse && typeof loggerToUse[level] === 'function') {
            loggerToUse[level](formattedMessage);
        } else { // Fallback if loggerToUse is not a full logger object
            (GlobalLogger || console)[level](formattedMessage);
        }
        jobResult.log.push(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`); // Original message for job log
    };


    try {
        logEntry('Handling initial ads.');
        await handleAds(page, job.platform, effectiveInput, loggerToUse);
        logEntry(`Attempting to play video: ${job.url}`);

        const playButtonSelectors = job.platform === 'youtube'
            ? ['.ytp-large-play-button', '.ytp-play-button[aria-label*="Play"]', 'button[title*="Play"]']
            : ['.rumbles-player-play-button', 'video.rumble-player-video', 'button[data-plyr="play"]'];

        if (!await ensureVideoPlaying(page, playButtonSelectors, loggerToUse)) { // Pass loggerToUse
            logEntry('Video playback could not be confirmed. Checking for reappeared consent dialog...', 'warn');
            const consentHandledAgain = await handleYouTubeConsent(page, loggerToUse); // Pass loggerToUse
            if (consentHandledAgain) {
                logEntry('Reappeared consent dialog handled. Retrying video play assurance.');
                if (!await ensureVideoPlaying(page, playButtonSelectors, loggerToUse)) { // Pass loggerToUse
                     throw new Error('Video playback failed even after re-handling consent.');
                }
            } else {
                throw new Error('Video playback failed and no reappeared consent dialog found or handled.');
            }
        }

        await page.evaluate(() => {
            const v = document.querySelector('video.html5-main-video, video.rumble-player-video');
            if(v) {
                v.muted=false; v.volume=0.05 + Math.random() * 0.1;
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
        const watchIntervalMs = 5000;
        const maxWatchLoops = Math.ceil(targetWatchTimeSec / (watchIntervalMs / 1000)) + 12;

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
                if (!await ensureVideoPlaying(page, playButtonSelectors, loggerToUse)) { // Pass loggerToUse
                    logEntry('Video remains paused. Checking for reappeared consent dialog (mid-watch)...', 'warn');
                    const consentReappeared = await handleYouTubeConsent(page, loggerToUse); // Pass loggerToUse
                    if (consentReappeared) {
                         logEntry('Reappeared consent handled during watch loop. Retrying play assurance.');
                         if(!await ensureVideoPlaying(page, playButtonSelectors, loggerToUse)) { // Pass loggerToUse
                            logEntry('Still could not resume video after re-handling consent. Breaking watch loop.', 'error'); break;
                         }
                    } else {
                        logEntry('Video remains paused, no consent dialog issue. Breaking watch loop.', 'error'); break;
                    }
                }
            }
            currentActualWatchTime = videoState.ct || 0;
            jobResult.watchTimeActualSec = currentActualWatchTime;
            if (currentActualWatchTime >= targetWatchTimeSec || videoState.e) {
                logEntry(`Target watch time reached or video ended. Actual: ${currentActualWatchTime.toFixed(2)}s`); break;
            }
            if (i % 6 === 0 && i > 0) {
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

// --- NEW COMPREHENSIVE handleYouTubeConsent FUNCTION ---
async function handleYouTubeConsent(page, loggerToUse = GlobalLogger) {
    loggerToUse.info('Handling YouTube consent with comprehensive detection strategies...');

    const checkForConsentIndicators = async () => {
        try {
            const consentIndicators = [
                'ytd-consent-bump-v2-lightbox', '[role="dialog"]', '.consent-bump', '#consent-bump',
                'tp-yt-paper-dialog', '[aria-label*="consent"]', '[aria-label*="cookie"]',
                '[aria-label*="privacy"]', 'iframe[src*="consent"]', '.cookie-banner', '.privacy-notice',
                '[aria-modal="true"]'
            ];
            for (const selector of consentIndicators) {
                const elements = page.locator(selector);
                const count = await elements.count();
                if (count > 0) {
                    loggerToUse.debug(`Found ${count} potential consent indicator(s) with selector: ${selector}`);
                    for (let i = 0; i < Math.min(count, 3); i++) {
                        const element = elements.nth(i);
                        const isVisible = await element.isVisible({ timeout: 500 }).catch(() => false);
                        if (isVisible) {
                            loggerToUse.info(`Consent element ${selector} (index ${i}) is visible.`);
                            return { found: true, selector, visible: true };
                        }
                    }
                }
            }
            const hiddenConsentEval = await page.evaluate(() => {
                const selectors = ['ytd-consent-bump-v2-lightbox', '[role="dialog"]', 'tp-yt-paper-dialog'];
                for (const sel of selectors) {
                    const elements = document.querySelectorAll(sel);
                    for (const elem of elements) {
                        const style = window.getComputedStyle(elem);
                        if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && elem.offsetHeight > 0) {
                            return { selector: sel, hidden: false, hasButtons: elem.querySelectorAll('button').length > 0 };
                        } else if (elem.querySelectorAll('button').length > 0) {
                            return { selector: sel, hidden: true, hasButtons: true };
                        }
                    }
                }
                return null;
            }).catch(e => { loggerToUse.debug(`Eval for hidden consent failed: ${e.message}`); return null; });

            if (hiddenConsentEval) {
                loggerToUse.info(`Found consent dialog via eval: ${JSON.stringify(hiddenConsentEval)}`);
                return { found: true, selector: hiddenConsentEval.selector, visible: !hiddenConsentEval.hidden };
            }
            return { found: false };
        } catch (e) {
            loggerToUse.debug(`Consent indicator check failed: ${e.message.split('\n')[0]}`);
            return { found: false };
        }
    };

    const findAndClickConsentButtons = async () => {
        const buttonStrategies = [
            { name: 'Direct Accept Buttons', selectors: [
                'button[aria-label*="Accept the use of cookies"]', 'button[aria-label*="Accept all"]',
                'button:has-text("Accept all")', 'button:has-text("Accept")',
                '[data-testid*="accept"]', '.consent-accept', '#consent-accept' ]},
            { name: 'Within Consent Containers', selectors: [
                'ytd-consent-bump-v2-lightbox button', 'tp-yt-paper-dialog button',
                '[role="dialog"] button', '.consent-bump button', '#consent-bump button' ]},
            { name: 'Button Text Content (more generic, try last)', selectors: [
                '*:has-text("Accept all"):visible:last-child', '*:has-text("I agree"):visible:last-child',
                '*:has-text("Continue"):visible:last-child', '*:has-text("Agree"):visible:last-child' ]}
        ];
        for (const strategy of buttonStrategies) {
            loggerToUse.debug(`Trying button strategy: ${strategy.name}`);
            for (const selector of strategy.selectors) {
                try {
                    const buttons = page.locator(selector);
                    const count = await buttons.count();
                    if (count > 0) {
                        loggerToUse.debug(`Found ${count} button(s) with selector: ${selector}`);
                        for (let i=0; i<count; ++i) {
                            const button = buttons.nth(i);
                            if (await button.isVisible({ timeout: 1000 }).catch(() => false) &&
                                await button.isEnabled({ timeout: 1000 }).catch(() => false)) {
                                loggerToUse.info(`Attempting to click consent button (selector: "${selector}", index: ${i})`);
                                const clickStrategies = [
                                    async () => { loggerToUse.debug('Attempting normal click.'); await button.click({ timeout: 3000, position: { x: 5, y: 5 } }); },
                                    async () => { loggerToUse.debug('Attempting force click.'); await button.click({ force: true, timeout: 3000 }); },
                                    async () => { loggerToUse.debug('Attempting JS click.'); await button.evaluate(node => node.click()); }
                                ];
                                for (const clickFn of clickStrategies) {
                                    try {
                                        await clickFn();
                                        loggerToUse.info(`Successfully clicked button with selector: "${selector}", index: ${i}`);
                                        return true;
                                    } catch (clickError) {
                                        loggerToUse.debug(`Click failed for "${selector}" (index ${i}): ${clickError.message.split('\n')[0]}`);
                                    }
                                }
                            } else {
                                 loggerToUse.debug(`Button "${selector}" (index ${i}) not visible or enabled.`);
                            }
                        }
                    }
                } catch (e) {
                    loggerToUse.debug(`Button selector "${selector}" evaluation failed: ${e.message.split('\n')[0]}`);
                }
            }
        }
        return false;
    };

    const handleShadowDOMConsent = async () => {
        try {
            const shadowResult = await page.evaluate(() => {
                let clickedInfo = { success: false, elementDetails: 'None' };
                function findInShadow(element) {
                    if (clickedInfo.success) return;
                    if (element.shadowRoot) {
                        const buttons = element.shadowRoot.querySelectorAll('button, [role="button"], [jsaction*="click"]');
                        for (const elem of buttons) {
                            const text = (elem.textContent || elem.innerText || '').trim().toLowerCase();
                            const label = (elem.getAttribute('aria-label') || '').toLowerCase();
                            if (text.includes('accept') || label.includes('accept') || text.includes('agree') || label.includes('agree')) {
                                const style = window.getComputedStyle(elem);
                                if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && elem.offsetHeight > 0) {
                                    elem.click();
                                    clickedInfo = { success: true, elementDetails: `Tag: ${elem.tagName}, Text: ${text.substring(0,30)}, Label: ${label.substring(0,30)}` };
                                    return;
                                }
                            }
                        }
                        if (clickedInfo.success) return;
                        for (const child of element.shadowRoot.children) findInShadow(child);
                    }
                }
                document.querySelectorAll('*').forEach(el => findInShadow(el));
                return clickedInfo;
            });
            if (shadowResult.success) {
                loggerToUse.info(`Successfully clicked consent in Shadow DOM: ${JSON.stringify(shadowResult)}`);
                return true;
            }
        } catch (e) {
            loggerToUse.debug(`Shadow DOM consent handling failed: ${e.message.split('\n')[0]}`);
        }
        return false;
    };

    const forceConsentAcceptance = async () => {
        try {
            const result = await page.evaluate(() => {
                const consentCookies = [ { name: 'CONSENT', value: 'YES+.' + new Date().toISOString().split('T')[0].replace(/-/g,'') } ];
                let cookiesSetCount = 0;
                for (const cookie of consentCookies) {
                    document.cookie = `${cookie.name}=${cookie.value}; path=/; domain=.youtube.com; max-age=31536000`;
                    cookiesSetCount++;
                }
                let eventsDispatched = 0;
                try {
                    window.dispatchEvent(new Event('consent-accepted', { bubbles: true, cancelable: true })); eventsDispatched++;
                    window.dispatchEvent(new CustomEvent('youtube-consent', { detail: { accepted: true }, bubbles: true, cancelable: true })); eventsDispatched++;
                } catch (e) { console.debug('[In-Page Eval] Event dispatch for consent failed:', e.message); }

                const overlays = document.querySelectorAll('ytd-consent-bump-v2-lightbox, [role="dialog"][aria-modal="true"], tp-yt-paper-dialog.ytd-popup-container, div[aria-live="assertive"][role="alertdialog"]');
                let removed = 0;
                overlays.forEach(overlay => {
                    try { overlay.style.display = 'none'; removed++; } catch (e) { console.debug('[In-Page Eval] Failed to hide overlay:', e.message); }
                });
                return { cookiesSet: cookiesSetCount, eventsDispatched, overlaysRemovedOrHidden: removed };
            });
            if (result.overlaysRemovedOrHidden > 0 || result.cookiesSet > 0) {
                loggerToUse.info(`Force consent strategy: Cookies Set=${result.cookiesSet}, Events Dispatched=${result.eventsDispatched}, Overlays Hidden/Removed=${result.overlaysRemovedOrHidden}`);
                return true;
            }
        } catch (e) {
            loggerToUse.debug(`Force consent acceptance (JS eval) failed: ${e.message.split('\n')[0]}`);
        }
        return false;
    };

    for (let attempt = 1; attempt <= 5; attempt++) {
        loggerToUse.info(`Consent handling attempt ${attempt}/5`);
        await page.waitForTimeout(1500 + (attempt * 750));

        const consentCheck = await checkForConsentIndicators();
        loggerToUse.info(`Consent indicator check (attempt ${attempt}): ${JSON.stringify(consentCheck)}`);

        if (consentCheck.found) {
            const strategies = [
                { name: 'Button Clicking (DOM)', fn: findAndClickConsentButtons },
                { name: 'Shadow DOM Clicking', fn: handleShadowDOMConsent },
                { name: 'Force Acceptance (JS)', fn: forceConsentAcceptance }
            ];
            for (const strategy of strategies) {
                loggerToUse.info(`Attempting consent strategy: ${strategy.name}`);
                if (await strategy.fn()) {
                    loggerToUse.info(`Consent strategy "${strategy.name}" reported success. Waiting to verify...`);
                    await page.waitForTimeout(3000 + Math.random() * 1000);
                    const stillThereCheck = await checkForConsentIndicators();
                    if (!stillThereCheck.found || !stillThereCheck.visible) {
                        loggerToUse.info('Consent dialog confirmed removed/hidden after strategy execution.');
                        return true;
                    } else {
                        loggerToUse.warning(`Consent dialog (type: ${stillThereCheck.selector}, visible: ${stillThereCheck.visible}) still present after "${strategy.name}" strategy.`);
                    }
                } else {
                     loggerToUse.debug(`Consent strategy "${strategy.name}" did not report success.`);
                }
            }
        } else {
            loggerToUse.info(`No active consent dialog indicators found in attempt ${attempt}.`);
            if (attempt >= 2) {
                 loggerToUse.info('No consent dialog found after multiple checks - assuming already dismissed or not presented.');
                 return true;
            }
        }
        if (attempt < 5) loggerToUse.info(`Consent not definitively resolved in attempt ${attempt}, retrying...`);
    }
    loggerToUse.warning('Consent handling completed after all attempts with uncertain final state. Possible hidden dialog or persistent issue.');
    if (page && !page.isClosed() && typeof ApifyModule !== 'undefined' && ApifyModule.Actor && ApifyModule.Actor.isAtHome && ApifyModule.Actor.isAtHome()) {
        try {
            const screenshotBuffer = await page.screenshot({fullPage: true, timeout: 10000});
            await ApifyModule.Actor.setValue(`SCREENSHOT_CONSENT_UNCERTAIN_${uuidv4().substring(0,8)}`, screenshotBuffer, { contentType: 'image/png' });
            loggerToUse.info('Saved screenshot on uncertain consent handling outcome.');
        } catch (captureError) {
            loggerToUse.warning(`Could not capture screenshot on uncertain consent: ${captureError.message}`);
        }
    }
    return false;
}
// --- END NEW COMPREHENSIVE handleYouTubeConsent FUNCTION ---


async function runSingleJob(job, effectiveInput, actorProxyConfiguration, customProxyPool, logger) {
    const jobScopedLogger = {
        info: (msg) => logger.info(`[Job ${job.id.substring(0,6)}] ${msg}`),
        warning: (msg) => logger.warning(`[Job ${job.id.substring(0,6)}] ${msg}`),
        error: (msg, data) => logger.error(`[Job ${job.id.substring(0,6)}] ${msg}`, data), // Accept data for error
        debug: (msg) => logger.debug(`[Job ${job.id.substring(0,6)}] ${msg}`),
    };
    const jobResult = {
        jobId: job.id, url: job.url, videoId: job.videoId, platform: job.platform,
        proxyUsed: 'None', status: 'initiated', error: null, log: []
    };
    // logEntry defined within runSingleJob to capture job-specific details in jobResult.log
    const logEntry = (msg, level = 'info') => {
        const tsMsg = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`;
        // Use jobScopedLogger for console/Apify logs
        if (jobScopedLogger && typeof jobScopedLogger[level] === 'function') {
            // jobScopedLogger already prepends job ID to console logs
            jobScopedLogger[level](msg);
        } else {
            // Fallback if jobScopedLogger somehow isn't right
            const fallbackLogger = GlobalLogger || console;
            if (fallbackLogger && typeof fallbackLogger[level] === 'function') {
                 fallbackLogger[level](`[Job ${job.id.substring(0,6)}] ${msg}`);
            } else {
                console.log(`[${level.toUpperCase()}] [Job ${job.id.substring(0,6)}] ${msg}`);
            }
        }
        jobResult.log.push(tsMsg); // Store raw message with timestamp for detailed job log
    };

    logEntry(`Starting job for URL: ${job.url} with watchType: ${job.watchType}`);
    let browser; let context; let page;
    const detectedTimezone = getTimezoneForProxy(effectiveInput.proxyCountry, effectiveInput.useProxies);
    const detectedLocale = getLocaleForCountry(effectiveInput.proxyCountry);
    logEntry(`Geo settings: Timezone='${detectedTimezone}', Locale='${detectedLocale}' (ProxyCountry: '${effectiveInput.proxyCountry || 'N/A'}')`);

    try {
        const launchOptions = { headless: effectiveInput.headless, args: [...ANTI_DETECTION_ARGS] };
        if (effectiveInput.useProxies) {
            if (customProxyPool && customProxyPool.length > 0) {
                const proxyUrlToUse = customProxyPool[Math.floor(Math.random() * customProxyPool.length)];
                logEntry(`Using custom proxy (host: ${proxyUrlToUse.split('@').pop().split(':')[0]})`);
                try {
                    const parsedProxyUrl = new URL(proxyUrlToUse);
                    launchOptions.proxy = {
                        server: `${parsedProxyUrl.protocol}//${parsedProxyUrl.hostname}:${parsedProxyUrl.port}`,
                        username: parsedProxyUrl.username || undefined, password: parsedProxyUrl.password || undefined
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
                    const proxyUrlToUse = await actorProxyConfiguration.newUrl(sessionId);
                    const parsedProxyUrl = new URL(proxyUrlToUse);
                    launchOptions.proxy = {
                        server: `${parsedProxyUrl.protocol}//${parsedProxyUrl.hostname}:${parsedProxyUrl.port}`,
                        username: parsedProxyUrl.username || undefined, password: parsedProxyUrl.password || undefined
                    };
                    const proxyIp = parsedProxyUrl.hostname;
                    logEntry(`Using Apify proxy (Session: ${sessionId}, IP: ${proxyIp}, Auth: ${launchOptions.proxy.username ? 'yes' : 'no'})`);
                    jobResult.proxyUsed = `ApifyProxy (${proxyIp})`;
                } catch (proxyError) {
                    logEntry(`Failed to get Apify proxy URL: ${proxyError.message}`, 'error');
                    throw new Error(`Apify Proxy acquisition failed: ${proxyError.message}`);
                }
            } else { logEntry('No proxies configured. Running directly.', 'warn'); }
        }

        logEntry('Attempting to launch browser...');
        browser = (typeof ApifyModule !== 'undefined' && ApifyModule.Actor && ApifyModule.Actor.isAtHome && ApifyModule.Actor.isAtHome() && ApifyModule.Actor.launchPlaywright)
            ? await ApifyModule.Actor.launchPlaywright(launchOptions)
            : await playwright.chromium.launch(launchOptions);
        logEntry('Browser launched.');

        const existingHeaders = launchOptions.extraHTTPHeaders || {};
        context = await browser.newContext({
            bypassCSP: true, ignoreHTTPSErrors: true,
            viewport: { width: Math.min(1920, 1280 + Math.floor(Math.random() * 200)), height: Math.min(1080, 720 + Math.floor(Math.random() * 100)) },
            locale: detectedLocale, timezoneId: detectedTimezone, javaScriptEnabled: true,
            extraHTTPHeaders: { ...existingHeaders, 'Accept-Language': `${detectedLocale.replace('_', '-')},en;q=0.9` } // Merge with existing
        });
        await applyAntiDetectionScripts(context, detectedTimezone);

        if (job.watchType === 'referer' && job.refererUrl) {
            logEntry(`Setting referer to: ${job.refererUrl}`);
            // Get current extraHTTPHeaders from context to preserve them
            const currentExtraHeaders = context._options.extraHTTPHeaders || {}; // Accessing internal option, might need adjustment based on Playwright version or use a safer method if available
            await context.setExtraHTTPHeaders({ ...currentExtraHeaders, 'Referer': job.refererUrl });
        }


        page = await context.newPage();
        await page.setViewportSize({ width: Math.min(1920, 1200 + Math.floor(Math.random() * 120)), height: Math.min(1080, 700 + Math.floor(Math.random() * 80)) });

        await setPreventiveConsentCookies(page, jobScopedLogger); // Pass jobScopedLogger

        if (job.watchType === 'search' && job.searchKeywords && job.searchKeywords.length > 0) {
            const keyword = job.searchKeywords[Math.floor(Math.random() * job.searchKeywords.length)];
            const searchUrl = job.platform === 'youtube'
                ? getYouTubeSearchUrl(keyword, effectiveInput.proxyCountry, detectedLocale)
                : `https://rumble.com/search/video?q=${encodeURIComponent(keyword)}`;

            logEntry(`Navigating to search results: ${searchUrl}`);
            await page.goto(searchUrl, { timeout: effectiveInput.timeout * 1000, waitUntil: 'domcontentloaded' });
            logEntry('Search results page loaded (domcontentloaded).');

            await debugPageState(page, jobScopedLogger, 'before initial consent (search page)');
            logEntry('Handling consent before search interactions...');
            const searchConsentHandled = await handleYouTubeConsent(page, jobScopedLogger);
            await debugPageState(page, jobScopedLogger, 'after initial consent (search page)');
            if (!searchConsentHandled) logEntry('Consent handling on search page returned false/uncertain. Proceeding with caution.', 'warn');
            else logEntry('Consent handling on search page returned true.');

            logEntry('Waiting for page stabilization after consent...');
            await page.waitForTimeout(2000 + Math.random() * 1000);
            try {
                await page.waitForFunction(() => document.querySelectorAll('ytd-video-renderer, #contents ytd-rich-item-renderer').length > 0, { timeout: 10000 });
                logEntry('Search results confirmed loaded.');
            } catch (e) { logEntry(`Search results check failed: ${e.message.split('\n')[0]}`, 'warn');}

            const findAndClickVideoLink = async () => {
                const videoSelectors = [
                    `a#video-title[href*="/watch?v=${job.videoId}"]`, `ytd-video-renderer a[href*="/watch?v=${job.videoId}"]`,
                    `ytd-rich-item-renderer a[href*="/watch?v=${job.videoId}"]`, `a[href*="/watch?v=${job.videoId}"]`
                ];
                for (const selector of videoSelectors) {
                    try {
                        logEntry(`Looking for video link with selector: ${selector}`);
                        const videoLink = page.locator(selector).first();
                        if (await videoLink.isVisible({ timeout: 3000 }).catch(() => false)) {
                            logEntry('Video link found, scrolling into view...');
                            await videoLink.scrollIntoViewIfNeeded({ timeout: 3000 });
                            await page.waitForTimeout(200 + Math.random() * 300);
                            const linkHref = await videoLink.getAttribute('href');
                            if (!linkHref) { logEntry(`Link (selector ${selector}) has no href. Skipping.`, 'warn'); continue; }
                            logEntry(`Found link with href: ${linkHref} (selector: ${selector})`);

                            // Strategy 1: Normal click
                            try {
                                logEntry('Attempting Strategy 1: Normal Click + waitForURL.');
                                const navigationPromise = page.waitForURL(url => url.includes('/watch') && url.includes(job.videoId), { timeout: 15000, waitUntil: 'domcontentloaded' });
                                await videoLink.hover({ timeout: 1000, force: true });
                                await page.waitForTimeout(100 + Math.random() * 200);
                                await videoLink.click({ timeout: 3000, delay: 50 + Math.random() * 100, button: 'left', clickCount: 1 });
                                logEntry('Normal click initiated, waiting for navigation...');
                                await navigationPromise;
                                logEntry(`Navigation successful (S1). New URL: ${page.url()}`); return true;
                            } catch (navError) { logEntry(`S1 (Normal Click) failed: ${navError.message.split('\n')[0]}`, 'debug'); }

                            // Strategy 2: Force click
                            try {
                                logEntry('Attempting Strategy 2: Force Click + waitForURL.');
                                const navigationPromise = page.waitForURL(url => url.includes('/watch') && url.includes(job.videoId), { timeout: 10000, waitUntil: 'domcontentloaded' });
                                await videoLink.click({ force: true, timeout: 3000 });
                                logEntry('Force click initiated, waiting for navigation...');
                                await navigationPromise;
                                logEntry(`Navigation successful (S2). New URL: ${page.url()}`); return true;
                            } catch (forceError) { logEntry(`S2 (Force Click) failed: ${forceError.message.split('\n')[0]}`, 'debug'); }

                            // Strategy 3: JavaScript click
                            try {
                                logEntry('Attempting Strategy 3: JS Click + waitForURL.');
                                const navigationPromise = page.waitForURL(url => url.includes('/watch') && url.includes(job.videoId), { timeout: 10000, waitUntil: 'domcontentloaded' });
                                await videoLink.evaluate(node => node.click());
                                logEntry('JS click initiated, waiting for navigation...');
                                await navigationPromise;
                                logEntry(`Navigation successful (S3). New URL: ${page.url()}`); return true;
                            } catch (jsError) { logEntry(`S3 (JS Click) failed: ${jsError.message.split('\n')[0]}`, 'debug'); }

                            // Strategy 4: Direct navigation
                            try {
                                logEntry('Attempting Strategy 4: Direct Navigation (goto href).');
                                let fullUrl = linkHref;
                                if (linkHref.startsWith('/')) { fullUrl = `${new URL(page.url()).origin}${linkHref}`; }
                                else if (!linkHref.startsWith('http')) { logEntry(`Unusual href: ${linkHref}. Skip direct nav.`, 'warn'); continue; }
                                logEntry(`Attempting direct navigation to: ${fullUrl}`);
                                await page.goto(fullUrl, { timeout: 15000, waitUntil: 'domcontentloaded' });
                                if (page.url().includes(job.videoId)) { logEntry(`Navigation successful (S4). New URL: ${page.url()}`); return true; }
                                else { logEntry(`Direct goto to ${fullUrl} -> ${page.url()} (no videoId).`, 'warn'); }
                            } catch (gotoError) { logEntry(`S4 (Direct Nav) failed: ${gotoError.message.split('\n')[0]}`, 'debug'); }
                        } else { logEntry(`Link (selector ${selector}) not visible.`, 'debug'); }
                    } catch (e) { logEntry(`Error processing selector ${selector}: ${e.message.split('\n')[0]}`, 'debug'); }
                }
                logEntry('All click/goto strategies for found links failed. Trying Keyboard nav as a last resort.');
                const firstPlausibleSelector = `a#video-title[href*="/watch?v=${job.videoId}"]`;
                try {
                    const videoLinkForKeyboard = page.locator(firstPlausibleSelector).first();
                    if (await videoLinkForKeyboard.isVisible({timeout: 2000}).catch(()=>false)) {
                        logEntry('Attempting Strategy 5: Keyboard Navigation (Enter).');
                        await videoLinkForKeyboard.focus({ timeout: 2000 });
                        const navigationPromise = page.waitForURL(url => url.includes('/watch') && url.includes(job.videoId), { timeout: 10000, waitUntil: 'domcontentloaded' });
                        await page.keyboard.press('Enter');
                        logEntry('Enter pressed, waiting for navigation...');
                        await navigationPromise;
                        logEntry(`Navigation successful (S5). New URL: ${page.url()}`); return true;
                    }
                } catch (keyboardError) { logEntry(`S5 (Keyboard Nav) failed: ${keyboardError.message.split('\n')[0]}`, 'debug'); }
                return false;
            };

            if (await findAndClickVideoLink()) {
                if (!page.url().includes(job.videoId) && !(job.platform === 'youtube' && page.url().includes('/watch'))) {
                    logEntry(`findAndClickVideoLink OK, but URL (${page.url()}) mismatch videoId (${job.videoId}).`, 'warn');
                } else { logEntry(`Successfully navigated to video page after search click: ${page.url()}`); }
            } else {
                logEntry(`Could not find/click video link for "${keyword}" (ID: ${job.videoId}) after all strategies.`, 'error');
                logEntry('Attempting direct navigation as primary fallback (search click failed).');
                try {
                    await page.goto(job.url, { timeout: 30000, waitUntil: 'domcontentloaded' });
                    logEntry(`Direct navigation fallback succeeded. New URL: ${page.url()}`);
                    await debugPageState(page, jobScopedLogger, 'before consent (direct nav fallback)');
                    const directNavConsent = await handleYouTubeConsent(page, jobScopedLogger);
                    await debugPageState(page, jobScopedLogger, 'after consent (direct nav fallback)');
                    if (!directNavConsent) logEntry('Consent handling on direct nav fallback returned false/uncertain.', 'warn');
                } catch (directNavError) {
                    throw new Error(`Failed video via search strategies AND direct nav fallback failed: ${directNavError.message.split('\n')[0]}`);
                }
            }
        } else {
            logEntry(`Navigating (direct/referer) to ${job.url}.`);
            await page.goto(job.url, { timeout: effectiveInput.timeout * 1000, waitUntil: 'domcontentloaded' });
            logEntry(`Initial navigation to ${job.url} (domcontentloaded) complete.`);
            await debugPageState(page, jobScopedLogger, 'before initial consent (direct/referer)');
            const directConsentSuccess = await handleYouTubeConsent(page, jobScopedLogger);
            await debugPageState(page, jobScopedLogger, 'after initial consent (direct/referer)');
            if (!directConsentSuccess) logEntry('Consent handling (direct/referer nav) returned false/uncertain.', 'warn');
        }

        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(e => logEntry(`Network idle timed out: ${e.message.split('\n')[0]}`, 'warn'));
        const playerSelector = job.platform === 'youtube' ? 'ytd-player video, video.html5-main-video' : 'video.rumble-player-video, div.rumble-player-video-wrapper video';
        await page.waitForSelector(playerSelector, { state: 'visible', timeout: 60000 });
        logEntry(`Player element (${playerSelector}) is visible.`);

        const watchResult = await watchVideoOnPage(page, job, effectiveInput, jobScopedLogger);
        Object.assign(jobResult, watchResult);

    } catch (e) {
        logEntry(`Critical error in job ${job.url}: ${e.message}`, 'error');
        if (e.stack) logEntry(`Stack: ${e.stack}`, 'error');
        jobResult.status = 'failure';
        jobResult.error = e.message + (e.stack ? `\nStack: ${e.stack}` : '');
        if (page && !page.isClosed()) {
            try {
                logEntry('Attempting to capture HTML and screenshot on critical error...');
                const htmlContent = await page.content({ timeout: 10000 }).catch(err => `Failed to get HTML: ${err.message}`);
                if (typeof ApifyModule !== 'undefined' && ApifyModule.Actor && ApifyModule.Actor.setValue && ApifyModule.Actor.isAtHome && ApifyModule.Actor.isAtHome()) {
                    const htmlKey = `HTML_ERROR_${job.id.replace(/-/g, '')}_${uuidv4().substring(0,4)}`;
                    await ApifyModule.Actor.setValue(htmlKey, htmlContent, { contentType: 'text/html' });
                    logEntry(`HTML content saved to key: ${htmlKey}`);
                    const screenshotBuffer = await page.screenshot({ fullPage: true, timeout: 15000 });
                    const screenshotKey = `SCREENSHOT_ERROR_${job.id.replace(/-/g, '')}_${uuidv4().substring(0,4)}`;
                    await ApifyModule.Actor.setValue(screenshotKey, screenshotBuffer, { contentType: 'image/png' });
                    logEntry(`Screenshot saved to key: ${screenshotKey}`);
                } else { logEntry('Apify Actor env not detected or not at home. Skip saving debug data to KV.', 'warn'); }
            } catch (captureError) { logEntry(`Failed to capture/save debug data on critical error: ${captureError.message}`, 'warn'); }
        } else { logEntry('Page unavailable during critical error handling. No debug data captured.', 'warn'); }
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

    if (typeof ApifyModule.Actor.log !== 'undefined' && typeof ApifyModule.Actor.log.info === 'function') {
        GlobalLogger = ApifyModule.Actor.log;
         GlobalLogger.info("Apify.Actor.log assigned to GlobalLogger.");
    } else if (typeof ApifyModule.utils !== 'undefined' && typeof ApifyModule.utils.log !== 'undefined' && typeof ApifyModule.utils.log.info === 'function') {
        GlobalLogger = ApifyModule.utils.log;
        GlobalLogger.info("Apify.utils.log assigned to GlobalLogger.");
    } else {
        GlobalLogger = {
            info: (message, data) => console.log(`CONSOLE_INFO: ${message}`, data || ''),
            warning: (message, data) => console.warn(`CONSOLE_WARN: ${message}`, data || ''),
            error: (message, data) => console.error(`CONSOLE_ERROR: ${message}`, data || ''),
            debug: (message, data) => console.log(`CONSOLE_DEBUG: ${message}`, data || ''),
        };
        GlobalLogger.warning('Using console fallback for GlobalLogger. Apify Actor/utils log not found.');
    }
    GlobalLogger.info('Starting YouTube & Rumble View Bot Actor (Apify SDK v3 compatible).');

    const input = await ApifyModule.Actor.getInput();
    GlobalLogger.info('Actor input received.');
    GlobalLogger.debug('Raw input object:', input);

    const defaultInput = {
        videoUrls: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
        watchTypes: ['direct'], refererUrls: [''], searchKeywordsForEachVideo: ['default keyword, another default'],
        watchTimePercentage: 80, useProxies: true, proxyUrls: [], proxyCountry: null, proxyGroups: ['RESIDENTIAL'],
        headless: true, concurrency: 1, concurrencyInterval: 5, timeout: 120, maxSecondsAds: 15,
        skipAdsAfter: ["5", "10"], autoSkipAds: true, stopSpawningOnOverload: true,
        useAV1: false, disableProxyTests: false, enableEngagement: false, leaveComment: false, performLike: false, subscribeToChannel: false
    };
    const rawInput = input || {};
    const effectiveInput = { ...defaultInput };
    for (const key of Object.keys(defaultInput)) {
        if (rawInput.hasOwnProperty(key) && rawInput[key] !== undefined && rawInput[key] !== null) {
            if (Array.isArray(defaultInput[key])) {
                if (Array.isArray(rawInput[key]) && rawInput[key].length > 0) { effectiveInput[key] = rawInput[key]; }
                else if (Array.isArray(rawInput[key]) && rawInput[key].length === 0 &&
                           (key === 'proxyUrls' || key === 'watchTypes' || key === 'refererUrls' || key === 'searchKeywordsForEachVideo')) {
                    effectiveInput[key] = [];
                }
            } else { effectiveInput[key] = rawInput[key]; }
        }
    }
    let tempSkipAds = effectiveInput.skipAdsAfter;
    if (Array.isArray(tempSkipAds) && tempSkipAds.every(s => typeof s === 'string' || typeof s === 'number')) {
        effectiveInput.skipAdsAfter = tempSkipAds.map(s => parseInt(String(s), 10)).filter(n => !isNaN(n));
        if (effectiveInput.skipAdsAfter.length === 0 && defaultInput.skipAdsAfter.length > 0) {
            GlobalLogger.warning(`'skipAdsAfter' (${JSON.stringify(tempSkipAds)}) parsed to empty. Using default.`);
            effectiveInput.skipAdsAfter = defaultInput.skipAdsAfter.map(s => parseInt(s,10));
        }
    } else {
        GlobalLogger.warning(`'skipAdsAfter' not a valid array. Using default. Received: ${JSON.stringify(tempSkipAds)}`);
        effectiveInput.skipAdsAfter = defaultInput.skipAdsAfter.map(s => parseInt(s,10));
    }
    if (effectiveInput.proxyCountry && typeof effectiveInput.proxyCountry === 'string') {
        effectiveInput.proxyCountry = effectiveInput.proxyCountry.toUpperCase();
    }
    GlobalLogger.info('Effective input settings:', effectiveInput);

    if (!effectiveInput.videoUrls || !Array.isArray(effectiveInput.videoUrls) || effectiveInput.videoUrls.length === 0) {
        GlobalLogger.error('No videoUrls provided. Exiting.');
        if (ApifyModule.Actor.fail) await ApifyModule.Actor.fail('Missing videoUrls in input.'); return;
    }

    let actorProxyConfiguration = null;
    if (effectiveInput.useProxies && (!effectiveInput.proxyUrls || effectiveInput.proxyUrls.length === 0)) {
        const opts = { groups: effectiveInput.proxyGroups };
        if (effectiveInput.proxyCountry && effectiveInput.proxyCountry.trim() !== "") opts.countryCode = effectiveInput.proxyCountry;
        actorProxyConfiguration = await ApifyModule.Actor.createProxyConfiguration(opts);
        GlobalLogger.info(`Apify Proxy Config created. Country: ${effectiveInput.proxyCountry || 'Any (group default)'}`);
    } else if (effectiveInput.useProxies && effectiveInput.proxyUrls && effectiveInput.proxyUrls.length > 0) {
        GlobalLogger.info(`Using ${effectiveInput.proxyUrls.length} custom proxies.`);
    }

    const jobs = [];
    for (let i = 0; i < effectiveInput.videoUrls.length; i++) {
        const url = effectiveInput.videoUrls[i];
        if (!url || typeof url !== 'string') { GlobalLogger.warning(`Invalid URL at index ${i}: ${url}. Skipping.`); continue; }
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
            GlobalLogger.warning(`Watch type 'search' for ${url} but no keywords. Defaulting to 'direct'.`);
            jobs.push({ id: uuidv4(), url, videoId, platform, watchType: 'direct', refererUrl: null, searchKeywords: [] });
        } else { jobs.push({ id: uuidv4(), url, videoId, platform, watchType, refererUrl, searchKeywords }); }
    }

    if (jobs.length === 0) {
        GlobalLogger.error('No valid jobs after processing input. Exiting.');
        if (ApifyModule.Actor.fail) await ApifyModule.Actor.fail('No valid video URLs to process.'); return;
    }
    GlobalLogger.info(`Created ${jobs.length} valid jobs to process.`);

    const overallResults = { totalJobs: jobs.length, successfulJobs: 0, failedJobs: 0, details: [], startTime: new Date().toISOString(), endTime: null };
    const activeWorkers = new Set();
    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        if (effectiveInput.stopSpawningOnOverload && typeof ApifyModule.Actor.isAtCapacity === 'function' && await ApifyModule.Actor.isAtCapacity()) {
            GlobalLogger.warning('At capacity, pausing 30s.'); await new Promise(r => setTimeout(r, 30000));
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
                const errRes = { jobId: job.id, url: job.url, status: 'catastrophic_loop_failure', error: error.message, stack: error.stack, log: [`[${new Date().toISOString()}] [ERROR] Unhandled promise: ${error.message}`]};
                overallResults.details.push(errRes); overallResults.failedJobs++;
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
