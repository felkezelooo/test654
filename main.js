// Initial console logs
console.log('MAIN.JS: Script execution started.');
console.log(`MAIN.JS: Node.js version: ${process.version}`);

const ApifyModule = require('apify'); // Ensure Apify is at the top
const playwright = require('playwright'); // Ensure playwright is at the top
const { v4: uuidv4 } = require('uuid'); // Ensure uuid is at the top

console.log('MAIN.JS: Basic modules imported.');

// --- NEW BROWSER LAUNCH ARGUMENTS --- (From Claude's latest suggestion)
const ANTI_DETECTION_ARGS_NEW = [ // Renamed to avoid conflict if old one is still somewhere
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-blink-features=AutomationControlled',
    '--disable-features=VizDisplayCompositor,ImprovedCookieControls,LazyFrameLoading,GlobalMediaControls,DestroyProfileOnBrowserClose,MediaRouter,DialMediaRouteProvider,AcceptCHFrame,AutoExpandDetailsElement,CertificateTransparencyEnforcement,AvoidUnnecessaryBeforeUnloadCheckSync,Translate',
    '--disable-ipc-flooding-protection',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-sync',
    '--disable-translate',
    '--hide-scrollbars',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-default-browser-check',
    '--safebrowsing-disable-auto-update',
    '--disable-client-side-phishing-detection',
    '--disable-component-extensions-with-background-pages',
    '--disable-hang-monitor',
    '--disable-prompt-on-repost',
    // '--disable-web-security', // Keep commented unless absolutely needed
    // '--allow-running-insecure-content',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--password-store=basic',
    '--use-mock-keychain',
    // '--enable-precise-memory-info', // Commenting out, could be a fingerprint
    '--force-webrtc-ip-handling-policy=default_public_interface_only',
    '--disable-site-isolation-trials',
];
console.log('MAIN.JS: ANTI_DETECTION_ARGS_NEW defined.');

let GlobalLogger; // Defined globally

// --- GEO HELPER FUNCTIONS ---
// ... (getTimezoneForProxy, getLocaleForCountry, getYouTubeSearchUrl - FULL IMPLEMENTATIONS from previous complete code)
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
console.log('MAIN.JS: Geo helper functions defined.');

// --- NEW HELPER FUNCTIONS (from latest suggestions) ---
async function setPreventiveConsentCookies(page, loggerToUse) { /* ... Full implementation ... */ }
async function debugPageState(page, loggerToUse, context = '') { /* ... Full implementation ... */ }
async function debugClickElement(page, selector, loggerToUse) { /* ... Full implementation ... */ }
// (Full implementations for setPreventiveConsentCookies, debugPageState, debugClickElement are in the previous complete code block)

