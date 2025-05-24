const Apify = require('apify');
const { Actor } = Apify;
const { v4: uuidv4 } = require('uuid');
const to = require('await-to-js').default;
const playwright = require('playwright');
const proxyChain = require('proxy-chain');
const systemInformation = require('systeminformation');

// Import core functionality from original bot
const fs = require('fs');
const path = require('path');

// Remove all premium restrictions
const PREMIUM_ENABLED = true;

/**
 * Main Apify Actor function
 */
async function main() {
    // Get input from the user
    const input = await Actor.getInput();
    console.log('Input:');
    console.log(JSON.stringify(input, null, 2));

    // Initialize settings with defaults and user input
    const settings = {
        // Video settings
        videoUrls: input.videoUrls || [],
        watchTimePercentage: input.watchTimePercentage || 80,
        
        // Proxy settings
        useProxies: input.useProxies !== false,
        proxyUrls: input.proxyUrls || [],
        proxyCountry: input.proxyCountry || null,
        proxyGroups: input.proxyGroups || ['RESIDENTIAL'],
        
        // Browser settings
        headless: input.headless !== false,
        concurrency: input.concurrency || 5,
        concurrencyInterval: input.concurrencyInterval || 5,
        timeout: input.timeout || 120,
        
        // Ad settings
        maxSecondsAds: input.maxSecondsAds || 15,
        skipAdsAfter: input.skipAdsAfter || [5, 10],
        autoSkipAds: input.autoSkipAds !== false,
        
        // System settings
        stopSpawningOnOverload: input.stopSpawningOnOverload !== false,
        disableProxyTests: input.disableProxyTests || false,
        
        // Premium features (all enabled by default)
        useAV1: input.useAV1 !== false,
    };

    // Initialize state
    const state = {
        videos: [],
        proxyStats: {
            good: [],
            bad: [],
            untested: []
        },
        jobs: [],
        workers: [],
        workersFinished: [],
        workingStatus: 0,
        lastInterval: null,
        lastHealth: null
    };

    // Process video URLs
    for (const url of settings.videoUrls) {
        let videoId = '';
        
        // Extract video ID from URL
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            // YouTube URL
            if (url.includes('youtube.com/watch?v=')) {
                videoId = url.split('v=')[1].split('&')[0];
            } else if (url.includes('youtu.be/')) {
                videoId = url.split('youtu.be/')[1].split('?')[0];
            }
            
            state.videos.push({
                id: videoId,
                platform: 'youtube',
                url: url,
                watchTime: settings.watchTimePercentage
            });
        } else if (url.includes('rumble.com')) {
            // Rumble URL
            if (url.includes('rumble.com/')) {
                videoId = url.split('rumble.com/')[1].split('/')[0];
            }
            
            state.videos.push({
                id: videoId,
                platform: 'rumble',
                url: url,
                watchTime: settings.watchTimePercentage
            });
        }
    }

    // Process proxies
    if (settings.useProxies) {
        // Add user-provided proxies
        for (const proxy of settings.proxyUrls) {
            state.proxyStats.untested.push({ url: proxy });
        }
        
        // Add Apify Proxy if available
        if (Actor.isAtHome()) {
            const apifyProxyConfiguration = await Actor.createProxyConfiguration({
                groups: settings.proxyGroups,
                countryCode: settings.proxyCountry
            });
            
            if (apifyProxyConfiguration) {
                const proxyUrl = await apifyProxyConfiguration.newUrl();
                state.proxyStats.untested.push({ url: proxyUrl });
                console.log(`Added Apify Proxy URL: ${proxyUrl}`);
            }
        }
    }

    // Skip proxy tests if disabled
    if (settings.disableProxyTests) {
        state.proxyStats.good.push(...state.proxyStats.untested);
        state.proxyStats.untested = [];
    } else {
        // Test proxies
        await checkProxies(state.proxyStats.untested, state);
    }

    // Generate jobs
    for (const video of state.videos) {
        if (video.id.trim().length >= 7) {
            await generateJobs(video, state.proxyStats.good.map(p => p.url), state);
        }
    }

    // Start working
    await startWorking(state, settings);

    // Log results
    console.log(`Completed ${state.workersFinished.length} jobs`);
    
    // Save results to key-value store
    await Actor.setValue('RESULTS', {
        completedJobs: state.workersFinished.length,
        videos: state.videos,
        workers: state.workersFinished
    });
}

/**
 * Check if proxies are working
 */
