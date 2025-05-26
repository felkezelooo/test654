// Initial console logs
console.log('MAIN.JS: Script execution started.');
console.log(`MAIN.JS: Node.js version: ${process.version}`);

const ApifyModule = require('apify');
const playwright = require('playwright');
const { v4: uuidv4 } = require('uuid');

console.log('MAIN.JS: Basic modules imported.');

// --- COMPREHENSIVE BROWSER LAUNCH ARGUMENTS ---
const ANTI_DETECTION_ARGS_NEW = [
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
    // '--disable-web-security', // Keep commented unless strictly necessary for a specific site
    // '--allow-running-insecure-content',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--password-store=basic',
    '--use-mock-keychain',
    // '--enable-precise-memory-info', // Commented out, could be a fingerprinting vector
    '--force-webrtc-ip-handling-policy=default_public_interface_only',
    '--disable-site-isolation-trials',
];
console.log('MAIN.JS: ANTI_DETECTION_ARGS_NEW defined.');

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
console.log('MAIN.JS: Geo helper functions defined.');

async function setPreventiveConsentCookies(page, loggerToUse) {
    try {
        await page.context().addCookies([
            { name: 'CONSENT', value: 'PENDING+987', domain: '.youtube.com', path: '/' },
            { name: 'SOCS', value: 'CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LmvBg', domain: '.youtube.com', path: '/', secure: true, sameSite: 'None'},
            { name: '__Secure-YT-GDPR', value: '1', domain: '.youtube.com', path: '/', secure: true, sameSite: 'Lax' }
        ]);
        loggerToUse.info('Set preventive consent cookies (CONSENT=PENDING+987, SOCS, __Secure-YT-GDPR=1).');
    } catch (e) {
        loggerToUse.debug(`Failed to set preventive cookies: ${e.message}`);
    }
}

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
                        class: elem.className,
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