// --- NEW COMPREHENSIVE ANTI-DETECTION SCRIPT ---
async function applyAntiDetectionScripts(pageOrContext, detectedTimezoneId) {
    const comprehensiveAntiDetectionScript = (timezoneId) => {
        // Webdriver Traces
        try {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            delete navigator.__proto__.webdriver; 
        } catch (e) { console.debug('[Anti-Detect] Failed basic webdriver spoof:', e.message); }
        try { if (navigator.webdriver) delete navigator.webdriver; } catch (e) { console.debug('[Anti-Detect] Failed direct delete navigator.webdriver:', e.message); }

        // Automation Detection Overrides (Chrome specific properties)
        try {
            if (typeof window.chrome !== 'object') window.chrome = {};
            window.chrome.runtime = window.chrome.runtime || {};
            const props = [' สิงห์ ', 'csi', 'loadTimes', 'app'];
            for (const prop of props) if(typeof window.chrome[prop] === 'undefined') window.chrome[prop] = () => {};
        } catch (e) { console.debug('[Anti-Detect] Failed Chrome object spoof:', e.message); }

        // Plugins Spoofing
        try {
            const pluginsData = [
                { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', mimeTypes: [{ type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' }] },
                { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', mimeTypes: [{ type: 'application/pdf', suffixes: 'pdf', description: '' }] },
                { name: 'Native Client', filename: 'internal-nacl-plugin', description: 'Native Client', mimeTypes: [{ type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },{ type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' }] }
            ];
            const mimeTypesList = [];
            const pluginsList = pluginsData.map(p => {
                const mimeTypesForPlugin = p.mimeTypes.map(mt => {
                    const mimeType = { ...mt, enabledPlugin: null /* will be circular */ };
                    Object.setPrototypeOf(mimeType, MimeType.prototype);
                    mimeTypesList.push(mimeType);
                    return mimeType;
                });
                const plugin = { ...p, mimeTypes: mimeTypesForPlugin, length: mimeTypesForPlugin.length, item: i => mimeTypesForPlugin[i], namedItem: name => mimeTypesForPlugin.find(m => m.type === name) };
                Object.setPrototypeOf(plugin, Plugin.prototype);
                mimeTypesForPlugin.forEach(mt => mt.enabledPlugin = plugin);
                return plugin;
            });
            Object.setPrototypeOf(pluginsList, PluginArray.prototype);
            Object.setPrototypeOf(mimeTypesList, MimeTypeArray.prototype);
            Object.defineProperty(navigator, 'plugins', { get: () => pluginsList, configurable: true, enumerable: true });
            Object.defineProperty(navigator, 'mimeTypes', { get: () => mimeTypesList, configurable: true, enumerable: true });
        } catch (e) { console.debug('[Anti-Detect] Failed plugin/mimeType spoof:', e.message); }

        // Languages Spoofing (Assuming en-GB from context, can be made dynamic)
        try { Object.defineProperty(navigator, 'languages', { get: () => ['en-GB', 'en-US', 'en'], configurable: true }); } catch (e) {}
        try { Object.defineProperty(navigator, 'language', { get: () => 'en-GB', configurable: true }); } catch (e) {}

        // Permissions API Spoofing
        try {
            const originalPermissionsQuery = navigator.permissions.query;
            navigator.permissions.query = (descriptor) => {
                const commonSafePermissions = ['geolocation', 'notifications', 'camera', 'microphone', 'persistent-storage'];
                if (commonSafePermissions.includes(descriptor.name)) return Promise.resolve({ state: 'prompt', name: descriptor.name, onchange: null });
                if (descriptor.name === 'midi') return Promise.resolve({ state: descriptor.sysex ? 'prompt' : 'granted', name: descriptor.name, onchange: null });
                if (originalPermissionsQuery) return originalPermissionsQuery.call(navigator.permissions, descriptor);
                return Promise.reject(new DOMException('Querying permissions is not supported.', 'NotSupportedError'));
            };
        } catch (e) { console.debug('[Anti-Detect] Failed permissions spoof:', e.message); }

        // Canvas Fingerprinting Protection
        try {
            const originalGetContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function(type, ...args) {
                const context = originalGetContext.apply(this, [type, ...args]);
                if (type === '2d' && context) {
                    const originalFillText = context.fillText;
                    context.fillText = function(text, x, y, maxWidth) { const n = (Math.random()-0.5)*0.001; return originalFillText.call(this, text, x+n, y+n, maxWidth); };
                    const originalStrokeText = context.strokeText;
                    context.strokeText = function(text, x, y, maxWidth) { const n = (Math.random()-0.5)*0.001; return originalStrokeText.call(this, text, x+n, y+n, maxWidth); };
                    const originalGetImageData = context.getImageData;
                    context.getImageData = function (sx, sy, sw, sh) {
                        const imageData = originalGetImageData.apply(this, arguments);
                        for (let i = 0; i < imageData.data.length; i += Math.floor(Math.random()*20)+4) imageData.data[i] ^= (Math.floor(Math.random()*3));
                        return imageData;
                    };
                }
                return context;
            };
        } catch (e) { console.debug('[Anti-Detect] Failed canvas spoof:', e.message); }

        // WebGL Fingerprinting Protection
        try {
            const webGLSpoof = { 37445: 'Intel Inc.', 37446: 'Intel Iris OpenGL Engine', 7937: 'WebGL 1.0', 7936: 'Google Inc.', 35724: 'WebGL GLSL ES 1.0' };
            const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function(p) { return webGLSpoof.hasOwnProperty(p) ? webGLSpoof[p] : originalGetParameter.call(this, p); };
            if (typeof WebGL2RenderingContext !== 'undefined') {
                const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
                WebGL2RenderingContext.prototype.getParameter = function(p) { return webGLSpoof.hasOwnProperty(p) ? webGLSpoof[p] : originalGetParameter2.call(this, p); };
            }
        } catch (e) { console.debug('[Anti-Detect] Failed WebGL spoof:', e.message); }

        // AudioContext Fingerprinting
        try {
            const acOriginal = window.AudioContext || window.webkitAudioContext;
            if (acOriginal) {
                const originalCreateOscillator = acOriginal.prototype.createOscillator;
                acOriginal.prototype.createOscillator = function () {
                    const oscillator = originalCreateOscillator.apply(this, arguments);
                    const originalStart = oscillator.start;
                    oscillator.start = function () { this.frequency.setValueAtTime(this.frequency.value + (Math.random()-0.5)*0.1, this.context.currentTime); return originalStart.apply(this, arguments); };
                    return oscillator;
                };
            }
        } catch (e) { console.debug('[Anti-Detect] Failed AudioContext spoof:', e.message); }

        // Window Dimensions
        try {
            Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight + (Math.floor(Math.random() * 15) + 75), configurable: true });
            Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth + (Math.floor(Math.random() * 3)), configurable: true });
        } catch (e) { console.debug('[Anti-Detect] Failed outerHeight/Width spoof:', e.message); }

        // Timezone and Intl
        try {
            const getOffset = (tz) => { try { const d=new Date(),u=new Date(d.getTime()+(d.getTimezoneOffset()*60000)),t=new Date(u.toLocaleString("en-US",{timeZone:tz})); return Math.round((u.getTime()-t.getTime())/60000); } catch(e){return 0;} };
            const targetOffset = getOffset(timezoneId); // timezoneId is passed from Node.js
            Date.prototype.getTimezoneOffset = function() { return targetOffset; };
            if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
                const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
                Intl.DateTimeFormat.prototype.resolvedOptions = function() { const o=originalResolvedOptions.call(this); o.timeZone=timezoneId; return o; };
            }
        } catch (e) { console.debug('[Anti-Detect] Failed timezone/Intl spoof:', e.message); }

        // Notification Permission
        try { Object.defineProperty(Notification, 'permission', { get: () => 'default', configurable: true }); } catch (e) {}

        // Screen Properties
        try {
            const h = screen.height, w = screen.width;
            Object.defineProperty(screen, 'availHeight', { get: () => h - (Math.floor(Math.random()*20)+40), configurable: true });
            Object.defineProperty(screen, 'availWidth', { get: () => w, configurable: true });
        } catch (e) { console.debug('[Anti-Detect] Failed screen avail spoof:', e.message); }

        // Device Memory and Hardware Concurrency
        try {
            if (!navigator.deviceMemory || navigator.deviceMemory > 16 || navigator.deviceMemory < 2) Object.defineProperty(navigator, 'deviceMemory', { get: () => [4,8,16][Math.floor(Math.random()*3)], configurable: true });
            if (!navigator.hardwareConcurrency || navigator.hardwareConcurrency > 16 || navigator.hardwareConcurrency < 2) Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => [2,4,8][Math.floor(Math.random()*3)], configurable: true });
        } catch (e) { console.debug('[Anti-Detect] Failed memory/concurrency spoof:', e.message); }

        // Battery API
        try {
            if (navigator.getBattery) navigator.getBattery = () => Promise.resolve({ charging: Math.random()>0.5, chargingTime:Math.random()>0.5?0:Math.floor(Math.random()*10000), dischargingTime: Math.random()>0.5?Infinity:Math.floor(Math.random()*10000)+3600, level:Math.random()*0.4+0.6, onchargingchange:null, onchargingtimechange:null, ondischargingtimechange:null, onlevelchange:null });
        } catch(e) { console.debug('[Anti-Detect] Failed battery API spoof: ', e.message); }

    }; // End of comprehensiveAntiDetectionScript

    (GlobalLogger || console).debug(`[AntiDetection] Injecting COMPREHENSIVE anti-detection script with dynamic timezoneId: ${detectedTimezoneId}`);
    if (pageOrContext.addInitScript) {
        await pageOrContext.addInitScript(comprehensiveAntiDetectionScript, detectedTimezoneId);
    } else if (pageOrContext.evaluateOnNewDocument) {
        const scriptString = `(${comprehensiveAntiDetectionScript.toString()})(${JSON.stringify(detectedTimezoneId)});`;
        await pageOrContext.evaluateOnNewDocument(scriptString);
    }
}
console.log('MAIN.JS: Anti-detection script function defined.');

