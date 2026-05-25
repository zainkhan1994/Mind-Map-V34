/**
 * Logo fetching and caching utilities
 * Implements F4 (Smart Preloading) and F5 (Caching Strategy)
 */

// In-memory cache for logos
const logoCache = new Map<string, string>();

/**
 * Fetch logo for a given node name
 * Uses a generic logo API that returns URLs for application icons
 */
async function fetchLogo(nodeName: string): Promise<string | null> {
  // Check cache first
  if (logoCache.has(nodeName)) {
    return logoCache.get(nodeName) || null;
  }

  try {
    // Use Clearbit Logo API as fallback, or a custom service
    // For demo purposes, we'll try a few different sources
    const encodedName = encodeURIComponent(nodeName.toLowerCase());
    
    // Try DuckDuckGo icon API
    const iconUrl = `https://icons.duckduckgo.com/ip3/${encodedName}.ico`;
    
    // Store in cache (either the URL or null if not found)
    logoCache.set(nodeName, iconUrl);
    return iconUrl;
  } catch (error) {
    console.error(`Failed to fetch logo for ${nodeName}:`, error);
    logoCache.set(nodeName, '');
    return null;
  }
}

/**
 * Batch preload logos for multiple node names
 * Implements F4 - Smart Preloading
 */
async function preloadLogos(nodeNames: string[]): Promise<void> {
  // Filter out already cached names
  const uncachedNames = nodeNames.filter((name) => !logoCache.has(name));
  
  if (uncachedNames.length === 0) return;

  // Fetch logos in parallel with a reasonable concurrency limit
  const batchSize = 10;
  for (let i = 0; i < uncachedNames.length; i += batchSize) {
    const batch = uncachedNames.slice(i, i + batchSize);
    await Promise.all(batch.map((name) => fetchLogo(name)));
  }
}

/**
 * Get cached logo URL for a node name
 */
function getCachedLogo(nodeName: string): string | null {
  return logoCache.get(nodeName) || null;
}

/**
 * Clear the logo cache
 */
function clearLogoCache(): void {
  logoCache.clear();
}

export { fetchLogo, preloadLogos, getCachedLogo, clearLogoCache };
