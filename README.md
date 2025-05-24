# YouTube & Rumble View Bot - Apify Actor

This document provides comprehensive documentation for the YouTube & Rumble View Bot Apify actor, which has been adapted from the original software to run on the Apify platform with full residential proxy support and country selection capabilities.

## Overview

This Apify actor allows you to boost views on YouTube and Rumble videos using residential proxies with country selection. All premium features from the original software are enabled by default without any restrictions, API keys, or login requirements.

## Features

- **Multi-Platform Support**: Works with both YouTube and Rumble videos
- **Residential Proxy Integration**: Full support for Apify's residential proxies with country selection
- **Custom Proxy Support**: Use your own proxies in addition to Apify's proxy service
- **Configurable Watch Time**: Set the percentage of each video to watch
- **Concurrent Operation**: Run multiple browser instances simultaneously
- **Ad Handling**: Automatically skip ads after configurable time periods
- **System Resource Management**: Option to prevent overloading your system
- **Premium Features**: All premium features enabled by default (no restrictions)
- **Detailed Logging**: Comprehensive logs for monitoring and troubleshooting

## Input Configuration

The actor accepts the following input parameters:

### Video Settings
- **videoUrls**: List of YouTube or Rumble video URLs to view
- **watchTimePercentage**: Percentage of the video to watch (30-100%, default: 80%)

### Proxy Settings
- **useProxies**: Whether to use proxies for viewing videos (default: true)
- **proxyUrls**: Optional list of custom proxy URLs (in addition to Apify Proxy)
- **proxyCountry**: Country code for Apify residential proxies (e.g., US, GB, DE)
- **proxyGroups**: Apify proxy groups to use (default: ["RESIDENTIAL"])

### Browser Settings
- **headless**: Run browsers in headless mode (default: true)
- **concurrency**: Number of concurrent browser instances (default: 5)
- **concurrencyInterval**: Interval in seconds between starting new browser instances (default: 5)
- **timeout**: Page load timeout in seconds (default: 120)

### Ad Settings
- **maxSecondsAds**: Maximum seconds to wait for ads (default: 15)
- **skipAdsAfter**: Skip ads after these many seconds (default: [5, 10])
- **autoSkipAds**: Automatically skip ads when possible (default: true)

### System Settings
- **stopSpawningOnOverload**: Stop spawning new instances if system is overloaded (default: true)
- **disableProxyTests**: Skip testing proxies before using them (default: false)
- **useAV1**: Use AV1 video codec when available (default: true)

## Usage Examples

### Basic Usage

```json
{
  "videoUrls": [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://rumble.com/v2j3hyu-example-video.html"
  ],
  "watchTimePercentage": 80,
  "concurrency": 5
}
```

### With Country-Specific Proxies

```json
{
  "videoUrls": [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  ],
  "watchTimePercentage": 90,
  "proxyCountry": "US",
  "concurrency": 10,
  "concurrencyInterval": 3
}
```

### With Custom Proxies

```json
{
  "videoUrls": [
    "https://rumble.com/v2j3hyu-example-video.html"
  ],
  "proxyUrls": [
    "http://username:password@proxy.example.com:8080",
    "socks5://proxy2.example.com:1080"
  ],
  "disableProxyTests": false
}
```

## Results

The actor saves results to the default key-value store with the key "RESULTS". The results include:

- Number of completed jobs
- List of processed videos
- Worker statistics and logs

## Technical Implementation

The actor is built using:

- **Apify SDK**: For actor lifecycle management and proxy integration
- **Playwright**: For browser automation and video interaction
- **Proxy Chain**: For proxy handling and anonymization
- **System Information**: For monitoring system resources

All premium features from the original software are enabled by default, with no API key or login requirements.

## Deployment Instructions

To deploy this actor to your Apify account:

1. Create a new actor in your Apify Console
2. Upload all files from this package
3. Build the actor
4. Configure your input and run the actor

## Limitations and Considerations

- Performance depends on available system resources and proxy quality
- Some websites may implement additional bot detection measures
- Using too many concurrent instances may trigger IP-based rate limiting
- Video playback quality depends on network conditions and proxy speed

## Troubleshooting

- If proxies fail testing, try different proxy sources or countries
- If videos don't load, increase the timeout setting
- If system performance degrades, reduce concurrency
- Check logs for specific error messages and browser issues
