const { addProject, getProject } = require('../../config/loader');
const { startScraper } = require('../utils/processManager');

/**
 * Format price for display (e.g., 2000000 -> "2M")
 */
function formatPrice(price) {
    const num = parseInt(price, 10);
    if (isNaN(num)) return null;

    if (num >= 1000000) {
        const millions = num / 1000000;
        return millions % 1 === 0 ? `${millions}M` : `${millions.toFixed(1)}M`;
    }
    if (num >= 1000) {
        const thousands = num / 1000;
        return thousands % 1 === 0 ? `${thousands}K` : `${thousands.toFixed(0)}K`;
    }
    return String(num);
}

/**
 * Parse category from URL path
 */
function parseCategory(pathname) {
    if (pathname.includes('/forsale')) return 'Sale';
    if (pathname.includes('/rent')) return 'Rent';
    if (pathname.includes('/commercial')) return 'Commercial';
    if (pathname.includes('/roommates')) return 'Roommates';
    return null;
}

/**
 * Parse property type from URL path
 */
function parsePropertyType(pathname) {
    if (pathname.includes('/realestate')) return null; // Generic real estate
    if (pathname.includes('/vehicles')) return 'Vehicles';
    if (pathname.includes('/products')) return 'Products';
    return null;
}

/**
 * Generate topic name from Yad2 URL parameters
 */
function generateTopicName(url) {
    try {
        const parsed = new URL(url);
        const params = parsed.searchParams;
        const pathname = parsed.pathname;

        const parts = [];

        // Category (Sale/Rent)
        const category = parseCategory(pathname);
        if (category) parts.push(category);

        // Property type
        const propertyType = parsePropertyType(pathname);
        if (propertyType) parts.push(propertyType);

        // City (common param names)
        const city = params.get('city') || params.get('topArea') || params.get('area');
        if (city) {
            // City codes are numeric, we'll just use them as-is
            // In a more complete implementation, we'd map codes to names
            parts.push(`City-${city}`);
        }

        // Neighborhoods
        const neighborhood = params.get('neighborhood') || params.get('multiNeighborhood');
        if (neighborhood && !city) {
            parts.push('Custom-Area');
        }

        // Price range
        const minPrice = params.get('minPrice');
        const maxPrice = params.get('maxPrice');
        if (minPrice || maxPrice) {
            const min = minPrice ? formatPrice(minPrice) : '0';
            const max = maxPrice ? formatPrice(maxPrice) : '+';
            if (minPrice && maxPrice) {
                parts.push(`${min}-${max}`);
            } else if (minPrice) {
                parts.push(`${min}+`);
            } else if (maxPrice) {
                parts.push(`Up-to-${max}`);
            }
        }

        // Rooms
        const rooms = params.get('rooms') || params.get('minRooms');
        if (rooms) {
            parts.push(`${rooms}+ rooms`);
        }

        // Square meters
        const sqm = params.get('minSquaremeter') || params.get('squaremeter');
        if (sqm) {
            parts.push(`${sqm}sqm+`);
        }

        // Floor
        const floor = params.get('minFloor');
        if (floor) {
            parts.push(`Floor-${floor}+`);
        }

        // If we have parts, join them
        if (parts.length > 0) {
            return parts.join(' ');
        }

        // Fallback: use timestamp
        const now = new Date();
        return `Scraper ${now.toISOString().slice(0, 10)}`;
    } catch (error) {
        // Fallback on any error
        const now = new Date();
        return `Scraper ${now.toISOString().slice(0, 10)}`;
    }
}

/**
 * Validate Yad2 URL format
 */
function isValidYad2Url(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname.includes('yad2.co.il');
    } catch {
        return false;
    }
}

/**
 * Ensure topic name is unique by appending a number if needed
 */
function ensureUniqueName(baseName) {
    let name = baseName;
    let counter = 1;

    while (getProject(name)) {
        counter++;
        name = `${baseName} (${counter})`;
    }

    return name;
}

/**
 * From-URL command handler
 */
async function fromUrlCommand(url, options) {
    const { name: customName, start: shouldStart } = options;

    if (!url) {
        console.error('Error: URL is required');
        console.log('Usage: yad2 from-url <url> [--name "Custom Name"] [--start]');
        process.exit(1);
    }

    // Validate URL
    if (!isValidYad2Url(url)) {
        console.error('Error: URL must be a valid yad2.co.il URL');
        process.exit(1);
    }

    // Generate or use custom name
    let topicName;
    if (customName) {
        topicName = customName;
        if (getProject(topicName)) {
            console.error(`Error: Topic "${topicName}" already exists`);
            process.exit(1);
        }
    } else {
        const baseName = generateTopicName(url);
        topicName = ensureUniqueName(baseName);
    }

    // Add to config
    try {
        addProject({ topic: topicName, url, disabled: false });
        console.log(`Created scraper "${topicName}"`);
        console.log(`  URL: ${url.length > 60 ? url.substring(0, 60) + '...' : url}`);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }

    // Start if requested
    if (shouldStart) {
        try {
            const pid = startScraper(topicName, { interval: 15 });
            console.log(`  Started (PID: ${pid})`);
            console.log(`\nUse "yad2 logs "${topicName}"" to view logs.`);
        } catch (error) {
            console.error(`Warning: Could not start scraper: ${error.message}`);
        }
    } else {
        console.log(`\nUse "yad2 start "${topicName}"" to begin scraping.`);
    }
}

module.exports = { fromUrlCommand, generateTopicName };
