const Apify = require('apify');
const { chromium } = require('playwright');
const to = require('await-to-js').default;
const { v4: uuidv4 } = require('uuid');
const ProxyAgent = require('proxy-chain').ProxyAgent;

// Add extensive logging to help debug issues
console.log('Starting YouTube & Rumble View Bot Actor');

// Replace Apify.main with module.exports for compatibility with all Apify SDK versions
module.exports = async () => {
    try {
        console.log('Actor main function started');
        
        // Get input with error handling
        let input;
        try {
            input = await Apify.getInput();
            console.log('Input received:', JSON.stringify(input, null, 2));
        } catch (error) {
            console.error('Error getting input:', error);
            input = {};
        }
        
        // Validate input - ensure we have at least one video URL
        if (!input || !input.videoUrls || !Array.isArray(input.videoUrls) || input.videoUrls.length === 0) {
            console.error('No video URLs provided in input. Please provide at least one video URL to watch.');
            await Apify.pushData({
                status: 'error',
                message: 'No video URLs provided in input. Please provide at least one video URL to watch.'
            });
            return; // Exit early with error message
        }
        
        console.log(`Found ${input.videoUrls.length} video URLs to process`);

        // Initialize state for progress tracking
        const state = await Apify.getValue('STATE') || {
            startTime: Date.now(),
            totalJobs: 0,
            completedJobs: 0,
            failedJobs: 0,
            currentJobs: [],
            jobHistory: [],
            lastUpdateTime: Date.now()
        };
        
        console.log('State initialized');

        // Initialize key-value store for progress data
        const progressStore = await Apify.openKeyValueStore('progress-data');
        console.log('Progress store opened');

        // Set up proxy configuration
        let proxyConfiguration = null;
        if (input.useProxies) {
            const proxyGroups = input.proxyGroups || ['RESIDENTIAL'];
            const proxyCountry = input.proxyCountry || 'US';
            
            console.log(`Setting up Apify Proxy with groups: ${proxyGroups.join(', ')}, country: ${proxyCountry}`);
            
            try {
                proxyConfiguration = await Apify.createProxyConfiguration({
                    groups: proxyGroups,
                    countryCode: proxyCountry
                });
                console.log('Proxy configuration created successfully');
            } catch (error) {
                console.error('Error creating proxy configuration:', error);
                console.log('Continuing without proxies');
            }
        } else {
            console.log('Proxies disabled in input, continuing without proxies');
        }

        // Initialize proxy state tracking
        const proxyState = {
            usedProxies: new Map(), // Maps video IDs to proxy URLs
            proxyPerformance: new Map(), // Maps proxy URLs to performance metrics
            currentProxyUrl: null,
            proxyTestResults: {
                total: 0,
                working: 0,
                failed: 0
            }
        };
        
        console.log('Proxy state initialized');

        // Test proxies if enabled
        if (input.useProxies && !input.disableProxyTests && proxyConfiguration) {
            console.log('Testing proxies...');
            await testProxies(proxyConfiguration, proxyState, input);
        }

        // Process video URLs
        const videoUrls = input.videoUrls || [];
        const jobs = [];

        // Generate jobs for each video
        for (const url of videoUrls) {
            // Extract video ID
            const videoId = extractVideoId(url);
            if (!videoId) {
                console.log(`Could not extract video ID from URL: ${url}`);
                continue;
            }

            // Create job
            const job = {
                id: uuidv4(),
                url,
                videoId,
                platform: url.includes('youtube.com') || url.includes('youtu.be') ? 'youtube' : 'rumble',
                video_info: {
                    watchTime: input.watchTimePercentage
                },
                engagement: {
                    enabled: input.enableEngagement || false,
                    like: input.performLike || false,
                    comment: input.leaveComment || false,
                    commentText: input.commentText || '',
                    subscribe: input.subscribeToChannel || false
                }
            };

            jobs.push(job);
            console.log(`Generated job for video ${videoId}`);
        }

        // Update state with total jobs
        state.totalJobs = jobs.length;
        await updateProgressData(state, progressStore);

        console.log(`Generated ${jobs.length} jobs for video URLs`);

        // Process jobs with concurrency control
        const concurrency = input.concurrency || 1;
        const concurrencyInterval = input.concurrencyInterval || 1;

        let activeWorkers = 0;
        let completedJobs = 0;

        console.log(`Starting job processing with concurrency: ${concurrency}, interval: ${concurrencyInterval}s`);

        // Process jobs
        for (const job of jobs) {
            // Wait if at concurrency limit
            while (activeWorkers >= concurrency) {
                console.log(`Waiting for worker slot (active: ${activeWorkers}/${concurrency})`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Start worker
            activeWorkers++;
            const workerId = uuidv4();
            console.log(`Starting worker ${workerId} for job ${job.id}`);

            // Track job start
            trackJobStart(state, job);
            await updateProgressData(state, progressStore);

            // Process job in background
            processJob(job, workerId, input, proxyConfiguration, proxyState, state, progressStore).then(() => {
                activeWorkers--;
                completedJobs++;
                console.log(`Worker ${workerId} finished. Progress: ${completedJobs}/${jobs.length}`);

                // Check if all jobs are done
                if (completedJobs === jobs.length) {
                    console.log('All workers finished');
                }
            }).catch(error => {
                activeWorkers--;
                completedJobs++;
                console.log(`Worker ${workerId} failed: ${error.message}`);

                // Track job failure
                trackJobFailure(state, job, error);
                updateProgressData(state, progressStore);

                // Check if all jobs are done
                if (completedJobs === jobs.length) {
                    console.log('All workers finished');
                }
            });

            // Wait between spawning workers
            if (concurrencyInterval > 0) {
                console.log(`Waiting ${concurrencyInterval}s before starting next worker`);
                await new Promise(resolve => setTimeout(resolve, concurrencyInterval * 1000));
            }
        }

        console.log(`All jobs started, waiting for completion (${jobs.length} total jobs)`);

        // Wait for all jobs to complete
        while (completedJobs < jobs.length) {
            console.log(`Waiting for job completion: ${completedJobs}/${jobs.length} done`);
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // Final progress update
        await updateProgressData(state, progressStore);

        console.log(`Completed ${jobs.length} jobs. Actor execution finished.`);
        
        // Push final summary to dataset
        await Apify.pushData({
            status: 'completed',
            summary: {
                totalJobs: jobs.length,
                completedJobs: state.completedJobs,
                failedJobs: state.failedJobs,
                runtime: Math.round((Date.now() - state.startTime) / 1000)
            }
        });
        
    } catch (error) {
        console.error('Unhandled error in actor main function:', error);
        
        // Report error to Apify
        await Apify.pushData({
            status: 'error',
            error: error.message,
            stack: error.stack
        });
    }
};

/**
 * Process a single job
 */
async function processJob(job, workerId, settings, proxyConfiguration, proxyState, state, progressStore) {
    // Create worker object
    const worker = {
        id: workerId,
        jobId: job.id,
        videoId: job.videoId,
        platform: job.platform,
        startTime: Date.now(),
        logs: [],
        errors: []
    };

    try {
        worker.logs.push(`Starting worker for job ${job.id}, video ${job.videoId}`);
        console.log(`Starting worker for job ${job.id}, video ${job.videoId}`);

        // Get proxy for this video
        let proxyUrl = null;
        try {
            proxyUrl = await getProxyForVideo(proxyConfiguration, proxyState, job.videoId, settings);
        } catch (error) {
            console.log(`Error getting proxy, continuing without proxy: ${error.message}`);
        }

        // Launch browser with error handling
        let browser;
        try {
            console.log('Launching browser...');
            browser = await chromium.launch({
                headless: settings.headless !== false,
                proxy: proxyUrl ? { server: proxyUrl } : undefined
            });
            console.log('Browser launched successfully');
        } catch (error) {
            console.error(`Error launching browser: ${error.message}`);
            throw new Error(`Failed to launch browser: ${error.message}`);
        }

        // Create context and page
        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: getRandomUserAgent()
        });

        const page = await context.newPage();
        console.log('Browser page created');

        // Apply anti-detection measures
        await applyAntiDetectionMeasures(page, settings);

        // Set up natural mouse movements and scrolling
        await simulateNaturalMouseMovements(page);
        const stopScrolling = await simulateNaturalScrolling(page);

        // Process video based on platform
        let result = false;

        if (job.platform === 'youtube') {
            // Handle YouTube video
            result = await handleYouTubeVideo(page, job, worker, settings, state, progressStore);

            // Perform engagement actions if enabled and video was watched successfully
            if (result && job.engagement && job.engagement.enabled) {
                await performYouTubeEngagement(page, job, worker, settings);
            }
        } else if (job.platform === 'rumble') {
            // Handle Rumble video
            result = await handleRumbleVideo(page, job, worker, settings, state, progressStore);

            // Perform engagement actions if enabled and video was watched successfully
            if (result && job.engagement && job.engagement.enabled) {
                await performRumbleEngagement(page, job, worker, settings);
            }
        }

        // Stop scrolling
        if (stopScrolling) stopScrolling();

        // Close browser
        await browser.close();
        console.log('Browser closed');

        // Record proxy performance
        if (proxyUrl) {
            recordProxyPerformance(proxyState, proxyUrl, {
                success: result,
                responseTime: Date.now() - worker.startTime,
                error: result ? null : 'Video processing failed'
            });
        }

        // Track job completion
        if (result) {
            trackJobCompletion(state, job, {
                success: true,
                watchTime: worker.totalTime
            });
        } else {
            trackJobFailure(state, job, 'Video processing failed');
        }

        // Update progress data
        await updateProgressData(state, progressStore);

        return result;
    } catch (error) {
        worker.logs.push(`Error processing job: ${error.message}`);
        console.log(`Error processing job: ${error.message}`);

        // Track job failure
        trackJobFailure(state, job, error);
        await updateProgressData(state, progressStore);

        throw error;
    }
}

/**
 * Handle YouTube video watching
 */
async function handleYouTubeVideo(page, job, worker, settings, state, progressStore) {
    try {
        // Log the start of video navigation
        worker.logs.push(`Navigating to YouTube video ${job.videoId}`);
        console.log(`Navigating to YouTube video ${job.videoId}`);
        
        // Navigate to video with improved wait conditions
        await page.goto(`https://www.youtube.com/watch?v=${job.videoId}`, { 
            waitUntil: 'domcontentloaded',
            timeout: settings.timeout * 1000 || 120000
        });
        console.log('Page loaded');
        
        // Wait for video player to load with increased reliability
        await page.waitForSelector('video', { timeout: 60000 });
        console.log('Video player found');
        
        // More reliable video duration detection with retry mechanism
        const videoDuration = await getVideoDurationWithRetry(page, 3);
        
        if (!videoDuration || videoDuration <= 0) {
            worker.logs.push('Could not determine video duration after multiple attempts');
            console.log('Could not determine video duration after multiple attempts');
            return false;
        }
        
        worker.logs.push(`Video duration: ${videoDuration} seconds`);
        console.log(`Video duration: ${videoDuration} seconds`);
        
        // Calculate watch time based on percentage with minimum threshold
        const watchTimePercentage = job.video_info.watchTime || settings.watchTimePercentage || 80;
        const watchTimeSeconds = Math.max(
            Math.floor(videoDuration * (watchTimePercentage / 100)),
            Math.min(30, videoDuration) // At least 30 seconds or full video if shorter
        );
        
        worker.logs.push(`Will watch for ${watchTimeSeconds} seconds (${watchTimePercentage}%)`);
        console.log(`Will watch for ${watchTimeSeconds} seconds (${watchTimePercentage}%)`);
        
        // Ensure video is playing
        await ensureVideoIsPlaying(page);
        console.log('Video playback started');
        
        // Handle ads with improved detection and skipping
        const adCheckInterval = setInterval(async () => {
            try {
                await handleAds(page, worker, settings);
            } catch (error) {
                worker.logs.push(`Error handling ad: ${error.message}`);
                console.log(`Error handling ad: ${error.message}`);
            }
        }, 2000);
        
        // Set up progress reporting
        const progressInterval = setInterval(async () => {
            try {
                const currentTime = await getCurrentVideoTime(page);
                const progressPercent = Math.min(100, Math.round((currentTime / watchTimeSeconds) * 100));
                
                worker.logs.push(`Watching progress: ${progressPercent}% (${Math.round(currentTime)}/${watchTimeSeconds} seconds)`);
                console.log(`Watching progress: ${progressPercent}% (${Math.round(currentTime)}/${watchTimeSeconds} seconds)`);
                
                // Update worker state for real-time tracking
                worker.currentTime = currentTime;
                worker.totalTime = watchTimeSeconds;
                worker.progressPercent = progressPercent;
                
                // Update job progress
                trackJobProgress(state, job, {
                    progress: progressPercent,
                    currentTime: Math.round(currentTime),
                    totalTime: watchTimeSeconds,
                    status: 'watching'
                });
                
                // Update progress data
                await updateProgressData(state, progressStore);
                
                // Report to Apify
                await Apify.pushData({
                    status: 'watching',
                    videoId: job.videoId,
                    progress: progressPercent,
                    currentTime: Math.round(currentTime),
                    totalTime: watchTimeSeconds
                });
            } catch (error) {
                console.log(`Error updating progress: ${error.message}`);
            }
        }, 5000);
        
        // Wait for the calculated watch time with verification
        worker.logs.push(`Starting to watch video for ${watchTimeSeconds} seconds`);
        console.log(`Starting to watch video for ${watchTimeSeconds} seconds`);
        
        // Use a more reliable waiting mechanism that checks actual video progress
        await watchVideoWithVerification(page, watchTimeSeconds);
        
        // Clear intervals
        clearInterval(adCheckInterval);
        clearInterval(progressInterval);
        
        worker.logs.push('Finished watching video successfully');
        console.log('Finished watching video successfully');
        
        // Report completion to Apify
        await Apify.pushData({
            status: 'completed',
            videoId: job.videoId,
            progress: 100,
            watchTime: watchTimeSeconds
        });
        
        return true;
    } catch (error) {
        worker.logs.push(`Error handling YouTube video: ${error.message}`);
        console.log(`Error handling YouTube video: ${error.message}`);
        
        // Report error to Apify
        await Apify.pushData({
            status: 'error',
            videoId: job.videoId,
            error: error.message
        });
        
        return false;
    }
}

/**
 * Handle Rumble video watching
 */
async function handleRumbleVideo(page, job, worker, settings, state, progressStore) {
    try {
        // Log the start of video navigation
        worker.logs.push(`Navigating to Rumble video ${job.videoId}`);
        console.log(`Navigating to Rumble video ${job.videoId}`);
        
        // Navigate to video
        await page.goto(job.url, { 
            waitUntil: 'domcontentloaded',
            timeout: settings.timeout * 1000 || 120000
        });
        console.log('Rumble page loaded');
        
        // Wait for video player to load
        await page.waitForSelector('video', { timeout: 60000 });
        console.log('Rumble video player found');
        
        // Get video duration
        const videoDuration = await getVideoDurationWithRetry(page, 3);
        
        if (!videoDuration || videoDuration <= 0) {
            worker.logs.push('Could not determine Rumble video duration after multiple attempts');
            console.log('Could not determine Rumble video duration after multiple attempts');
            return false;
        }
        
        worker.logs.push(`Rumble video duration: ${videoDuration} seconds`);
        console.log(`Rumble video duration: ${videoDuration} seconds`);
        
        // Calculate watch time based on percentage with minimum threshold
        const watchTimePercentage = job.video_info.watchTime || settings.watchTimePercentage || 80;
        const watchTimeSeconds = Math.max(
            Math.floor(videoDuration * (watchTimePercentage / 100)),
            Math.min(30, videoDuration) // At least 30 seconds or full video if shorter
        );
        
        worker.logs.push(`Will watch Rumble video for ${watchTimeSeconds} seconds (${watchTimePercentage}%)`);
        console.log(`Will watch Rumble video for ${watchTimeSeconds} seconds (${watchTimePercentage}%)`);
        
        // Ensure video is playing
        await ensureVideoIsPlaying(page);
        console.log('Rumble video playback started');
        
        // Set up progress reporting
        const progressInterval = setInterval(async () => {
            try {
                const currentTime = await getCurrentVideoTime(page);
                const progressPercent = Math.min(100, Math.round((currentTime / watchTimeSeconds) * 100));
                
                worker.logs.push(`Watching Rumble progress: ${progressPercent}% (${Math.round(currentTime)}/${watchTimeSeconds} seconds)`);
                console.log(`Watching Rumble progress: ${progressPercent}% (${Math.round(currentTime)}/${watchTimeSeconds} seconds)`);
                
                // Update worker state for real-time tracking
                worker.currentTime = currentTime;
                worker.totalTime = watchTimeSeconds;
                worker.progressPercent = progressPercent;
                
                // Update job progress
                trackJobProgress(state, job, {
                    progress: progressPercent,
                    currentTime: Math.round(currentTime),
                    totalTime: watchTimeSeconds,
                    status: 'watching'
                });
                
                // Update progress data
                await updateProgressData(state, progressStore);
                
                // Report to Apify
                await Apify.pushData({
                    status: 'watching',
                    videoId: job.videoId,
                    progress: progressPercent,
                    currentTime: Math.round(currentTime),
                    totalTime: watchTimeSeconds
                });
            } catch (error) {
                console.log(`Error updating Rumble progress: ${error.message}`);
            }
        }, 5000);
        
        // Wait for the calculated watch time with verification
        worker.logs.push(`Starting to watch Rumble video for ${watchTimeSeconds} seconds`);
        console.log(`Starting to watch Rumble video for ${watchTimeSeconds} seconds`);
        
        // Use a more reliable waiting mechanism that checks actual video progress
        await watchVideoWithVerification(page, watchTimeSeconds);
        
        // Clear interval
        clearInterval(progressInterval);
        
        worker.logs.push('Finished watching Rumble video successfully');
        console.log('Finished watching Rumble video successfully');
        
        // Report completion to Apify
        await Apify.pushData({
            status: 'completed',
            videoId: job.videoId,
            progress: 100,
            watchTime: watchTimeSeconds
        });
        
        return true;
    } catch (error) {
        worker.logs.push(`Error handling Rumble video: ${error.message}`);
        console.log(`Error handling Rumble video: ${error.message}`);
        
        // Report error to Apify
        await Apify.pushData({
            status: 'error',
            videoId: job.videoId,
            error: error.message
        });
        
        return false;
    }
}

/**
 * Get video duration with retry mechanism
 */
async function getVideoDurationWithRetry(page, maxRetries) {
    let retries = 0;
    let duration = 0;
    
    while (retries < maxRetries) {
        try {
            // Try multiple selectors and methods to get duration
            duration = await page.evaluate(() => {
                // Method 1: Direct video element
                const video = document.querySelector('video');
                if (video && video.duration && video.duration !== Infinity) {
                    return video.duration;
                }
                
                // Method 2: YouTube specific time display
                const timeDisplay = document.querySelector('.ytp-time-duration');
                if (timeDisplay) {
                    const timeParts = timeDisplay.textContent.split(':').map(Number);
                    if (timeParts.length === 3) { // hours:minutes:seconds
                        return timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
                    } else if (timeParts.length === 2) { // minutes:seconds
                        return timeParts[0] * 60 + timeParts[1];
                    }
                }
                
                // Method 3: Rumble specific time display
                const rumbleTimeDisplay = document.querySelector('.media-time-duration');
                if (rumbleTimeDisplay) {
                    const timeParts = rumbleTimeDisplay.textContent.split(':').map(Number);
                    if (timeParts.length === 3) { // hours:minutes:seconds
                        return timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
                    } else if (timeParts.length === 2) { // minutes:seconds
                        return timeParts[0] * 60 + timeParts[1];
                    }
                }
                
                return 0;
            });
            
            if (duration > 0) {
                return duration;
            }
            
            // Wait before retrying
            await page.waitForTimeout(2000);
            retries++;
        } catch (error) {
            console.log(`Error getting video duration (attempt ${retries+1}): ${error.message}`);
            await page.waitForTimeout(2000);
            retries++;
        }
    }
    
    return duration;
}

/**
 * Ensure video is playing
 */
async function ensureVideoIsPlaying(page) {
    try {
        // Check if video is paused and play if needed
        const isPlaying = await page.evaluate(() => {
            const video = document.querySelector('video');
            if (video && video.paused) {
                // Try multiple methods to start playback
                
                // Method 1: Direct play call
                video.play();
                
                // Method 2: Click play button
                const playButton = document.querySelector('.ytp-play-button') || 
                                  document.querySelector('.play-button');
                if (playButton) {
                    playButton.click();
                }
                
                // Method 3: Press space key on video
                video.focus();
                
                return !video.paused;
            }
            return video ? !video.paused : false;
        });
        
        if (!isPlaying) {
            // Fallback: Try clicking on video element
            await page.click('video');
            
            // Alternative: Press space key
            await page.keyboard.press('Space');
        }
        
        // Verify playback started
        await page.waitForFunction(() => {
            const video = document.querySelector('video');
            return video && !video.paused && video.currentTime > 0;
        }, { timeout: 10000 });
        
        console.log('Video playback confirmed');
    } catch (error) {
        console.log(`Error ensuring video playback: ${error.message}`);
        // Last resort: reload page and try again
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForSelector('video', { timeout: 30000 });
        await page.click('video');
    }
}

/**
 * Handle ads with improved detection and skipping
 */
async function handleAds(page, worker, settings) {
    // Check for ad
    const adInfo = await page.evaluate(() => {
        const adText = document.querySelector('.ytp-ad-text');
        const skipButton = document.querySelector('.ytp-ad-skip-button');
        const adOverlay = document.querySelector('.ytp-ad-player-overlay');
        const video = document.querySelector('video');
        
        return {
            isAd: !!(adText || adOverlay),
            canSkip: !!skipButton,
            adDuration: video ? video.duration : 0,
            currentTime: video ? video.currentTime : 0
        };
    });
    
    if (adInfo.isAd) {
        worker.logs.push('Ad detected');
        console.log('Ad detected');
        
        if (settings.autoSkipAds) {
            // Wait for skip button with timeout
            try {
                await page.waitForSelector('.ytp-ad-skip-button', { 
                    timeout: Math.min(settings.maxSecondsAds * 1000 || 15000, 30000)
                });
                
                // Click skip button
                await page.click('.ytp-ad-skip-button');
                worker.logs.push('Skipped ad');
                console.log('Skipped ad');
            } catch (error) {
                // If skip button doesn't appear, check if we should wait or force skip
                const currentAdTime = await page.evaluate(() => {
                    const video = document.querySelector('video');
                    return video ? video.currentTime : 0;
                });
                
                // If we've waited long enough, try to force skip
                const skipAdsAfter = settings.skipAdsAfter || [5, 10];
                const skipAfterSeconds = parseInt(skipAdsAfter[0]) || 5;
                
                if (currentAdTime > skipAfterSeconds) {
                    try {
                        // Try multiple skip methods
                        await page.evaluate(() => {
                            // Method 1: Try to find and click skip button again
                            const skipButton = document.querySelector('.ytp-ad-skip-button');
                            if (skipButton) skipButton.click();
                            
                            // Method 2: Try to advance video time
                            const video = document.querySelector('video');
                            if (video) video.currentTime = video.duration - 0.1;
                        });
                        
                        worker.logs.push('Forced ad skip');
                        console.log('Forced ad skip');
                    } catch (skipError) {
                        worker.logs.push(`Could not force skip ad: ${skipError.message}`);
                        console.log(`Could not force skip ad: ${skipError.message}`);
                    }
                }
            }
        } else {
            worker.logs.push('Ad skipping disabled, waiting for ad to finish');
            console.log('Ad skipping disabled, waiting for ad to finish');
        }
    }
}

/**
 * Get current video time
 */
async function getCurrentVideoTime(page) {
    return page.evaluate(() => {
        const video = document.querySelector('video');
        return video ? video.currentTime : 0;
    });
}

/**
 * Watch video with verification of actual progress
 */
async function watchVideoWithVerification(page, targetSeconds) {
    const startTime = Date.now();
    const maxWaitTime = targetSeconds * 1000 * 1.5; // 50% buffer for ads, buffering, etc.
    let lastTime = 0;
    
    while (true) {
        // Check if we've exceeded maximum wait time
        if (Date.now() - startTime > maxWaitTime) {
            console.log(`Exceeded maximum wait time of ${maxWaitTime}ms, finishing watch`);
            break;
        }
        
        // Get current video time
        const currentTime = await getCurrentVideoTime(page);
        
        // Check if video has progressed
        if (currentTime > lastTime) {
            lastTime = currentTime;
        } else {
            // If video hasn't progressed, check if it's paused and try to resume
            await ensureVideoIsPlaying(page);
        }
        
        // Check if we've watched enough
        if (currentTime >= targetSeconds) {
            console.log(`Reached target watch time of ${targetSeconds} seconds`);
            break;
        }
        
        // Wait before checking again
        await page.waitForTimeout(2000);
    }
}

/**
 * Apply anti-detection measures
 */
async function applyAntiDetectionMeasures(page, settings) {
    console.log('Applying advanced anti-detection measures');
    
    // Apply browser fingerprint protection
    await page.evaluateOnNewDocument(() => {
        // Override navigator properties
        const navigatorProps = {
            webdriver: false,
            languages: ['en-US', 'en'],
            plugins: {
                length: Math.floor(Math.random() * 5) + 3,
                item: () => null,
                namedItem: () => null,
                refresh: () => {}
            },
            vendor: 'Google Inc.',
            platform: 'Win32',
            hardwareConcurrency: 8,
            deviceMemory: 8,
            maxTouchPoints: 0,
            doNotTrack: null,
            appVersion: navigator.userAgent.substring(8)
        };
        
        // Apply navigator property overrides
        for (const [key, value] of Object.entries(navigatorProps)) {
            try {
                if (key === 'plugins') {
                    // Handle plugins specially
                    Object.defineProperty(navigator, 'plugins', {
                        get: () => {
                            return {
                                length: value.length,
                                item: value.item,
                                namedItem: value.namedItem,
                                refresh: value.refresh
                            };
                        }
                    });
                } else {
                    // Override other properties
                    Object.defineProperty(navigator, key, {
                        get: () => value
                    });
                }
            } catch (e) {
                console.log(`Failed to override navigator.${key}`);
            }
        }
        
        // Override chrome property
        if (window.chrome) {
            Object.defineProperty(window, 'chrome', {
                get: () => {
                    return {
                        app: {
                            isInstalled: false,
                            InstallState: {
                                DISABLED: 'disabled',
                                INSTALLED: 'installed',
                                NOT_INSTALLED: 'not_installed'
                            },
                            RunningState: {
                                CANNOT_RUN: 'cannot_run',
                                READY_TO_RUN: 'ready_to_run',
                                RUNNING: 'running'
                            }
                        },
                        runtime: {
                            OnInstalledReason: {
                                CHROME_UPDATE: 'chrome_update',
                                INSTALL: 'install',
                                SHARED_MODULE_UPDATE: 'shared_module_update',
                                UPDATE: 'update'
                            },
                            OnRestartRequiredReason: {
                                APP_UPDATE: 'app_update',
                                OS_UPDATE: 'os_update',
                                PERIODIC: 'periodic'
                            },
                            PlatformArch: {
                                ARM: 'arm',
                                ARM64: 'arm64',
                                MIPS: 'mips',
                                MIPS64: 'mips64',
                                X86_32: 'x86-32',
                                X86_64: 'x86-64'
                            },
                            PlatformNaclArch: {
                                ARM: 'arm',
                                MIPS: 'mips',
                                MIPS64: 'mips64',
                                X86_32: 'x86-32',
                                X86_64: 'x86-64'
                            },
                            PlatformOs: {
                                ANDROID: 'android',
                                CROS: 'cros',
                                LINUX: 'linux',
                                MAC: 'mac',
                                OPENBSD: 'openbsd',
                                WIN: 'win'
                            },
                            RequestUpdateCheckStatus: {
                                NO_UPDATE: 'no_update',
                                THROTTLED: 'throttled',
                                UPDATE_AVAILABLE: 'update_available'
                            }
                        }
                    };
                }
            });
        }
    });
    
    // Protect WebGL fingerprint
    await page.evaluateOnNewDocument(() => {
        // Override getParameter to prevent fingerprinting
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            // Spoof renderer info
            if (parameter === 37445) {
                return 'Intel Inc.';
            }
            if (parameter === 37446) {
                return 'Intel Iris OpenGL Engine';
            }
            
            // Call original method for other parameters
            return getParameter.apply(this, arguments);
        };
    });
    
    // Protect canvas fingerprint
    await page.evaluateOnNewDocument(() => {
        // Override toDataURL to add slight noise
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(type) {
            if (type === 'image/png' && this.width > 16 && this.height > 16) {
                // Get the original image data
                const context = this.getContext('2d');
                const imageData = context.getImageData(0, 0, this.width, this.height);
                const data = imageData.data;
                
                // Add slight noise to the image data
                for (let i = 0; i < data.length; i += 4) {
                    // Only modify a small percentage of pixels
                    if (Math.random() < 0.005) {
                        // Add minor noise to RGB channels
                        data[i] = Math.max(0, Math.min(255, data[i] + (Math.random() * 2 - 1)));
                        data[i+1] = Math.max(0, Math.min(255, data[i+1] + (Math.random() * 2 - 1)));
                        data[i+2] = Math.max(0, Math.min(255, data[i+2] + (Math.random() * 2 - 1)));
                    }
                }
                
                // Put the modified image data back
                context.putImageData(imageData, 0, 0);
            }
            
            // Call original method
            return originalToDataURL.apply(this, arguments);
        };
    });
    
    console.log('Anti-detection measures applied successfully');
}

