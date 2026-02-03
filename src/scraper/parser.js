const cheerio = require('cheerio');

const YAD2_BASE_URL = 'https://www.yad2.co.il';

/**
 * @typedef {Object} Listing
 * @property {string} id - Unique identifier (listing URL)
 * @property {string} url - Full URL to listing
 * @property {string} price - Price string
 * @property {string} street - Street address
 * @property {string} city - City/neighborhood info
 * @property {string} details - Rooms, floor, sqm
 * @property {string} imageUrl - Image URL
 */

/**
 * Parse Yad2 HTML and extract listing details
 * @param {string} html - Raw HTML from Yad2
 * @returns {Listing[]} Array of listing objects
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

    const listings = [];
    const seenIds = new Set();

    // New Yad2 structure (2024+) - feedItemBox containers
    const $feedItemBoxes = $('[class*="feedItemBox"]');
    if ($feedItemBoxes.length > 0) {
        console.log(`[Parser] Found ${$feedItemBoxes.length} feedItemBox elements`);

        $feedItemBoxes.each((_, elm) => {
            const item = $(elm);

            // Extract link (used as unique ID - more stable than image URLs)
            const linkPath = item.find('a[class*="itemLink"]').attr('href') || '';
            const url = linkPath.startsWith('/') ? YAD2_BASE_URL + linkPath.split('?')[0] : linkPath;

            // Skip items without a valid URL or duplicates
            if (!url || seenIds.has(url)) {
                return;
            }
            seenIds.add(url);

            // Extract image URL
            const imageUrl = item.find('img[data-testid="image"]').attr('src')
                || item.find('img[src*="img.yad2.co.il"]').attr('src')
                || '';

            // Extract listing details
            const price = item.find('[data-testid="price"]').text().trim();
            const street = item.find('[data-testid="street-name"]').text().trim();
            const city = item.find('[data-testid="item-info-line-1st"]').text().trim();
            const details = item.find('[data-testid="item-info-line-2nd"]').text().trim();

            listings.push({
                id: url,  // Use URL as stable unique ID
                url,
                price,
                street,
                city,
                details,
                imageUrl,
            });
        });

        if (listings.length > 0) {
            return listings;
        }
    }

    // Fallback: Look for Yad2 image URLs directly (legacy support)
    const imageUrls = [];
    $('img').each((_, elm) => {
        const imgSrc = $(elm).attr('src');
        if (imgSrc && imgSrc.includes('img.yad2.co.il') && !imgSrc.includes('logo')) {
            if (!seenIds.has(imgSrc)) {
                seenIds.add(imgSrc);
                imageUrls.push(imgSrc);
            }
        }
    });

    if (imageUrls.length > 0) {
        console.log(`[Parser] Found ${imageUrls.length} Yad2 images via fallback`);
        // Return minimal listing objects for backward compatibility
        return imageUrls.map(imageUrl => ({
            id: imageUrl,
            url: '',
            price: '',
            street: '',
            city: '',
            details: '',
            imageUrl,
        }));
    }

    console.warn('[Parser] No feed items found - page structure may have changed');
    return [];
}

/**
 * Extract just image URLs from listings (for backward compatibility)
 * @param {string} html - Raw HTML from Yad2
 * @returns {string[]} Array of image URLs
 */
function scrapeItemsAndExtractImgUrls(html) {
    const listings = parseYad2Html(html);
    return listings.map(l => l.id);
}

/**
 * Format a listing for display in Telegram
 * @param {Listing} listing
 * @returns {string}
 */
function formatListing(listing) {
    const parts = [];

    if (listing.price) {
        parts.push(listing.price);
    }

    if (listing.street) {
        parts.push(listing.street);
    }

    if (listing.city) {
        parts.push(listing.city);
    }

    if (listing.details) {
        parts.push(listing.details);
    }

    if (listing.url) {
        parts.push(listing.url);
    }

    // Fallback to just image URL if no other data
    if (parts.length === 0) {
        return listing.imageUrl;
    }

    return parts.join('\n');
}

module.exports = {
    parseYad2Html,
    scrapeItemsAndExtractImgUrls,
    formatListing,
};