async function debugClickElement(page, selector, loggerToUse) {
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
        if (boundingBox && page.viewportSize()) {
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

async function applyAntiDetectionScripts(pageOrContext, detectedTimezoneId) {
    const comprehensiveAntiDetectionScript = (timezoneId) => {
        // Webdriver Traces
        try {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            if (navigator.__proto__ && typeof navigator.__proto__ === 'object') delete navigator.__proto__.webdriver;
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
            if (typeof Plugin === 'function' && typeof PluginArray === 'function' && typeof MimeType === 'function' && typeof MimeTypeArray === 'function') {
                const mimeTypesList = [];
                const pluginsList = pluginsData.map(p => {
                    const mimeTypesForPlugin = p.mimeTypes.map(mt => {
                        const mimeType = { ...mt, enabledPlugin: null };
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
            } else { console.debug('[Anti-Detect] Plugin/MimeType prototypes not available.');}
        } catch (e) { console.debug('[Anti-Detect] Failed plugin/mimeType spoof:', e.message); }

        // Languages Spoofing
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
            if (typeof WebGL2RenderingContext !== 'undefined' && WebGL2RenderingContext.prototype) {
                const originalGetParameter2 = WebGL2RenderingContext.prototype.getParameter;
                WebGL2RenderingContext.prototype.getParameter = function(p) { return webGLSpoof.hasOwnProperty(p) ? webGLSpoof[p] : originalGetParameter2.call(this, p); };
            }
        } catch (e) { console.debug('[Anti-Detect] Failed WebGL spoof:', e.message); }

        // AudioContext Fingerprinting
        try {
            const acOriginal = window.AudioContext || window.webkitAudioContext;
            if (acOriginal && acOriginal.prototype) {
                const originalCreateOscillator = acOriginal.prototype.createOscillator;
                if (originalCreateOscillator) {
                    acOriginal.prototype.createOscillator = function () {
                        const oscillator = originalCreateOscillator.apply(this, arguments);
                        const originalStart = oscillator.start;
                        oscillator.start = function () { this.frequency.setValueAtTime(this.frequency.value + (Math.random()-0.5)*0.1, this.context.currentTime); return originalStart.apply(this, arguments); };
                        return oscillator;
                    };
                }
            }
        } catch (e) { console.debug('[Anti-Detect] Failed AudioContext spoof:', e.message); }

        // Window Dimensions
        try {
            Object.defineProperty(window, 'outerHeight', { get: () => window.innerHeight + (Math.floor(Math.random() * 20) + 75), configurable: true });
            Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth + (Math.floor(Math.random() * 3)), configurable: true });
        } catch (e) { console.debug('[Anti-Detect] Failed outerHeight/Width spoof:', e.message); }

        // Timezone and Intl
        try {
            const getOffset = (tz) => { try { const d=new Date(),u=new Date(d.getTime()+(d.getTimezoneOffset()*60000)),t=new Date(u.toLocaleString("en-US",{timeZone:tz})); return Math.round((u.getTime()-t.getTime())/60000); } catch(e){ console.debug('[Anti-Detect] getOffset error for tz:', tz, e.message); return 0;} };
            const targetOffset = getOffset(timezoneId);
            Date.prototype.getTimezoneOffset = function() { return targetOffset; };
            if (typeof Intl !== 'undefined' && Intl.DateTimeFormat && Intl.DateTimeFormat.prototype) {
                const originalResolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
                Intl.DateTimeFormat.prototype.resolvedOptions = function() { const o=originalResolvedOptions.call(this); o.timeZone=timezoneId; return o; };
            }
        } catch (e) { console.debug('[Anti-Detect] Failed timezone/Intl spoof:', e.message); }

        // Notification Permission
        try { Object.defineProperty(Notification, 'permission', { get: () => 'default', configurable: true }); } catch (e) {}

        // Screen Properties
        try {
            if (window.screen) {
                const h = screen.height, w = screen.width;
                Object.defineProperty(screen, 'availHeight', { get: () => h - (Math.floor(Math.random()*20)+40), configurable: true });
                Object.defineProperty(screen, 'availWidth', { get: () => w, configurable: true });
            }
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

    };

    (GlobalLogger || console).debug(`[AntiDetection] Injecting COMPREHENSIVE anti-detection script with dynamic timezoneId: ${detectedTimezoneId}`);
    if (pageOrContext.addInitScript) {
        await pageOrContext.addInitScript(comprehensiveAntiDetectionScript, detectedTimezoneId);
    } else if (pageOrContext.evaluateOnNewDocument) {
        const scriptString = `(${comprehensiveAntiDetectionScript.toString()})(${JSON.stringify(detectedTimezoneId)});`;
        await pageOrContext.evaluateOnNewDocument(scriptString);
    }
}
console.log('MAIN.JS: Anti-detection script function defined.');

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
        loggerToUse.debug(`Human behavior simulation (stage: ${stage}) completed.`);
    } catch (e) {
        loggerToUse.debug(`Human behavior simulation (stage: ${stage}) failed: ${e.message}`);
    }
}
console.log('MAIN.JS: Human behavior simulation function defined.');

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

        const existingHeaders = launchOptions.extraHTTPHeaders || {};
        context = await browser.newContext({
            bypassCSP: true, ignoreHTTPSErrors: true,
            viewport: { width: Math.min(1920, 1200 + Math.floor(Math.random() * 320)), height: Math.min(1080, 700 + Math.floor(Math.random() * 280)) },
            locale: detectedLocale, timezoneId: detectedTimezone, javaScriptEnabled: true,
            extraHTTPHeaders: {
                ...existingHeaders,
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
            const currentExtraHeaders = context._options?.extraHTTPHeaders || {};
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
                logEntry(`Could not find or click YouTube link on Google SERP for video ID ${job.videoId}. Error: ${googleSearchError.message.split('\n')[0]}`, 'error');
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
        }).catch(e => jobScopedLogger.warning(`Error during aggressive overlay removal: ${e.message}`));
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
                GlobalLogger.warning(`'skipAdsAfter' (${JSON.stringify(tempSkipAds)}) parsed to empty. Using default: ${JSON.stringify(defaultInput.skipAdsAfter)}`);
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
            if (effectiveInput.proxyCountry && effectiveInput.proxyCountry.trim() !== "" && effectiveInput.proxyCountry.toUpperCase() !== "ANY") {
                opts.countryCode = effectiveInput.proxyCountry;
            }
            actorProxyConfiguration = await ApifyModule.Actor.createProxyConfiguration(opts);
            GlobalLogger.info(`Apify Proxy Config created. Country: ${opts.countryCode || 'Any (group default)'}, Groups: ${effectiveInput.proxyGroups.join(', ')}`);
        } else if (effectiveInput.useProxies && effectiveInput.proxyUrls && effectiveInput.proxyUrls.length > 0) {
            GlobalLogger.info(`Using ${effectiveInput.proxyUrls.length} custom proxies.`);
        }

        const jobs = [];
        for (let i = 0; i < effectiveInput.videoUrls.length; i++) {
            const url = effectiveInput.videoUrls[i];
            if (!url || typeof url !== 'string' || (!url.includes('youtube.com') && !url.includes('youtu.be') && !url.includes('rumble.com'))) {
                GlobalLogger.warning(`Invalid or unsupported URL at index ${i}: "${url}". Skipping.`); continue;
            }
            const videoId = extractVideoId(url);
            if (!videoId) { GlobalLogger.warning(`Could not extract video ID from URL: "${url}". Skipping.`); continue; }
            const platform = url.includes('youtube.com')||url.includes('youtu.be') ? 'youtube' : (url.includes('rumble.com') ? 'rumble' : 'unknown');
            if (platform === 'unknown') { GlobalLogger.warning(`Unknown platform for URL: "${url}". Skipping.`); continue; }
            const watchType = (Array.isArray(effectiveInput.watchTypes) && effectiveInput.watchTypes[i])
                ? effectiveInput.watchTypes[i]
                : (effectiveInput.watchTypes && typeof effectiveInput.watchTypes === 'string' ? effectiveInput.watchTypes : defaultInput.watchTypes[0]) || 'direct';
            const refererUrl = (watchType === 'referer' && Array.isArray(effectiveInput.refererUrls) && effectiveInput.refererUrls[i])
                ? effectiveInput.refererUrls[i]
                : null;
            let searchKeywords = [];
            if (watchType === 'search' && Array.isArray(effectiveInput.searchKeywordsForEachVideo) && typeof effectiveInput.searchKeywordsForEachVideo[i] === 'string') {
                searchKeywords = effectiveInput.searchKeywordsForEachVideo[i].split(',').map(kw => kw.trim()).filter(kw => kw.length > 0);
            }
            if (watchType === 'search' && searchKeywords.length === 0) {
                GlobalLogger.warning(`Watch type 'search' for ${url} but no keywords. Defaulting to 'direct'.`);
                jobs.push({ id: uuidv4(), url, videoId, platform, watchType: 'direct', refererUrl: null, searchKeywords: [] });
            } else if (watchType === 'referer' && !refererUrl) {
                GlobalLogger.warning(`Watch type 'referer' for ${url} but no refererUrl provided. Defaulting to 'direct'.`);
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
                    const errRes = { jobId: job.id, url: job.url, platform: job.platform, videoId: job.videoId, status: 'catastrophic_loop_failure', error: error.message, stack: error.stack, log: [`[${new Date().toISOString()}] [ERROR] Unhandled promise: ${error.message}`]};
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

        console.log('ACTOR_MAIN_LOGIC: Reached end of main logic. Attempting to exit.');
        if (ApifyModule.Actor.exit) await ApifyModule.Actor.exit(); else process.exit(0);

    } catch (e) {
        console.error("ACTOR_MAIN_LOGIC: CRITICAL ERROR IN TOP LEVEL:", e.message, e.stack);
        if (GlobalLogger && GlobalLogger.error) {
            GlobalLogger.error("ACTOR_MAIN_LOGIC: CRITICAL ERROR IN TOP LEVEL:", { message: e.message, stack: e.stack });
        }
        if (ApifyModule.Actor.fail) await ApifyModule.Actor.fail(e.message);
        else process.exit(1);
    }
}
console.log('MAIN.JS: actorMainLogic function fully defined.');


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
