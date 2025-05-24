const Apify = require('apify');

// Simple test script that only focuses on input retrieval and logging
console.log('Starting YouTube & Rumble View Bot Actor - Input Test Version');

// Replace Apify.main with module.exports for compatibility with all Apify SDK versions
module.exports = async () => {
    try {
        console.log('Actor main function started');
        
        // Try different methods to get input
        console.log('Attempting to get input using Apify.getInput()...');
        let input;
        try {
            input = await Apify.getInput();
            console.log('Raw input received:', JSON.stringify(input, null, 2));
        } catch (error) {
            console.error('Error getting input with Apify.getInput():', error);
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
            
            // Push error data
            await Apify.pushData({
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
        
        // Push success data to confirm actor is working
        console.log('Pushing success data to confirm actor is working');
        await Apify.pushData({
            status: 'success',
            message: 'Input successfully retrieved and validated',
            videoCount: input.videoUrls.length,
            videos: input.videoUrls
        });
        
        console.log('Actor execution completed successfully');
        
    } catch (error) {
        console.error('Unhandled error in actor main function:', error);
        
        // Report error to Apify
        await Apify.pushData({
            status: 'error',
            error: error.message,
            stack: error.stack
        });
        
        console.log('Error data pushed, exiting actor due to unhandled error');
    }
};

// Log that the script has been loaded and is ready to execute
console.log('Input test script loaded and ready to execute');