// --- NEW HUMAN BEHAVIOR SIMULATION ---
async function simulateHumanBehavior(page, loggerToUse, stage = 'general') {
    loggerToUse.debug(`Simulating human behavior (stage: ${stage})...`);
    try {
        const viewport = page.viewportSize();
        if (!viewport) {
            loggerToUse.warn('Viewport not available for human behavior simulation.');
            return;
        }
        for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
            await page.mouse.move(
                Math.random() * viewport.width * 0.8 + viewport.width * 0.1,
                Math.random() * viewport.height * 0.8 + viewport.height * 0.1,
                { steps: 5 + Math.floor(Math.random() * 5) }
            );
            await page.waitForTimeout(150 + Math.random() * 300);
        }
        if (Math.random() > 0.5) {
            const scrollAmount = (Math.random() - 0.5) * viewport.height * 0.3;
            await page.mouse.wheel(0, scrollAmount);
            await page.waitForTimeout(300 + Math.random() * 700);
        }
        // Removed problematic random interactions like right-click for now
        loggerToUse.debug(`Human behavior simulation (stage: ${stage}) completed.`);
    } catch (e) {
        loggerToUse.debug(`Human behavior simulation (stage: ${stage}) failed: ${e.message}`);
    }
}
console.log('MAIN.JS: Human behavior simulation function defined.');


