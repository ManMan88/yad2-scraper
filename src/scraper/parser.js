const cheerio = require('cheerio');

/**
 * Parse Yad2 HTML and extract image URLs as item identifiers
 * @param {string} html - Raw HTML from Yad2
 * @returns {string[]} Array of image URLs
 * @throws {Error} If bot detection is triggered or parsing fails
 */
function parseYad2Html(html) {
    if (!html) {
        throw new Error('Empty HTML received');
    }

    const $ = cheerio.load(html);

    // Check for bot detection
    const title = $('title').first().text();
    if (title === 'ShieldSquare Captcha') {
        throw new Error('Bot detection triggered - ShieldSquare Captcha');
    }

    const imageUrls = [];

    // Strategy 1: New Yad2 structure (2024+) - feedItemBox containers
    const $feedItemBoxes = $('[class*="feedItemBox"]');
    if ($feedItemBoxes.length > 0) {
        console.log(`[Parser] Found ${$feedItemBoxes.length} feedItemBox elements`);
        $feedItemBoxes.each((_, elm) => {
            // Find Yad2 images within each item
            $(elm).find('img').each((_, img) => {
                const imgSrc = $(img).attr('src');
                if (imgSrc && imgSrc.includes('img.yad2.co.il')) {
                    imageUrls.push(imgSrc);
                }
            });
        });
        if (imageUrls.length > 0) {
            return [...new Set(imageUrls)]; // Remove duplicates
        }
    }

    // Strategy 2: Look for Yad2 image URLs directly
    $('img').each((_, elm) => {
        const imgSrc = $(elm).attr('src');
        if (imgSrc && imgSrc.includes('img.yad2.co.il') && !imgSrc.includes('logo')) {
            imageUrls.push(imgSrc);
        }
    });

    if (imageUrls.length > 0) {
        console.log(`[Parser] Found ${imageUrls.length} Yad2 images via direct search`);
        return [...new Set(imageUrls)]; // Remove duplicates
    }

    // Strategy 3: Legacy selectors (pre-2024)
    const $feedItems = $('.feeditem').find('.pic');
    if ($feedItems && $feedItems.length > 0) {
        console.log(`[Parser] Found ${$feedItems.length} legacy feeditem elements`);
        $feedItems.each((_, elm) => {
            const imgSrc = $(elm).find('img').attr('src');
            if (imgSrc) {
                imageUrls.push(imgSrc);
            }
        });
        return imageUrls;
    }

    // Strategy 4: Alternative legacy selector
    const $altItems = $('[class*="feeditem"]').find('img');
    if ($altItems.length > 0) {
        console.log(`[Parser] Found ${$altItems.length} alternative feeditem images`);
        $altItems.each((_, elm) => {
            const imgSrc = $(elm).attr('src');
            if (imgSrc && !imgSrc.includes('placeholder')) {
                imageUrls.push(imgSrc);
            }
        });
        return imageUrls;
    }

    console.warn('[Parser] No feed items found - page structure may have changed');
    return [];
}

/**
 * Scrape Yad2 URL and extract image URLs
 */
async function scrapeItemsAndExtractImgUrls(html) {
    return parseYad2Html(html);
}

module.exports = {
    parseYad2Html,
    scrapeItemsAndExtractImgUrls,
};