/**
 * Simulate natural mouse movements
 */
async function simulateNaturalMouseMovements(page) {
    await page.evaluateOnNewDocument(() => {
        // Create a function to generate random mouse movements
        window._simulateMouseMovements = () => {
            // Only run if document is fully loaded
            if (document.readyState !== 'complete') return;
            
            // Generate random coordinates within viewport
            const x = Math.floor(Math.random() * window.innerWidth);
            const y = Math.floor(Math.random() * window.innerHeight);
            
            // Create and dispatch mousemove event
            const event = new MouseEvent('mousemove', {
                view: window,
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y
            });
            
            document.dispatchEvent(event);
        };
        
        // Set interval to simulate random mouse movements
        setInterval(window._simulateMouseMovements, Math.floor(Math.random() * 5000) + 2000);
    });
    
    console.log('Set up natural mouse movement simulation');
}

/**
 * Simulate natural scrolling behavior
 */
async function simulateNaturalScrolling(page) {
    // Function to perform a natural scroll
    const naturalScroll = async () => {
        await page.evaluate(() => {
            // Get page height
            const pageHeight = document.body.scrollHeight;
            const viewportHeight = window.innerHeight;
            
            // Calculate current scroll position
            const currentScroll = window.scrollY;
            
            // Calculate maximum scroll position
            const maxScroll = pageHeight - viewportHeight;
            
            // Don't scroll if already at bottom
            if (currentScroll >= maxScroll) return;
            
            // Calculate random scroll amount (between 100 and 500 pixels)
            const scrollAmount = Math.floor(Math.random() * 400) + 100;
            
            // Calculate new scroll position (don't exceed max)
            const newScroll = Math.min(currentScroll + scrollAmount, maxScroll);
            
            // Perform smooth scroll
            window.scrollTo({
                top: newScroll,
                behavior: 'smooth'
            });
        });
        
        // Wait random time between scrolls
        await page.waitForTimeout(Math.floor(Math.random() * 3000) + 1000);
    };
    
    // Set up interval for natural scrolling
    const scrollInterval = setInterval(async () => {
        try {
            await naturalScroll();
        } catch (error) {
            console.log(`Error during natural scrolling: ${error.message}`);
        }
    }, Math.floor(Math.random() * 10000) + 5000);
    
    // Return function to clear interval
    return () => clearInterval(scrollInterval);
}