// --- ALL OTHER HELPER FUNCTIONS ---
// ... (extractVideoId, getVideoDuration, clickIfExists, handleAds, ensureVideoPlaying, watchVideoOnPage,
// handleYouTubeConsent - with updated checkForConsentIndicators, waitForVideoPlayer - FULL IMPLEMENTATIONS from previous complete code)

async function extractVideoId(url) {
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
        const minSkipTime = Array.isArray(effectiveInput.skipAdsAfter) && effectiveInput.skipAdsAfter.length > 0 ? parseInt(String(effectiveInput.skipAdsAfter[0]),10) : 5;
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

async function ensureVideoPlaying(page, playButtonSelectors, loggerToUse) {
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
            if (await clickIfExists(page, selector, 2000, loggerToUse)) {
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
    const logEntry = (msg, level = 'info') => {
        const formattedMessage = `[Job ${job.id.substring(0,6)}] ${msg}`;
        if (loggerToUse && typeof loggerToUse[level] === 'function') {
            loggerToUse[level](formattedMessage);
        } else { (GlobalLogger || console)[level](formattedMessage); }
        jobResult.log.push(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`);
    };

    try {
        logEntry('Handling initial ads.');
        await handleAds(page, job.platform, effectiveInput, loggerToUse);
        logEntry(`Attempting to play video: ${job.url}`);
        const playButtonSelectors = job.platform === 'youtube'
            ? ['.ytp-large-play-button', '.ytp-play-button[aria-label*="Play"]', 'button[title*="Play"]']
            : ['.rumbles-player-play-button', 'video.rumble-player-video', 'button[data-plyr="play"]'];

        if (!await ensureVideoPlaying(page, playButtonSelectors, loggerToUse)) {
            logEntry('Video playback could not be confirmed. Checking for reappeared consent dialog...', 'warn');
            const consentHandledAgain = await handleYouTubeConsent(page, loggerToUse);
            if (consentHandledAgain) {
                logEntry('Reappeared consent dialog handled. Retrying video play assurance.');
                if (!await ensureVideoPlaying(page, playButtonSelectors, loggerToUse)) {
                     throw new Error('Video playback failed even after re-handling consent.');
                }
            } else {
                throw new Error('Video playback failed and no reappeared consent dialog found or handled.');
            }
        }
        await page.evaluate(() => {
            const v = document.querySelector('video.html5-main-video, video.rumble-player-video');
            if(v) { v.muted=false; v.volume=0.05 + Math.random() * 0.1; console.log(`[In-Page Eval] Video unmuted, volume set to ${v.volume.toFixed(2)}`); }
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
                if (!await ensureVideoPlaying(page, playButtonSelectors, loggerToUse)) {
                    logEntry('Video remains paused. Checking for reappeared consent dialog (mid-watch)...', 'warn');
                    const consentReappeared = await handleYouTubeConsent(page, loggerToUse);
                    if (consentReappeared) {
                         logEntry('Reappeared consent handled during watch loop. Retrying play assurance.');
                         if(!await ensureVideoPlaying(page, playButtonSelectors, loggerToUse)) {
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

async function handleYouTubeConsent(page, loggerToUse = GlobalLogger) {
    loggerToUse.info('Handling YouTube consent with comprehensive detection strategies...');
    const checkForConsentIndicators = async () => {
        try {
            const specificConsentSelectors = [
                'ytd-consent-bump-v2-lightbox', 'tp-yt-paper-dialog[aria-label*="consent"]',
                'tp-yt-paper-dialog[aria-label*="cookie"]', 'tp-yt-paper-dialog[aria-label*="privacy"]',
                '.consent-bump', '#consent-bump', 'iframe[src*="consent"]'
            ];
            const genericSelectors = ['[role="dialog"]'];

            for (const selector of specificConsentSelectors) {
                const elements = page.locator(selector);
                const count = await elements.count();
                if (count > 0) {
                    loggerToUse.debug(`Found ${count} potential specific consent indicator(s) with selector: ${selector}`);
                    for (let i = 0; i < Math.min(count, 2); i++) {
                        const element = elements.nth(i);
                        if (await element.isVisible({ timeout: 500 }).catch(() => false)) {
                            loggerToUse.info(`Specific consent element ${selector} (index ${i}) is visible.`);
                            return { found: true, selector, visible: true, type: 'specific' };
                        }
                    }
                }
            }
            for (const selector of genericSelectors) {
                const elements = await page.locator(selector).all();
                loggerToUse.debug(`Checking ${elements.length} generic dialog(s) for selector: ${selector}`);
                for (let i = 0; i < elements.length; i++) {
                    const element = elements[i];
                    if (await element.isVisible({timeout: 500}).catch(() => false)) {
                        const hasConsentContent = await element.evaluate((el) => {
                            const text = (el.innerText || el.textContent || '').toLowerCase();
                            const consentKeywords = ['accept all', 'accept cookies', 'cookie', 'consent', 'privacy', 'gdpr', 'data processing', 'agree', 'reject all', 'manage cookies'];
                            return consentKeywords.some(keyword => text.includes(keyword));
                        }).catch(() => false);
                        const isYouTubeUI = await element.evaluate((el) => {
                            const classNames = (el.className || '').toLowerCase();
                            const id = (el.id || '').toLowerCase();
                            const uiIndicators = ['miniplayer', 'ytp-', 'playlist', 'share-panel', 'overflow-panel', 'mdx-popup', 'tooltip', 'guide', 'menu'];
                            return uiIndicators.some(indicator => classNames.includes(indicator) || id.includes(indicator));
                        }).catch(() => false);
                        if (hasConsentContent && !isYouTubeUI) {
                            loggerToUse.info(`Found generic dialog with consent content (and not UI element): ${selector} (index ${i})`);
                            const elementId = await element.getAttribute('id');
                            const specificSelector = elementId ? `${selector}#${elementId}` : `${selector}:nth-of-type(${i + 1})`;
                            return { found: true, selector: specificSelector, visible: true, type: 'content-filtered' };
                        } else {
                            loggerToUse.debug(`Skipping generic dialog ${selector} (index ${i}): ConsentContent=${hasConsentContent}, IsYouTubeUI=${isYouTubeUI}`);
                        }
                    }
                }
            }
            return { found: false };
        } catch (e) {
            loggerToUse.debug(`Consent indicator check failed: ${e.message.split('\n')[0]}`);
            return { found: false };
        }
    };
    const findAndClickConsentButtons = async () => { /* ... Full implementation from previous ... */ };
    const handleShadowDOMConsent = async () => { /* ... Full implementation from previous ... */ };
    const forceConsentAcceptance = async () => { /* ... Full implementation from previous ... */ };
    // (These 3 functions are complete in the previous full code block)

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
    loggerToUse.warning('Consent handling completed after all attempts with uncertain final state.');
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