async function checkProxies(proxies, state) {
    console.log(`Testing ${proxies.length} proxies...`);
    
    for (let i = 0; i < proxies.length; i++) {
        const proxy = proxies[i];
        
        try {
            // Test proxy with a simple request
            const proxyUrl = proxy.url;
            const anonymizedProxyUrl = await proxyChain.anonymizeProxy(proxyUrl);
            
            const browser = await playwright.chromium.launch({
                headless: true,
                proxy: {
                    server: anonymizedProxyUrl
                }
            });
            
            const context = await browser.newContext();
            const page = await context.newPage();
            
            const [err] = await to(page.goto('https://www.google.com', { 
                timeout: 30000,
                waitUntil: 'domcontentloaded'
            }));
            
            await browser.close();
            
            if (!err) {
                state.proxyStats.good.push(proxy);
                console.log(`Proxy ${i+1}/${proxies.length} is working: ${proxyUrl}`);
            } else {
                state.proxyStats.bad.push({ ...proxy, err: err.message });
                console.log(`Proxy ${i+1}/${proxies.length} failed: ${proxyUrl} - ${err.message}`);
            }
        } catch (error) {
            state.proxyStats.bad.push({ ...proxy, err: error.message });
            console.log(`Error testing proxy ${i+1}/${proxies.length}: ${error.message}`);
        }
    }
    
    console.log(`Proxy testing complete. Good: ${state.proxyStats.good.length}, Bad: ${state.proxyStats.bad.length}`);
}

/**
 * Generate jobs for videos and proxies
 */
async function generateJobs(video, proxies, state) {
    if (proxies.length === 0) {
        console.log('No working proxies available');
        return;
    }
    
    for (let i = 0; i < proxies.length; i++) {
        const job = {
            id: uuidv4(),
            video_info: video,
            proxy: proxies[i]
        };
        
        state.jobs.push(job);
    }
    
    console.log(`Generated ${proxies.length} jobs for video ${video.id}`);
}

/**
 * Start worker for a job
 */
async function startWorker(job, worker, userDataDir, settings) {
    console.log(`Starting worker for job ${job.id}, video ${job.video_info.id}`);
    
    try {
        // Setup browser with proxy
        const proxyUrl = job.proxy;
        const anonymizedProxyUrl = await proxyChain.anonymizeProxy(proxyUrl);
        
        const browser = await playwright.chromium.launch({
            headless: settings.headless,
            proxy: {
                server: anonymizedProxyUrl
            },
            args: [
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--autoplay-policy=no-user-gesture-required',
                '--disable-blink-features=AutomationControlled',
                `--user-data-dir=/tmp/playwright-${userDataDir}`
            ]
        });
        
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            viewport: { width: 1280, height: 720 },
            deviceScaleFactor: 1,
        });
        
        // Add log entry
        worker.logs.push(`Browser launched with proxy ${proxyUrl}`);
        
        // Create page
        const page = await context.newPage();
        
        // Setup page event handlers
        page.on('console', msg => {
            worker.logs.push(`Console: ${msg.text()}`);
        });
        
        page.on('pageerror', err => {
            worker.logs.push(`Page error: ${err.message}`);
        });
        
        // Navigate to video
        const videoUrl = job.video_info.url;
        worker.logs.push(`Navigating to ${videoUrl}`);
        
        await page.goto(videoUrl, { 
            timeout: settings.timeout * 1000,
            waitUntil: 'domcontentloaded'
        });
        
        // Wait for video to load
        worker.logs.push('Waiting for video to load');
        
        if (job.video_info.platform === 'youtube') {
            // Handle YouTube
            await handleYouTubeVideo(page, job, worker, settings);
        } else if (job.video_info.platform === 'rumble') {
            // Handle Rumble
            await handleRumbleVideo(page, job, worker, settings);
        }
        
        // Close browser
        await browser.close();
        worker.logs.push('Browser closed');
        
        return true;
    } catch (error) {
        worker.logs.push(`Error: ${error.message}`);
        console.error(`Worker error: ${error.message}`);
        return false;
    }
}

/**
 * Handle YouTube video playback
 */
async function handleYouTubeVideo(page, job, worker, settings) {
    try {
        // Wait for video player
        await page.waitForSelector('video', { timeout: 30000 });
        worker.logs.push('Video player found');
        
        // Get video duration
        const videoDuration = await page.evaluate(() => {
            const video = document.querySelector('video');
            return video ? video.duration : 0;
        });
        
        worker.logs.push(`Video duration: ${videoDuration} seconds`);
        
        // Calculate watch time
        const watchTimeSeconds = (videoDuration * job.video_info.watchTime) / 100;
        worker.logs.push(`Will watch for ${watchTimeSeconds} seconds (${job.video_info.watchTime}%)`);
        
        // Click play if needed
        await page.evaluate(() => {
            const video = document.querySelector('video');
            if (video && video.paused) {
                video.play();
            }
        });
        
        // Handle ads if needed
        if (settings.autoSkipAds) {
            worker.logs.push('Auto skip ads enabled');
            
            // Check for ads periodically
            const adCheckInterval = setInterval(async () => {
                try {
                    const isAd = await page.evaluate(() => {
                        return document.querySelector('.ytp-ad-player-overlay') !== null;
                    });
                    
                    if (isAd) {
                        worker.logs.push('Ad detected, attempting to skip');
                        
                        // Try to click skip button
                        await page.evaluate(() => {
                            const skipButton = document.querySelector('.ytp-ad-skip-button');
                            if (skipButton) skipButton.click();
                        });
                    }
                } catch (error) {
                    // Ignore errors in ad checking
                }
            }, 2000);
            
            // Clear interval when done
            setTimeout(() => clearInterval(adCheckInterval), watchTimeSeconds * 1000);
        }
        
        // Wait for the calculated watch time
        worker.logs.push(`Watching video for ${watchTimeSeconds} seconds`);
        await page.waitForTimeout(watchTimeSeconds * 1000);
        
        worker.logs.push('Finished watching video');
        return true;
    } catch (error) {
        worker.logs.push(`Error handling YouTube video: ${error.message}`);
        return false;
    }
}

