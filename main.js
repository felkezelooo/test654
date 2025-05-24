const Apify = require('apify');
const { chromium } = require('playwright');
const to = require('await-to-js').default;
const { v4: uuidv4 } = require('uuid');
const ProxyAgent = require('proxy-chain').ProxyAgent;

// Log that the script has started
console.log('Starting YouTube & Rumble View Bot Actor - Crawlee Compatible Version');

// Self-invoking async function that runs immediately
(async () => {
    try {
        console.log('Self-invoking function started');
        
        // Get input using Crawlee/Apify SDK v3 methods
        console.log('Attempting to get input using Apify SDK v3 methods...');
        let input;
        
        try {
            // Try to get input from Apify.Actor (Crawlee)
            if (Apify.Actor && typeof Apify.Actor.getInput === 'function') {
                console.log('Using Apify.Actor.getInput()');
                input = await Apify.Actor.getInput();
                console.log('Raw input received from Apify.Actor.getInput():', JSON.stringify(input, null, 2));
            } 
            // Try to get input from Apify.main (legacy)
            else if (Apify.getInput && typeof Apify.getInput === 'function') {
                console.log('Using Apify.getInput()');
                input = await Apify.getInput();
                console.log('Raw input received from Apify.getInput():', JSON.stringify(input, null, 2));
            }
            // Try to get input from environment
            else {
                console.log('No standard input methods found, trying environment variables');
                throw new Error('Standard input methods not available');
            }
        } catch (error) {
            console.error('Error getting input with standard methods:', error.message);
            input = null;
        }
        
        // If input is null, try alternative methods
        if (!input) {
            console.log('Input is null, trying alternative methods...');
            
            try {
                // Try getting input from environment variable
                const envInput = process.env.APIFY_INPUT;
                if (envInput) {
                    console.log('Found input in APIFY_INPUT environment variable');
                    try {
                        input = JSON.parse(envInput);
                        console.log('Parsed input from environment:', JSON.stringify(input, null, 2));
                    } catch (parseError) {
                        console.error('Error parsing input from environment:', parseError);
                    }
                } else {
                    console.log('APIFY_INPUT environment variable not found or empty');
                }
            } catch (envError) {
                console.error('Error accessing environment variables:', envError);
            }
        }
        
        // Log input status
        if (!input) {
            console.log('No input could be retrieved by any method');
            
            // Create default test input
            console.log('Creating default test input for debugging');
            input = {
                videoUrls: ['https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
                watchTimePercentage: 80,
                useProxies: false,
                enableEngagement: false,
                concurrency: 1
            };
            console.log('Using default test input:', JSON.stringify(input, null, 2));
        }
        
        // Validate input - ensure we have at least one video URL
        if (!input.videoUrls || !Array.isArray(input.videoUrls) || input.videoUrls.length === 0) {
            console.error('No video URLs provided in input. Please provide at least one video URL to watch.');
            console.log('Input validation failed: No video URLs found');
            
            // Push error data using compatible method
            await pushDataCompatible({
                status: 'error',
                message: 'No video URLs provided in input. Please provide at least one video URL to watch.'
            });
            
            console.log('Error data pushed, exiting actor');
            return; // Exit early with error message
        }
        
        console.log(`Found ${input.videoUrls.length} video URLs to process:`, input.videoUrls);
        
        // Log other input parameters
        console.log('Watch time percentage:', input.watchTimePercentage || 80);
        console.log('Use proxies:', input.useProxies || false);
        console.log('Enable engagement:', input.enableEngagement || false);
        console.log('Concurrency:', input.concurrency || 1);
        
        // Initialize state for progress tracking
        const state = {
            startTime: Date.now(),
            totalJobs: input.videoUrls.length,
            completedJobs: 0,
            failedJobs: 0,
            currentJobs: [],
            jobHistory: [],
            lastUpdateTime: Date.now()
        };
        
        console.log('State initialized');
        
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
        
        // Push success data to confirm actor is working
        console.log('Pushing success data to confirm actor is working');
        await pushDataCompatible({
            status: 'success',
            message: 'Input successfully retrieved and validated',
            videoCount: input.videoUrls.length,
            videos: input.videoUrls,
            jobs: jobs.map(job => ({
                id: job.id,
                videoId: job.videoId,
                platform: job.platform
            }))
        });
        
        console.log('Actor execution completed successfully');
        
    } catch (error) {
        console.error('Unhandled error in actor main function:', error);
        
        // Report error using compatible method
        try {
            await pushDataCompatible({
                status: 'error',
                error: error.message,
                stack: error.stack
            });
        } catch (pushError) {
            console.error('Error pushing data:', pushError);
        }
        
        console.log('Error data pushed, exiting actor due to unhandled error');
    }
})();

/**
 * Push data using whatever method is available in the current Apify SDK
 */
async function pushDataCompatible(data) {
    try {
        console.log('Attempting to push data:', JSON.stringify(data, null, 2));
        
        // Try Apify.Actor.pushData (Crawlee)
        if (Apify.Actor && typeof Apify.Actor.pushData === 'function') {
            console.log('Using Apify.Actor.pushData()');
            await Apify.Actor.pushData(data);
            return true;
        }
        // Try Apify.pushData (legacy)
        else if (Apify.pushData && typeof Apify.pushData === 'function') {
            console.log('Using Apify.pushData()');
            await Apify.pushData(data);
            return true;
        }
        // Try Dataset.pushData
        else if (Apify.Dataset && typeof Apify.Dataset.pushData === 'function') {
            console.log('Using Apify.Dataset.pushData()');
            await Apify.Dataset.pushData(data);
            return true;
        }
        // Fallback to console output
        else {
            console.log('No push data method available, logging to console instead');
            console.log('DATA OUTPUT:', JSON.stringify(data, null, 2));
            return false;
        }
    } catch (error) {
        console.error('Error in pushDataCompatible:', error);
        console.log('Fallback: logging data to console');
        console.log('DATA OUTPUT:', JSON.stringify(data, null, 2));
        return false;
    }
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

// Also export as module.exports for compatibility
module.exports = async () => {
    console.log('Module exports function called - this is a fallback and should not be the primary execution path');
};

// Log that the script has been loaded
console.log('Crawlee compatible script loaded and ready to execute');