async function waitForVideoPlayer(page, loggerToUse) {
    const playerSelectors = [
        'video.html5-main-video', 'ytd-player video', '#movie_player video',
        'video.video-stream', 'video[class*="html5"]'
    ];
    for (let attempt = 1; attempt <= 3; attempt++) {
        loggerToUse.info(`Waiting for video player (attempt ${attempt}/3)...`);
        for (const selector of playerSelectors) {
            try {
                const videoLocator = page.locator(selector).first();
                if (await videoLocator.count() > 0) {
                    loggerToUse.debug(`Video element found with selector: ${selector}`);
                    const isHiddenOrCovered = await page.evaluate((sel) => {
                        const video = document.querySelector(sel);
                        if (!video) return true;
                        const style = window.getComputedStyle(video);
                        const rect = video.getBoundingClientRect();
                        if (style.display === 'none' || style.visibility === 'hidden' ||
                            style.opacity === '0' || rect.width === 0 || rect.height === 0) return true;
                        const centerX = rect.left + rect.width / 2;
                        const centerY = rect.top + rect.height / 2;
                        if (centerX < 0 || centerY < 0 || centerX > window.innerWidth || centerY > window.innerHeight) return true;
                        const topElement = document.elementFromPoint(centerX, centerY);
                        return !(topElement && (video.contains(topElement) || topElement === video));
                    }, selector);

                    if (isHiddenOrCovered) {
                        loggerToUse.warn(`Video element ${selector} is hidden or covered. Attempting to reveal...`);
                        await page.evaluate(() => {
                            const overlaySelectors = [
                                'ytd-consent-bump-v2-lightbox', 'tp-yt-paper-dialog[aria-label*="consent"]',
                                '.consent-bump', '[role="dialog"][aria-label*="consent"]',
                                'div[style*="position: fixed"][style*="z-index"]'
                            ];
                            overlaySelectors.forEach(osSel => {
                                document.querySelectorAll(osSel).forEach(el => {
                                    const text = (el.innerText || el.textContent || '').toLowerCase();
                                    if (text.includes('consent') || text.includes('cookie') || text.includes('privacy') || text.includes('accept')) {
                                        try { el.style.display = 'none'; el.remove(); console.log(`[In-Page Eval] Removed/hid overlay: ${osSel}`); }
                                        catch (e) { console.debug('[In-Page Eval] Failed to remove/hide overlay:', e); }
                                    }
                                });
                            });
                        });
                        await page.waitForTimeout(2000);
                        const stillHidden = await videoLocator.isHidden().catch(()=>true);
                        if (!stillHidden && await videoLocator.isVisible().catch(()=>false)) {
                            loggerToUse.info(`Video element ${selector} is now visible after overlay removal attempt.`);
                            return selector;
                        }
                         loggerToUse.warn(`Video element ${selector} still hidden after removal attempt.`);
                    } else {
                        loggerToUse.info(`Video element ${selector} is visible and accessible.`);
                        return selector;
                    }
                }
            } catch (e) {
                loggerToUse.debug(`Error checking selector ${selector}: ${e.message.split('\n')[0]}`);
            }
        }
        if (attempt < 3) {
            loggerToUse.info('No visible video player found yet, waiting 5s and retrying...');
            await page.waitForTimeout(5000);
        }
    }
    throw new Error('No visible video player found after all attempts and recovery actions.');
}
console.log('MAIN.JS: Other helper functions defined.');


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
            } else { console.log(`[${level.toUpperCase()}] [Job ${job.id.substring(0,6)}] ${msg}`); }
        }
        jobResult.log.push(tsMsg);
    };

    logEntry(`Starting job for URL: ${job.url} with watchType: ${job.watchType}`);
    let browser; let context; let page;
    const detectedTimezone = getTimezoneForProxy(effectiveInput.proxyCountry, effectiveInput.useProxies);
    const detectedLocale = getLocaleForCountry(effectiveInput.proxyCountry);
    logEntry(`Geo settings: Timezone='${detectedTimezone}', Locale='${detectedLocale}' (ProxyCountry: '${effectiveInput.proxyCountry || 'N/A'}')`);

    const randomWidth = 1200 + Math.floor(Math.random() * 720);
    const randomHeight = 700 + Math.floor(Math.random() * 380);
    const dynamicWindowSizeArg = `--window-size=${randomWidth},${randomHeight}`;
    const currentLaunchArgs = [...ANTI_DETECTION_ARGS_NEW, dynamicWindowSizeArg];

    try {
        const launchOptions = {
            headless: effectiveInput.headless,
            args: currentLaunchArgs,
        };
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


        logEntry(`Attempting to launch browser with args: ${JSON.stringify(currentLaunchArgs.slice(0, 5))}... + ${currentLaunchArgs.length - 5} more`);
        browser = (typeof ApifyModule !== 'undefined' && ApifyModule.Actor && ApifyModule.Actor.isAtHome && ApifyModule.Actor.isAtHome() && ApifyModule.Actor.launchPlaywright)
            ? await ApifyModule.Actor.launchPlaywright(launchOptions)
            : await playwright.chromium.launch(launchOptions);
        logEntry('Browser launched.');

        const existingHeaders = launchOptions.extraHTTPHeaders || {}; // Should be empty from launchOptions unless set externally
        context = await browser.newContext({
            bypassCSP: true, ignoreHTTPSErrors: true,
            viewport: { width: Math.min(1920, 1200 + Math.floor(Math.random() * 320)), height: Math.min(1080, 700 + Math.floor(Math.random() * 280)) },
            locale: detectedLocale, timezoneId: detectedTimezone, javaScriptEnabled: true,
            extraHTTPHeaders: {
                ...existingHeaders, // Merge if any were predefined, though unlikely from launchOptions.args
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': `${detectedLocale.replace('_', '-')},en;q=0.9`,
                'Accept-Encoding': 'gzip, deflate, br',
                'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'none', 'Sec-Fetch-User': '?1',
                'Upgrade-Insecure-Requests': '1',
            },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            permissions: ['geolocation', 'notifications'],
            colorScheme: 'light',
        });
        await applyAntiDetectionScripts(context, detectedTimezone);

        if (job.watchType === 'referer' && job.refererUrl) {
            logEntry(`Setting referer to: ${job.refererUrl}`);
            const currentExtraHeaders = context._options.extraHTTPHeaders || {};
            await context.setExtraHTTPHeaders({ ...currentExtraHeaders, 'Referer': job.refererUrl });
        }

        page = await context.newPage();
        await page.setViewportSize({ width: Math.min(1920, 1200 + Math.floor(Math.random() * 120)), height: Math.min(1080, 700 + Math.floor(Math.random() * 80)) });

        await setPreventiveConsentCookies(page, jobScopedLogger);
        await page.waitForTimeout(500 + Math.random() * 1000);

        if (job.watchType === 'search' && job.searchKeywords && job.searchKeywords.length > 0) {
            const keyword = job.searchKeywords[Math.floor(Math.random() * job.searchKeywords.length)];
            logEntry(`Performing Google search for keyword: "${keyword} site:youtube.com" to find video ID: ${job.videoId}`);
            await page.goto('https://www.google.com/search?q=', { timeout: effectiveInput.timeout * 1000, waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(1000 + Math.random() * 1500);
            await simulateHumanBehavior(page, jobScopedLogger, 'google-home');
            logEntry(`Filling Google search with: "${keyword} site:youtube.com"`);
            await page.fill('textarea[name="q"], input[name="q"]', `${keyword} site:youtube.com`);
            await page.waitForTimeout(300 + Math.random() * 700);
            await page.keyboard.press('Enter');
            logEntry('Google search submitted. Waiting for results page load...');
            await page.waitForLoadState('domcontentloaded', { timeout: 20000 });
            await page.waitForTimeout(2000 + Math.random() * 2000);
            await simulateHumanBehavior(page, jobScopedLogger, 'google-serp');

            const googleServVideoLinkSelector = `a[href*="youtube.com/watch?v=${job.videoId}"]`;
            logEntry(`Looking for YouTube link on Google SERP: ${googleServVideoLinkSelector}`);
            const googleVideoLink = page.locator(googleServVideoLinkSelector).first();
            try {
                await googleVideoLink.waitFor({ state: 'visible', timeout: 30000 });
                logEntry('YouTube video link found on Google SERP. Scrolling and clicking...');
                await googleVideoLink.scrollIntoViewIfNeeded({ timeout: 5000 });
                await page.waitForTimeout(500 + Math.random() * 500);
                const navigationPromise = page.waitForURL(`**/watch?v=${job.videoId}**`, { timeout: 25000, waitUntil: 'domcontentloaded' });
                await googleVideoLink.click({ delay: 100 + Math.random() * 100 });
                await navigationPromise;
                logEntry(`Successfully navigated from Google SERP to YouTube video page: ${page.url()}`);
            } catch (googleSearchError) {
                logEntry(`Could not find/click YouTube link on Google SERP for video ID ${job.videoId}. Error: ${googleSearchError.message.split('\n')[0]}`, 'error');
                logEntry('Falling back to direct navigation to video URL as search from Google failed.');
                 await page.goto(job.url, { timeout: 30000, waitUntil: 'domcontentloaded' });
            }
            await simulateHumanBehavior(page, jobScopedLogger, 'youtube-video-page-loaded-from-search');

        } else {
            logEntry(`Navigating (direct/referer) to ${job.url}.`);
            await page.goto(job.url, { timeout: effectiveInput.timeout * 1000, waitUntil: 'domcontentloaded' });
            logEntry(`Initial navigation to ${job.url} (domcontentloaded) complete.`);
            await page.waitForTimeout(1500 + Math.random() * 2000);
            await simulateHumanBehavior(page, jobScopedLogger, 'youtube-video-page-loaded-direct');
        }

        await debugPageState(page, jobScopedLogger, 'before consent (video page)');
        logEntry('Handling consent on video page...');
        const videoPageConsentHandled = await handleYouTubeConsent(page, jobScopedLogger);
        await debugPageState(page, jobScopedLogger, 'after consent (video page)');
        if (!videoPageConsentHandled) logEntry('Consent handling uncertain on video page, proceeding with caution.', 'warn');
        else logEntry('Consent handling on video page returned true.');
        await page.waitForTimeout(1000 + Math.random() * 1000);

        logEntry('Aggressively removing any potential consent/other overlays before player detection...');
        await page.evaluate(() => {
            const overlaySelectors = [
                'ytd-consent-bump-v2-lightbox', 'tp-yt-paper-dialog',
                '[role="dialog"][style*="position: fixed"]', '[role="dialog"][style*="z-index"]',
                '.consent-bump', '#consent-bump', '[aria-label*="consent"]', '[aria-label*="cookie"]', '[aria-label*="privacy"]'
            ];
            let removedCount = 0;
            overlaySelectors.forEach(selector => {
                try {
                    document.querySelectorAll(selector).forEach(el => {
                        const text = (el.innerText || el.textContent || '').toLowerCase();
                        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
                        if (text.includes('consent') || text.includes('cookie') || text.includes('accept') || ariaLabel.includes('consent') || ariaLabel.includes('cookie')) {
                            try { el.style.display = 'none'; el.style.visibility = 'hidden'; el.style.opacity = '0'; el.remove(); removedCount++; }
                            catch (e) { console.debug('[In-Page Eval] Failed to remove potential consent overlay:', e); }
                        }
                    });
                } catch (e) { console.debug('[In-Page Eval] Error processing selector:', selector, e); }
            });
            if (removedCount > 0) console.log(`[In-Page Eval] Aggressively removed ${removedCount} potential overlays.`);
        }).catch(e => jobScopedLogger.warning(`Error during aggressive overlay removal: ${e.message}`)); // Use jobScopedLogger
        await page.waitForTimeout(1000);

        const visiblePlayerSelector = await waitForVideoPlayer(page, jobScopedLogger);
        logEntry(`Video player ready with selector: ${visiblePlayerSelector}`);
        await page.waitForTimeout(500 + Math.random() * 1500);

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
    console.log('ACTOR_MAIN_LOGIC: >>> Entered main logic function - VERY FIRST LINE <<<');
    try {
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

        const defaultInput = { /* ... Full defaultInput object ... */ }; // Maintained
        const rawInput = input || {};
        const effectiveInput = { ...defaultInput };
        // Input processing logic (Maintained)
        // ...

        GlobalLogger.info('Effective input settings:', effectiveInput);
        if (!effectiveInput.videoUrls || !Array.isArray(effectiveInput.videoUrls) || effectiveInput.videoUrls.length === 0) {
            GlobalLogger.error('No videoUrls provided. Exiting.');
            if (ApifyModule.Actor.fail) await ApifyModule.Actor.fail('Missing videoUrls in input.'); return;
        }

        let actorProxyConfiguration = null;
        // Proxy configuration logic (Maintained)
        // ...

        const jobs = [];
        // Job creation logic (Maintained)
        // ...

        if (jobs.length === 0) { /* ... Exit if no jobs ... */ } // Maintained
        GlobalLogger.info(`Created ${jobs.length} valid jobs to process.`);

        const overallResults = { /* ... Initialize results ... */ }; // Maintained
        const activeWorkers = new Set();
        // Job processing loop (Maintained)
        // ...
        for (let i = 0; i < jobs.length; i++) {
            const job = jobs[i];
            // Concurrency and overload checks...
            const jobPromise = runSingleJob(job, effectiveInput, actorProxyConfiguration, effectiveInput.proxyUrls, GlobalLogger)
                .then(/* ... */).catch(/* ... */).finally(/* ... */); // Maintained
            activeWorkers.add(jobPromise);
            // Logging and interval...
        }

        GlobalLogger.info(`All jobs dispatched. Waiting for ${activeWorkers.size} to complete...`);
        await Promise.all(Array.from(activeWorkers));
        overallResults.endTime = new Date().toISOString();
        GlobalLogger.info('All jobs processed. Final results:', overallResults);
        if (ApifyModule.Actor.setValue) await ApifyModule.Actor.setValue('RESULTS', overallResults);

        console.log('ACTOR_MAIN_LOGIC: Reached end of main logic. Attempting to exit.');
        if (ApifyModule.Actor.exit) await ApifyModule.Actor.exit(); else process.exit(0);

    } catch (e) {
        console.error("ACTOR_MAIN_LOGIC: CRITICAL ERROR IN TOP LEVEL:", e.message, e.stack);
        if (GlobalLogger && GlobalLogger.error) { // Try to use GlobalLogger if it was initialized
            GlobalLogger.error("ACTOR_MAIN_LOGIC: CRITICAL ERROR IN TOP LEVEL:", { message: e.message, stack: e.stack });
        }
        if (ApifyModule.Actor.fail) await ApifyModule.Actor.fail(e.message);
        else process.exit(1);
    }
}


console.log('MAIN.JS: Before Apify.Actor.main call.');
if (ApifyModule.Actor && typeof ApifyModule.Actor.main === 'function') {
    console.log('MAIN.JS: Apify.Actor.main is available, calling it.');
    ApifyModule.Actor.main(actorMainLogic);
} else {
    console.error('CRITICAL: Apify.Actor.main is not defined. Running actorMainLogic directly.');
    actorMainLogic().catch(err => {
        console.error('CRITICAL: Error in direct actorMainLogic execution:', err);
        process.exit(1);
    });
}
console.log('MAIN.JS: Script fully loaded and main execution path determined. (End of script log)');