/**
 * Perform engagement actions on YouTube video
 */
async function performYouTubeEngagement(page, job, worker, settings) {
    // Only perform engagement if configured
    if (!job.engagement || !job.engagement.enabled) {
        worker.logs.push('Engagement actions disabled, skipping');
        console.log('Engagement actions disabled, skipping');
        return;
    }
    
    // Get video duration
    const videoDuration = await page.evaluate(() => {
        const video = document.querySelector('video');
        return video ? video.duration : 0;
    });
    
    if (!videoDuration) {
        worker.logs.push('Could not determine video duration for engagement timing');
        console.log('Could not determine video duration for engagement timing');
        return;
    }
    
    // Calculate watch time
    const watchTimePercentage = job.video_info.watchTime || settings.watchTimePercentage || 80;
    const watchTimeSeconds = Math.floor(videoDuration * (watchTimePercentage / 100));
    
    // Set up engagement actions with randomized timing
    const engagementActions = [];
    
    // Like action
    if (job.engagement.like) {
        const likePercentage = job.engagement.likeAt || randomIntBetween(20, 50);
        const likeTime = Math.floor(watchTimeSeconds * (likePercentage / 100));
        
        engagementActions.push({
            type: 'like',
            time: likeTime,
            executed: false,
            handler: async () => {
                await likeYouTubeVideo(page, worker);
            }
        });
    }
    
    // Subscribe action
    if (job.engagement.subscribe) {
        const subscribePercentage = job.engagement.subscribeAt || randomIntBetween(60, 90);
        const subscribeTime = Math.floor(watchTimeSeconds * (subscribePercentage / 100));
        
        engagementActions.push({
            type: 'subscribe',
            time: subscribeTime,
            executed: false,
            handler: async () => {
                await subscribeToYouTubeChannel(page, worker);
            }
        });
    }
    
    // Comment action
    if (job.engagement.comment && job.engagement.commentText) {
        const commentPercentage = job.engagement.commentAt || randomIntBetween(70, 95);
        const commentTime = Math.floor(watchTimeSeconds * (commentPercentage / 100));
        
        engagementActions.push({
            type: 'comment',
            time: commentTime,
            executed: false,
            handler: async () => {
                await commentOnYouTubeVideo(page, worker, job.engagement.commentText);
            }
        });
    }
    
    // Set up interval to check and execute engagement actions
    const checkInterval = setInterval(async () => {
        try {
            // Get current video time
            const currentTime = await getCurrentVideoTime(page);
            
            // Check each action
            for (const action of engagementActions) {
                if (!action.executed && currentTime >= action.time) {
                    worker.logs.push(`Executing ${action.type} action at ${Math.round(currentTime)}s`);
                    console.log(`Executing ${action.type} action at ${Math.round(currentTime)}s`);
                    
                    try {
                        await action.handler();
                        action.executed = true;
                    } catch (error) {
                        worker.logs.push(`Error executing ${action.type} action: ${error.message}`);
                        console.log(`Error executing ${action.type} action: ${error.message}`);
                    }
                }
            }
            
            // Check if all actions are executed
            const allExecuted = engagementActions.every(action => action.executed);
            if (allExecuted) {
                clearInterval(checkInterval);
                worker.logs.push('All engagement actions completed');
                console.log('All engagement actions completed');
            }
        } catch (error) {
            worker.logs.push(`Error checking engagement actions: ${error.message}`);
            console.log(`Error checking engagement actions: ${error.message}`);
        }
    }, 2000);
    
    // Return function to clear interval
    return () => clearInterval(checkInterval);
}