/**
 * Handle Rumble video playback
 */
async function handleRumbleVideo(page, job, worker, settings) {
    try {
        // Wait for video player
        await page.waitForSelector('video', { timeout: 30000 });
        worker.logs.push('Video player found');
        
        // Get video duration
        const videoDuration = await page.evaluate(() => {
            const video = document.querySelector('video');
            return video ? video.duration : 0;
        });
        
        worker.logs.push(`Video duration: ${videoDuration} seconds`);
        
        // Calculate watch time
        const watchTimeSeconds = (videoDuration * job.video_info.watchTime) / 100;
        worker.logs.push(`Will watch for ${watchTimeSeconds} seconds (${job.video_info.watchTime}%)`);
        
        // Click play if needed
        await page.evaluate(() => {
            const video = document.querySelector('video');
            if (video && video.paused) {
                video.play();
            }
        });
        
        // Wait for the calculated watch time
        worker.logs.push(`Watching video for ${watchTimeSeconds} seconds`);
        await page.waitForTimeout(watchTimeSeconds * 1000);
        
        worker.logs.push('Finished watching video');
        return true;
    } catch (error) {
        worker.logs.push(`Error handling Rumble video: ${error.message}`);
        return false;
    }
}

/**
 * Start working on jobs
 */
async function startWorking(state, settings) {
    console.log(`Starting to work on ${state.jobs.length} jobs with concurrency ${settings.concurrency}`);
    
    // Track system health
    const healthCheckInterval = setInterval(async () => {
        try {
            const cpuLoad = await systemInformation.currentLoad();
            const memory = await systemInformation.mem();
            
            state.lastHealth = {
                main: {
                    load: cpuLoad,
                    memory: memory
                }
            };
        } catch (error) {
            console.error(`Health check error: ${error.message}`);
        }
    }, 5000);
    
    // Initialize worker variables
    let currentOpen = 0;
    let currentWorker = -1;
    let workersFinished = 0;
    let availableUserDataDirs = [];
    let lastOpened = Date.now() - 1000 * (settings.concurrencyInterval + 1.5);
    let maxWorkers = state.jobs.length;
    let currentConcurrency = parseInt(settings.concurrency);
    
    for (let dataDir = 0; dataDir < currentConcurrency; dataDir++) {
        availableUserDataDirs.push(dataDir);
    }
    
    // Process jobs with concurrency control
    state.lastInterval = setInterval(async () => {
        if (Date.now() > (settings.concurrencyInterval * 1000 + lastOpened)) {
            if (settings.stopSpawningOnOverload) {
                if (!state.lastHealth || !state.lastHealth.main) return;
                let cpuLoad = state.lastHealth.main.load.currentLoad;
                let ramLoad = (state.lastHealth.main.memory.active / state.lastHealth.main.memory.total) * 100;
                if (cpuLoad > 95 || ramLoad > 90) return;
            }
            
            if (currentOpen >= currentConcurrency) return;
            
            lastOpened = Date.now();
            let currentJob = state.jobs[currentWorker + 1];
            
            if (currentJob) {
                currentOpen += 1;
                currentWorker += 1;
                let tempWorker = currentWorker;
                let userDataDir = tempWorker;
                
                if (typeof availableUserDataDirs[0] !== "undefined") {
                    userDataDir = availableUserDataDirs.shift();
                }
                
                let worker = {
                    job: currentJob,
                    logs: [],
                    id: uuidv4(),
                    bandwidth: 0,
                    currentTime: 0,
                    startTime: Date.now(),
                    video_info: currentJob.video_info,
                };
                
                state.workers.push(worker);
                console.log(`Starting worker ${worker.id} for job ${currentJob.id}`);
                
                let [err, result] = await to(startWorker(currentJob, worker, userDataDir, settings));
                
                if (err && !err.includes("closed") && !err.includes("disconnected") && !err.includes("Protocol")) {
                    console.log(`Worker error: ${err}`);
                }
                
                // Remove from active workers and add to finished
                state.workers = state.workers.filter((v) => v.id !== worker.id);
                state.workersFinished.push(worker);
                availableUserDataDirs.push(userDataDir);
                
                currentOpen -= 1;
                workersFinished += 1;
                
                console.log(`Worker ${worker.id} finished. Progress: ${workersFinished}/${maxWorkers}`);
                
                if (workersFinished == maxWorkers) {
                    clearInterval(state.lastInterval);
                    clearInterval(healthCheckInterval);
                    state.lastInterval = undefined;
                    console.log('All workers finished');
                    return;
                }
            }
        }
    }, 1000);
    
    // Wait for all jobs to complete
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            if (workersFinished >= maxWorkers) {
                clearInterval(checkInterval);
                resolve();
            }
        }, 5000);
    });
}

// Run the actor
Actor.main(main);
