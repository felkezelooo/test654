const Apify = require('apify');
const { Actor } = Apify;
const playwright = require('playwright');
const proxyChain = require('proxy-chain');
const systemInformation = require('systeminformation');
const { v4: uuidv4 } = require('uuid');
const to = require('await-to-js').default;
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Main function
 */
async function main() {
    // Get input
    const input = await Actor.getInput() || {};
    console.log('Input:');
    console.log(JSON.stringify(input, null, 2));
    
    // Convert skipAdsAfter from strings to numbers
    if (input.skipAdsAfter && Array.isArray(input.skipAdsAfter)) {
        input.skipAdsAfter = input.skipAdsAfter.map(val => parseInt(val, 10));
    }
    
    // Set default settings
    const settings = {
        // Video URLs
        videoUrls: input.videoUrls || [],
        
        // Proxy settings
        useProxies: input.useProxies !== false,
        proxyUrls: input.proxyUrls || [],
        proxyGroups: input.proxyGroups || ['RESIDENTIAL'],
        proxyCountry: input.proxyCountry || '',
        
        // Browser settings
        headless: input.headless !== false,
        
        // Concurrency settings
        concurrency: input.concurrency || 5,
        concurrencyInterval: input.concurrencyInterval || 5,
        
        // Video settings
        watchTimePercentage: input.watchTimePercentage || 80,
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
            
            // Create a temporary user data directory for testing
            const tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-test-'));
            
            // Use launchPersistentContext instead of launch with --user-data-dir
            const browser = await playwright.chromium.launchPersistentContext(tempUserDataDir, {
                headless: true,
                proxy: {
                    server: anonymizedProxyUrl
                }
            });
            
            const page = await browser.newPage();
            
            const [err] = await to(page.goto('https://www.google.com', { 
                timeout: 30000,
                waitUntil: 'domcontentloaded'
            }));
            
            await browser.close();
            
            // Clean up the temporary directory
            fs.rmSync(tempUserDataDir, { recursive: true, force: true });
            
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
 * Generate jobs for a video
 */
async function generateJobs(video, proxies, state) {
    if (proxies.length === 0) {
        console.log('No working proxies available');
        return;
    }
    
    // Create a job for each proxy
    for (let i = 0; i < 1; i++) {
        const proxyUrl = proxies[i % proxies.length];
        
        state.jobs.push({
            id: uuidv4(),
            video_id: video.id,
            video_info: video,
            proxy: proxyUrl
        });
        
        console.log(`Generated ${state.jobs.length} jobs for video ${video.id}`);
    }
}

/**
 * Start a worker for a job
 */
async function startWorker(job, worker, userDataDir, settings) {
    console.log(`Starting worker for job ${job.id}, video ${job.video_id}`);
    
    try {
        // Create user data directory if it doesn't exist
        const userDataDirPath = path.join(os.tmpdir(), `playwright-data-${userDataDir}`);
        if (!fs.existsSync(userDataDirPath)) {
            fs.mkdirSync(userDataDirPath, { recursive: true });
        }
        
        // Anonymize proxy URL
        const anonymizedProxyUrl = await proxyChain.anonymizeProxy(job.proxy);
        
        // Use launchPersistentContext instead of launch with --user-data-dir
        const browser = await playwright.chromium.launchPersistentContext(userDataDirPath, {
            headless: settings.headless,
            proxy: {
                server: anonymizedProxyUrl
            },
            viewport: { width: 1280, height: 720 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            // Removed the args array with --user-data-dir
        });
        
        const page = await browser.newPage();
        
        // Set timeout
        page.setDefaultTimeout(settings.timeout * 1000);
        
        // Handle the video based on platform
        let success = false;
        if (job.video_info.platform === 'youtube') {
            success = await handleYouTubeVideo(page, job, worker, settings);
        } else if (job.video_info.platform === 'rumble') {
            success = await handleRumbleVideo(page, job, worker, settings);
        }
        
        // Close browser
        await browser.close();
        
        // Clean up user data directory
        if (fs.existsSync(userDataDirPath)) {
            fs.rmSync(userDataDirPath, { recursive: true, force: true });
        }
        
        return success;
    } catch (error) {
        worker.logs.push(`Worker error: ${error.message}`);
        console.log(`Worker error: ${error.message}`);
        return false;
    }
}

/**
 * Handle YouTube video
 */
async function handleYouTubeVideo(page, job, worker, settings) {
    try {
        // Navigate to video
        worker.logs.push(`Navigating to YouTube video ${job.video_id}`);
        await page.goto(`https://www.youtube.com/watch?v=${job.video_id}`, { waitUntil: 'domcontentloaded' });
        
        // Wait for video player to load
        await page.waitForSelector('video', { timeout: 30000 });
        
        // Get video duration
        const videoDuration = await page.evaluate(() => {
            const video = document.querySelector('video');
            return video ? video.duration : 0;
        });
        
        if (!videoDuration) {
            worker.logs.push('Could not determine video duration');
            return false;
        }
        
        worker.logs.push(`Video duration: ${videoDuration} seconds`);
        
        // Calculate watch time based on percentage
        const watchTimeSeconds = Math.floor(videoDuration * (job.video_info.watchTime / 100));
        worker.logs.push(`Will watch for ${watchTimeSeconds} seconds (${job.video_info.watchTime}%)`);
        
        // Handle ads if present
        let adHandled = false;
        const adCheckInterval = setInterval(async () => {
            try {
                // Check for ad
                const isAd = await page.evaluate(() => {
                    return document.querySelector('.ytp-ad-text') !== null;
                });
                
                if (isAd && !adHandled && settings.autoSkipAds) {
                    adHandled = true;
                    worker.logs.push('Ad detected, waiting to skip...');
                    
                    // Wait for skip button or ad to finish
                    const skipAdPromise = page.waitForSelector('.ytp-ad-skip-button', { timeout: settings.maxSecondsAds * 1000 });
                    const adFinishPromise = page.waitForFunction(() => !document.querySelector('.ytp-ad-text'), { timeout: settings.maxSecondsAds * 1000 });
                    
                    const skipAdTimeout = setTimeout(async () => {
                        // Try to skip ad after specified time
                        const skipButton = await page.$('.ytp-ad-skip-button');
                        if (skipButton) {
                            await skipButton.click();
                            worker.logs.push('Skipped ad after timeout');
                        }
                    }, settings.skipAdsAfter[0] * 1000);
                    
                    await Promise.race([skipAdPromise, adFinishPromise]);
                    clearTimeout(skipAdTimeout);
                    
                    // Click skip button if available
                    const skipButton = await page.$('.ytp-ad-skip-button');
                    if (skipButton) {
                        await skipButton.click();
                        worker.logs.push('Skipped ad');
                    } else {
                        worker.logs.push('Ad finished or could not be skipped');
                    }
                    
                    adHandled = false;
                }
            } catch (error) {
                worker.logs.push(`Error handling ad: ${error.message}`);
            }
        }, 1000);
        
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
        
        // Clear ad check interval
        clearInterval(adCheckInterval);
        
        worker.logs.push('Finished watching video');
        return true;
    } catch (error) {
        worker.logs.push(`Error handling YouTube video: ${error.message}`);
        return false;
    }
}

/**
 * Handle Rumble video
 */
async function handleRumbleVideo(page, job, worker, settings) {
    try {
        // Navigate to video
        worker.logs.push(`Navigating to Rumble video ${job.video_id}`);
        await page.goto(`https://rumble.com/${job.video_id}`, { waitUntil: 'domcontentloaded' });
        
        // Wait for video player to load
        await page.waitForSelector('video', { timeout: 30000 });
        
        // Get video duration
        const videoDuration = await page.evaluate(() => {
            const video = document.querySelector('video');
            return video ? video.duration : 0;
        });
        
        if (!videoDuration) {
            worker.logs.push('Could not determine video duration');
            return false;
        }
        
        worker.logs.push(`Video duration: ${videoDuration} seconds`);
        
        // Calculate watch time based on percentage
        const watchTimeSeconds = Math.floor(videoDuration * (job.video_info.watchTime / 100));
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