/**
 * Like a YouTube video
 */
async function likeYouTubeVideo(page, worker) {
    try {
        // Wait for random time to simulate natural behavior
        await page.waitForTimeout(randomIntBetween(500, 2000));
        
        // Find and click like button using multiple methods
        const likeButtonFound = await page.evaluate(() => {
            // Try multiple selectors to find the like button
            const selectors = [
                'button[aria-label*="like" i]:not([aria-label*="dislike" i])',
                'ytd-toggle-button-renderer:not([is-icon-button]) button',
                '#top-level-buttons-computed > ytd-toggle-button-renderer:first-child button',
                '#segmented-like-button button'
            ];
            
            for (const selector of selectors) {
                const button = document.querySelector(selector);
                if (button) {
                    button.click();
                    return true;
                }
            }
            
            // Look for buttons with like icon or text
            const buttons = Array.from(document.querySelectorAll('button'));
            
            // Find button with like text or aria-label
            for (const button of buttons) {
                const text = button.textContent.toLowerCase();
                const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
                
                if ((text.includes('like') && !text.includes('dislike')) || 
                    (ariaLabel.includes('like') && !ariaLabel.includes('dislike'))) {
                    button.click();
                    return true;
                }
            }
            
            return false;
        });
        
        if (likeButtonFound) {
            worker.logs.push('Liked YouTube video');
            console.log('Liked YouTube video');
            return true;
        } else {
            worker.logs.push('Could not find YouTube like button');
            console.log('Could not find YouTube like button');
            return false;
        }
    } catch (error) {
        worker.logs.push(`Error liking YouTube video: ${error.message}`);
        console.log(`Error liking YouTube video: ${error.message}`);
        return false;
    }
}

/**
 * Subscribe to YouTube channel
 */
async function subscribeToYouTubeChannel(page, worker) {
    try {
        // Wait for random time to simulate natural behavior
        await page.waitForTimeout(randomIntBetween(1000, 3000));
        
        // Find and click subscribe button using multiple methods
        const subscribeButtonFound = await page.evaluate(() => {
            // Try multiple selectors to find the subscribe button
            const selectors = [
                '#subscribe-button button',
                'button[aria-label*="subscribe" i]',
                'ytd-subscribe-button-renderer button',
                '#meta-contents ytd-subscribe-button-renderer button'
            ];
            
            for (const selector of selectors) {
                const button = document.querySelector(selector);
                if (button) {
                    // Check if already subscribed
                    const text = button.textContent.toLowerCase();
                    const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
                    
                    if (text.includes('subscribed') || 
                        text.includes('unsubscribe') || 
                        ariaLabel.includes('subscribed') || 
                        ariaLabel.includes('unsubscribe')) {
                        return 'already-subscribed';
                    }
                    
                    button.click();
                    return 'subscribed';
                }
            }
            
            return 'not-found';
        });
        
        if (subscribeButtonFound === 'subscribed') {
            worker.logs.push('Subscribed to YouTube channel');
            console.log('Subscribed to YouTube channel');
            return true;
        } else if (subscribeButtonFound === 'already-subscribed') {
            worker.logs.push('Already subscribed to channel');
            console.log('Already subscribed to channel');
            return true;
        } else {
            worker.logs.push('Could not find YouTube subscribe button');
            console.log('Could not find YouTube subscribe button');
            return false;
        }
    } catch (error) {
        worker.logs.push(`Error subscribing to YouTube channel: ${error.message}`);
        console.log(`Error subscribing to YouTube channel: ${error.message}`);
        return false;
    }
}

/**
 * Comment on YouTube video
 */
async function commentOnYouTubeVideo(page, worker, commentText) {
    try {
        // Wait for random time to simulate natural behavior
        await page.waitForTimeout(randomIntBetween(2000, 5000));
        
        // Scroll to comments section
        await page.evaluate(() => {
            // Find comments section
            const commentsSection = document.querySelector('#comments');
            if (commentsSection) {
                commentsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
        
        // Wait for comments to load
        await page.waitForTimeout(randomIntBetween(1000, 3000));
        
        // Find and interact with comment input
        const commentSuccess = await page.evaluate(async (text) => {
            // Try multiple selectors to find the comment input
            const selectors = [
                '#simplebox-placeholder',
                '#commentbox #contenteditable-root',
                'ytd-comment-simplebox-renderer #simplebox-placeholder',
                'ytd-comment-simplebox-renderer #contenteditable-root'
            ];
            
            let commentInput = null;
            
            for (const selector of selectors) {
                const input = document.querySelector(selector);
                if (input) {
                    commentInput = input;
                    break;
                }
            }
            
            if (!commentInput) {
                return false;
            }
            
            // Click on comment input to focus
            commentInput.click();
            
            // Wait for comment box to fully appear
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Find the editable area
            const editableArea = document.querySelector('[contenteditable="true"]');
            if (!editableArea) {
                return false;
            }
            
            // Set text content
            editableArea.textContent = text;
            
            // Trigger input event
            editableArea.dispatchEvent(new Event('input', { bubbles: true }));
            
            // Wait before submitting
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Find and click submit button
            const submitButton = document.querySelector('#submit-button button');
            if (submitButton) {
                submitButton.click();
                return true;
            }
            
            return false;
        }, commentText);
        
        if (commentSuccess) {
            worker.logs.push('Posted comment on YouTube video');
            console.log('Posted comment on YouTube video');
            return true;
        } else {
            worker.logs.push('Could not post comment on YouTube video');
            console.log('Could not post comment on YouTube video');
            return false;
        }
    } catch (error) {
        worker.logs.push(`Error commenting on YouTube video: ${error.message}`);
        console.log(`Error commenting on YouTube video: ${error.message}`);
        return false;
    }
}

/**
 * Perform engagement actions on Rumble video
 */
async function performRumbleEngagement(page, job, worker, settings) {
    // Only perform engagement if configured
    if (!job.engagement || !job.engagement.enabled) {
        worker.logs.push('Engagement actions disabled for Rumble, skipping');
        console.log('Engagement actions disabled for Rumble, skipping');
        return;
    }
    
    // Get video duration
    const videoDuration = await page.evaluate(() => {
        const video = document.querySelector('video');
        return video ? video.duration : 0;
    });
    
    if (!videoDuration) {
        worker.logs.push('Could not determine Rumble video duration for engagement timing');
        console.log('Could not determine Rumble video duration for engagement timing');
        return;
    }
    
    // Calculate watch time
    const watchTimePercentage = job.video_info.watchTime || settings.watchTimePercentage || 80;
    const watchTimeSeconds = Math.floor(videoDuration * (watchTimePercentage / 100));
    
    // Set up engagement actions with randomized timing
    const engagementActions = [];
    
    // Like action
    if (job.engagement.like) {
        const likePercentage = job.engagement.likeAt || randomIntBetween(20, 50);
        const likeTime = Math.floor(watchTimeSeconds * (likePercentage / 100));
        
        engagementActions.push({
            type: 'like',
            time: likeTime,
            executed: false,
            handler: async () => {
                await likeRumbleVideo(page, worker);
            }
        });
    }
    
    // Subscribe action
    if (job.engagement.subscribe) {
        const subscribePercentage = job.engagement.subscribeAt || randomIntBetween(60, 90);
        const subscribeTime = Math.floor(watchTimeSeconds * (subscribePercentage / 100));
        
        engagementActions.push({
            type: 'subscribe',
            time: subscribeTime,
            executed: false,
            handler: async () => {
                await subscribeToRumbleChannel(page, worker);
            }
        });
    }
    
    // Comment action
    if (job.engagement.comment && job.engagement.commentText) {
        const commentPercentage = job.engagement.commentAt || randomIntBetween(70, 95);
        const commentTime = Math.floor(watchTimeSeconds * (commentPercentage / 100));
        
        engagementActions.push({
            type: 'comment',
            time: commentTime,
            executed: false,
            handler: async () => {
                await commentOnRumbleVideo(page, worker, job.engagement.commentText);
            }
        });
    }
    
    // Set up interval to check and execute engagement actions
    const checkInterval = setInterval(async () => {
        try {
            // Get current video time
            const currentTime = await getCurrentVideoTime(page);
            
            // Check each action
            for (const action of engagementActions) {
                if (!action.executed && currentTime >= action.time) {
                    worker.logs.push(`Executing Rumble ${action.type} action at ${Math.round(currentTime)}s`);
                    console.log(`Executing Rumble ${action.type} action at ${Math.round(currentTime)}s`);
                    
                    try {
                        await action.handler();
                        action.executed = true;
                    } catch (error) {
                        worker.logs.push(`Error executing Rumble ${action.type} action: ${error.message}`);
                        console.log(`Error executing Rumble ${action.type} action: ${error.message}`);
                    }
                }
            }
            
            // Check if all actions are executed
            const allExecuted = engagementActions.every(action => action.executed);
            if (allExecuted) {
                clearInterval(checkInterval);
                worker.logs.push('All Rumble engagement actions completed');
                console.log('All Rumble engagement actions completed');
            }
        } catch (error) {
            worker.logs.push(`Error checking Rumble engagement actions: ${error.message}`);
            console.log(`Error checking Rumble engagement actions: ${error.message}`);
        }
    }, 2000);
    
    // Return function to clear interval
    return () => clearInterval(checkInterval);
}

/**
 * Like a Rumble video
 */
async function likeRumbleVideo(page, worker) {
    try {
        // Wait for random time to simulate natural behavior
        await page.waitForTimeout(randomIntBetween(500, 2000));
        
        // Find and click like button (Rumble uses .rumbles-vote)
        const likeButtonFound = await page.evaluate(() => {
            const likeButton = document.querySelector('.rumbles-vote');
            if (likeButton) {
                likeButton.click();
                return true;
            }
            return false;
        });
        
        if (likeButtonFound) {
            worker.logs.push('Liked Rumble video');
            console.log('Liked Rumble video');
            return true;
        } else {
            worker.logs.push('Could not find Rumble like button');
            console.log('Could not find Rumble like button');
            return false;
        }
    } catch (error) {
        worker.logs.push(`Error liking Rumble video: ${error.message}`);
        console.log(`Error liking Rumble video: ${error.message}`);
        return false;
    }
}

/**
 * Subscribe to Rumble channel
 */
async function subscribeToRumbleChannel(page, worker) {
    try {
        // Wait for random time to simulate natural behavior
        await page.waitForTimeout(randomIntBetween(1000, 3000));
        
        // Find and click subscribe button
        const subscribeResult = await page.evaluate(() => {
            const subscribeButton = document.querySelector('.subscribe-button');
            if (subscribeButton) {
                // Check if already subscribed
                if (subscribeButton.classList.contains('subscribed')) {
                    return 'already-subscribed';
                }
                
                subscribeButton.click();
                return 'subscribed';
            }
            return 'not-found';
        });
        
        if (subscribeResult === 'subscribed') {
            worker.logs.push('Subscribed to Rumble channel');
            console.log('Subscribed to Rumble channel');
            return true;
        } else if (subscribeResult === 'already-subscribed') {
            worker.logs.push('Already subscribed to Rumble channel');
            console.log('Already subscribed to Rumble channel');
            return true;
        } else {
            worker.logs.push('Could not find Rumble subscribe button');
            console.log('Could not find Rumble subscribe button');
            return false;
        }
    } catch (error) {
        worker.logs.push(`Error subscribing to Rumble channel: ${error.message}`);
        console.log(`Error subscribing to Rumble channel: ${error.message}`);
        return false;
    }
}

/**
 * Comment on Rumble video
 */
async function commentOnRumbleVideo(page, worker, commentText) {
    try {
        // Wait for random time to simulate natural behavior
        await page.waitForTimeout(randomIntBetween(2000, 5000));
        
        // Scroll to comments section
        await page.evaluate(() => {
            // Find comments section
            const commentsSection = document.querySelector('.comments-section');
            if (commentsSection) {
                commentsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
        
        // Wait for comments to load
        await page.waitForTimeout(randomIntBetween(1000, 3000));
        
        // Find comment input and submit
        const commentSuccess = await page.evaluate(async (text) => {
            const commentInput = document.querySelector('.comment-box textarea');
            if (!commentInput) {
                return false;
            }
            
            // Click on comment input to focus
            commentInput.click();
            
            // Wait for comment box to fully appear
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Set value and trigger input event
            commentInput.value = text;
            commentInput.dispatchEvent(new Event('input', { bubbles: true }));
            
            // Wait before submitting
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Find and click submit button
            const submitButton = document.querySelector('.comment-box button[type="submit"]');
            if (submitButton) {
                submitButton.click();
                return true;
            }
            
            return false;
        }, commentText);
        
        if (commentSuccess) {
            worker.logs.push('Posted comment on Rumble video');
            console.log('Posted comment on Rumble video');
            return true;
        } else {
            worker.logs.push('Could not post comment on Rumble video');
            console.log('Could not post comment on Rumble video');
            return false;
        }
    } catch (error) {
        worker.logs.push(`Error commenting on Rumble video: ${error.message}`);
        console.log(`Error commenting on Rumble video: ${error.message}`);
        return false;
    }
}

/**
 * Test proxies to ensure they're working
 */
async function testProxies(proxyConfiguration, proxyState, settings) {
    if (!proxyConfiguration) {
        console.log('No proxy configuration to test');
        return;
    }
    
    // Number of proxies to test
    const testCount = settings.proxyTestCount || 1;
    
    console.log(`Testing ${testCount} proxies...`);
    
    // Generate test proxies
    const proxyUrls = [];
    try {
        for (let i = 0; i < testCount; i++) {
            const proxyUrl = await proxyConfiguration.newUrl();
            proxyUrls.push(proxyUrl);
        }
    } catch (error) {
        console.error(`Error generating proxy URLs: ${error.message}`);
        return [];
    }
    
    // Update state
    proxyState.proxyTestResults.total = proxyUrls.length;
    
    // Test each proxy
    const testResults = await Promise.all(proxyUrls.map(async (proxyUrl, index) => {
        console.log(`Testing proxy ${index + 1}/${proxyUrls.length}: ${proxyUrl}`);
        
        try {
            // Create proxy agent
            const proxyAgent = new ProxyAgent({
                proxyUrl: proxyUrl
            });
            
            const startTime = Date.now();
            
            // Test connection to YouTube
            const response = await fetch('https://www.youtube.com', {
                agent: proxyAgent,
                timeout: 30000
            });
            
            // Check if response is OK
            const isWorking = response.status >= 200 && response.status < 300;
            
            if (isWorking) {
                console.log(`Proxy ${index + 1}/${proxyUrls.length} is working: ${proxyUrl}`);
                proxyState.proxyTestResults.working++;
                
                // Record initial performance metrics
                proxyState.proxyPerformance.set(proxyUrl, {
                    successCount: 1,
                    failureCount: 0,
                    lastResponseTime: Date.now() - startTime,
                    lastUsed: Date.now()
                });
                
                return { proxyUrl, isWorking: true };
            } else {
                console.log(`Proxy ${index + 1}/${proxyUrls.length} failed with status ${response.status}: ${proxyUrl}`);
                proxyState.proxyTestResults.failed++;
                return { proxyUrl, isWorking: false };
            }
        } catch (error) {
            console.log(`Proxy ${index + 1}/${proxyUrls.length} failed with error: ${error.message}`);
            proxyState.proxyTestResults.failed++;
            return { proxyUrl, isWorking: false, error: error.message };
        }
    }));
    
    // Log test results
    console.log(`Proxy testing complete. Good: ${proxyState.proxyTestResults.working}, Bad: ${proxyState.proxyTestResults.failed}`);
    
    // Store working proxies for future use
    const workingProxies = testResults.filter(result => result.isWorking).map(result => result.proxyUrl);
    
    // If we have working proxies, use them
    if (workingProxies.length > 0) {
        // Store working proxies for rotation
        workingProxies.forEach(proxyUrl => {
            if (!proxyState.proxyPerformance.has(proxyUrl)) {
                proxyState.proxyPerformance.set(proxyUrl, {
                    successCount: 1,
                    failureCount: 0,
                    lastResponseTime: 0,
                    lastUsed: Date.now()
                });
            }
        });
    }
    
    return workingProxies;
}

/**
 * Get a proxy URL for a specific video
 */
async function getProxyForVideo(proxyConfiguration, proxyState, videoId, settings) {
    if (!proxyConfiguration || !settings.useProxies) {
        console.log(`No proxy will be used for video ${videoId}`);
        return null;
    }
    
    // Check if we already have a proxy assigned to this video
    if (proxyState.usedProxies.has(videoId)) {
        const existingProxy = proxyState.usedProxies.get(videoId);
        console.log(`Reusing existing proxy for video ${videoId}: ${existingProxy}`);
        return existingProxy;
    }
    
    // Get a new proxy URL with session ID based on video ID for consistency
    const sessionId = `video-${videoId}`;
    const proxyUrl = await proxyConfiguration.newUrl(sessionId);
    
    // Store the proxy URL for this video
    proxyState.usedProxies.set(videoId, proxyUrl);
    proxyState.currentProxyUrl = proxyUrl;
    
    // Initialize performance metrics if not exists
    if (!proxyState.proxyPerformance.has(proxyUrl)) {
        proxyState.proxyPerformance.set(proxyUrl, {
            successCount: 0,
            failureCount: 0,
            lastResponseTime: 0,
            lastUsed: Date.now()
        });
    }
    
    console.log(`Assigned new proxy for video ${videoId}: ${proxyUrl}`);
    
    return proxyUrl;
}

/**
 * Record proxy performance metrics
 */
function recordProxyPerformance(proxyState, proxyUrl, metrics) {
    if (!proxyUrl || !proxyState.proxyPerformance.has(proxyUrl)) {
        return;
    }
    
    const currentMetrics = proxyState.proxyPerformance.get(proxyUrl);
    
    // Update metrics
    const updatedMetrics = {
        successCount: currentMetrics.successCount + (metrics.success ? 1 : 0),
        failureCount: currentMetrics.failureCount + (metrics.success ? 0 : 1),
        lastResponseTime: metrics.responseTime || currentMetrics.lastResponseTime,
        lastUsed: Date.now(),
        errors: currentMetrics.errors || []
    };
    
    // Add error if present
    if (metrics.error) {
        updatedMetrics.errors = updatedMetrics.errors || [];
        updatedMetrics.errors.push({
            timestamp: Date.now(),
            message: metrics.error
        });
        
        // Keep only last 5 errors
        if (updatedMetrics.errors.length > 5) {
            updatedMetrics.errors = updatedMetrics.errors.slice(-5);
        }
    }
    
    // Update metrics in state
    proxyState.proxyPerformance.set(proxyUrl, updatedMetrics);
}

/**
 * Track job start
 */
function trackJobStart(state, job) {
    try {
        // Create job tracking object
        const jobTracking = {
            id: job.id,
            videoId: job.videoId,
            platform: job.platform,
            startTime: Date.now(),
            status: 'running',
            progress: 0
        };
        
        // Add to current jobs
        state.currentJobs.push(jobTracking);
        
        // Log job start
        console.log(`Started job ${jobTracking.id} for ${jobTracking.platform} video ${jobTracking.videoId}`);
        
        return jobTracking;
    } catch (error) {
        console.log(`Error tracking job start: ${error.message}`);
    }
}

/**
 * Track job progress
 */
function trackJobProgress(state, job, progress) {
    try {
        // Find job in current jobs
        const jobIndex = state.currentJobs.findIndex(j => j.id === job.id);
        
        if (jobIndex >= 0) {
            // Update job progress
            state.currentJobs[jobIndex] = {
                ...state.currentJobs[jobIndex],
                ...progress,
                lastUpdateTime: Date.now()
            };
            
            // Log progress update
            if (progress.progress !== undefined) {
                console.log(`Job ${job.id} progress: ${progress.progress}%`);
            }
            
            return state.currentJobs[jobIndex];
        }
    } catch (error) {
        console.log(`Error tracking job progress: ${error.message}`);
    }
}

/**
 * Track job completion
 */
function trackJobCompletion(state, job, result) {
    try {
        // Find job in current jobs
        const jobIndex = state.currentJobs.findIndex(j => j.id === job.id);
        
        if (jobIndex >= 0) {
            const completedJob = {
                ...state.currentJobs[jobIndex],
                status: 'completed',
                progress: 100,
                completionTime: Date.now(),
                result: result,
                watchTime: result?.watchTime || state.currentJobs[jobIndex].watchTime
            };
            
            // Remove from current jobs
            state.currentJobs.splice(jobIndex, 1);
            
            // Add to job history
            state.jobHistory.push(completedJob);
            
            // Keep job history limited to last 100 jobs
            if (state.jobHistory.length > 100) {
                state.jobHistory = state.jobHistory.slice(-100);
            }
            
            // Increment completed jobs
            state.completedJobs++;
            
            // Log job completion
            console.log(`Completed job ${job.id} for video ${completedJob.videoId}`);
            
            return completedJob;
        }
    } catch (error) {
        console.log(`Error tracking job completion: ${error.message}`);
    }
}

/**
 * Track job failure
 */
function trackJobFailure(state, job, error) {
    try {
        // Find job in current jobs
        const jobIndex = state.currentJobs.findIndex(j => j.id === job.id);
        
        if (jobIndex >= 0) {
            const failedJob = {
                ...state.currentJobs[jobIndex],
                status: 'failed',
                failureTime: Date.now(),
                error: error?.message || error || 'Unknown error'
            };
            
            // Remove from current jobs
            state.currentJobs.splice(jobIndex, 1);
            
            // Add to job history
            state.jobHistory.push(failedJob);
            
            // Keep job history limited to last 100 jobs
            if (state.jobHistory.length > 100) {
                state.jobHistory = state.jobHistory.slice(-100);
            }
            
            // Increment failed jobs
            state.failedJobs++;
            
            // Log job failure
            console.log(`Failed job ${job.id} for video ${failedJob.videoId}: ${failedJob.error}`);
            
            return failedJob;
        }
    } catch (error) {
        console.log(`Error tracking job failure: ${error.message}`);
    }
}

/**
 * Update progress data in Apify key-value store
 */
async function updateProgressData(state, store) {
    try {
        // Calculate overall progress percentage
        const totalJobs = state.totalJobs || 1; // Avoid division by zero
        const progressPercentage = Math.round((state.completedJobs / totalJobs) * 100);
        
        // Calculate runtime
        const runtime = Math.round((Date.now() - state.startTime) / 1000);
        
        // Create progress summary
        const progressSummary = {
            status: state.totalJobs === state.completedJobs + state.failedJobs ? 'completed' : 'running',
            startTime: new Date(state.startTime).toISOString(),
            runtime: formatTime(runtime),
            progress: {
                percentage: progressPercentage,
                completed: state.completedJobs,
                failed: state.failedJobs,
                total: state.totalJobs
            },
            currentJobs: state.currentJobs.map(job => ({
                id: job.id,
                videoId: job.videoId,
                platform: job.platform,
                startTime: new Date(job.startTime).toISOString(),
                runtime: formatTime(Math.round((Date.now() - job.startTime) / 1000)),
                progress: job.progress || 0,
                status: job.status || 'initializing'
            })),
            recentCompletedJobs: state.jobHistory
                .filter(job => job.status === 'completed')
                .slice(-5)
                .map(job => ({
                    id: job.id,
                    videoId: job.videoId,
                    platform: job.platform,
                    watchTime: job.watchTime,
                    completionTime: new Date(job.completionTime).toISOString()
                })),
            recentFailedJobs: state.jobHistory
                .filter(job => job.status === 'failed')
                .slice(-5)
                .map(job => ({
                    id: job.id,
                    videoId: job.videoId,
                    platform: job.platform,
                    error: job.error,
                    failureTime: new Date(job.failureTime).toISOString()
                }))
        };
        
        // Save progress summary to key-value store
        await store.setValue('progress-summary', progressSummary);
        
        // Save state
        await Apify.setValue('STATE', state);
        
        // Update last update time
        state.lastUpdateTime = Date.now();
        
        // Log progress to console
        console.log(`Progress: ${progressPercentage}% (${state.completedJobs}/${state.totalJobs} completed, ${state.failedJobs} failed)`);
        
        // Push data to default dataset for real-time monitoring
        await Apify.pushData({
            type: 'progress-update',
            timestamp: new Date().toISOString(),
            summary: progressSummary
        });
        
        return progressSummary;
    } catch (error) {
        console.log(`Error updating progress data: ${error.message}`);
    }
}

/**
 * Format time in seconds to human-readable format
 */
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Extract video ID from URL
 */
function extractVideoId(url) {
    try {
        if (url.includes('youtube.com')) {
            // YouTube URL
            const urlObj = new URL(url);
            return urlObj.searchParams.get('v');
        } else if (url.includes('youtu.be')) {
            // YouTube short URL
            const urlObj = new URL(url);
            return urlObj.pathname.substring(1);
        } else if (url.includes('rumble.com')) {
            // Rumble URL
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/');
            return pathParts[pathParts.length - 1];
        }
    } catch (error) {
        console.log(`Error extracting video ID from URL ${url}: ${error.message}`);
    }
    
    return null;
}

/**
 * Generate random integer between min and max (inclusive)
 */
function randomIntBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get random user agent
 */
function getRandomUserAgent() {
    // List of realistic user agents (Chrome, Firefox, Edge)
    const userAgents = [
        // Chrome on Windows
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
        
        // Chrome on macOS
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36',
        
        // Firefox on Windows
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/112.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/111.0',
        
        // Firefox on macOS
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/112.0',
        
        // Edge on Windows
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36 Edg/112.0.1722.48',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36 Edg/111.0.1661.62'
    ];
    
    // Select random user agent
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

