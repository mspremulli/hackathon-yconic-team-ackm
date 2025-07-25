/**
 * Smart matching service for finding variations of startup names
 */

export interface NameVariations {
  original: string;
  variations: string[];
  domains: string[];
  handles: string[];
}

/**
 * Generate smart name variations for a startup
 */
export function generateNameVariations(startupName: string, website?: string): NameVariations {
  const variations = new Set<string>();
  const domains = new Set<string>();
  const handles = new Set<string>();
  
  // Add original
  variations.add(startupName);
  
  // Lowercase version
  variations.add(startupName.toLowerCase());
  
  // Remove spaces
  variations.add(startupName.replace(/\s+/g, ''));
  variations.add(startupName.replace(/\s+/g, '').toLowerCase());
  
  // Replace spaces with hyphens
  variations.add(startupName.replace(/\s+/g, '-'));
  variations.add(startupName.replace(/\s+/g, '-').toLowerCase());
  
  // Replace spaces with underscores
  variations.add(startupName.replace(/\s+/g, '_'));
  
  // Handle common patterns
  if (startupName.includes('AI')) {
    variations.add(startupName.replace('AI', 'A.I.'));
    variations.add(startupName.replace('AI', 'Ai'));
  }
  
  if (startupName.includes('&')) {
    variations.add(startupName.replace('&', 'and'));
  }
  
  if (startupName.includes(' and ')) {
    variations.add(startupName.replace(' and ', ' & '));
  }
  
  // Remove common suffixes
  const suffixes = [' Inc', ' Inc.', ' LLC', ' Corp', ' Corporation', ' Ltd', ' Limited'];
  suffixes.forEach(suffix => {
    if (startupName.endsWith(suffix)) {
      const withoutSuffix = startupName.slice(0, -suffix.length);
      variations.add(withoutSuffix);
      variations.add(withoutSuffix.toLowerCase());
    }
  });
  
  // Add with common suffixes if not present
  if (!suffixes.some(s => startupName.endsWith(s))) {
    variations.add(`${startupName} Inc`);
  }
  
  // Generate social media handles
  const baseHandle = startupName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  handles.add(`@${baseHandle}`);
  handles.add(baseHandle);
  
  // Common social media patterns
  handles.add(`${baseHandle}hq`);
  handles.add(`${baseHandle}app`);
  handles.add(`${baseHandle}ai`);
  handles.add(`get${baseHandle}`);
  handles.add(`try${baseHandle}`);
  handles.add(`${baseHandle}official`);
  
  // Extract domain from website if provided
  if (website) {
    try {
      const url = new URL(website.startsWith('http') ? website : `https://${website}`);
      const domain = url.hostname.replace('www.', '');
      domains.add(domain);
      
      // Extract company name from domain
      const domainName = domain.split('.')[0];
      variations.add(domainName);
      variations.add(domainName.charAt(0).toUpperCase() + domainName.slice(1));
      
      // Use domain as handle
      handles.add(`@${domainName}`);
      handles.add(domainName);
    } catch (e) {
      // Invalid URL, skip
    }
  }
  
  return {
    original: startupName,
    variations: Array.from(variations),
    domains: Array.from(domains),
    handles: Array.from(handles),
  };
}

/**
 * Build smart search queries for different platforms
 */
export function buildSmartQueries(variations: NameVariations): Record<string, string> {
  const { original, variations: vars, domains, handles } = variations;
  
  // Twitter: Use OR queries with handles
  const twitterQuery = [
    ...vars.slice(0, 3).map(v => `"${v}"`),
    ...handles.slice(0, 3),
  ].join(' OR ');
  
  // Reddit: Focus on exact matches and domains
  const redditQuery = [
    `"${original}"`,
    ...domains.map(d => `site:${d}`),
  ].join(' OR ');
  
  // YouTube: Product demos and reviews
  const youtubeQuery = [
    `"${original}" demo`,
    `"${original}" review`,
    `"${original}" tutorial`,
  ].join(' OR ');
  
  // LinkedIn: Company and founder searches
  const linkedinQuery = `"${original}" startup founder CEO`;
  
  // General web search
  const webQuery = [
    `"${original}"`,
    ...domains.map(d => `site:${d}`),
    '"funded" OR "raises" OR "announces"',
  ].join(' ');
  
  return {
    twitter: twitterQuery,
    reddit: redditQuery,
    youtube: youtubeQuery,
    linkedin: linkedinQuery,
    web: webQuery,
    bluesky: handles[0] || original, // Bluesky prefers handles
  };
}

/**
 * Score a match to determine if it's actually about the startup
 */
export function scoreMatch(text: string, variations: NameVariations): number {
  const lowerText = text.toLowerCase();
  let score = 0;
  
  // Check for exact matches
  variations.variations.forEach(variant => {
    if (lowerText.includes(variant.toLowerCase())) {
      score += variant === variations.original ? 10 : 5;
    }
  });
  
  // Check for domain mentions
  variations.domains.forEach(domain => {
    if (lowerText.includes(domain)) {
      score += 8;
    }
  });
  
  // Check for handle mentions
  variations.handles.forEach(handle => {
    if (lowerText.includes(handle.toLowerCase())) {
      score += 3;
    }
  });
  
  // Context clues that increase confidence
  const contextWords = ['startup', 'company', 'founded', 'CEO', 'raises', 'funding', 'launch'];
  contextWords.forEach(word => {
    if (lowerText.includes(word)) {
      score += 2;
    }
  });
  
  // Negative context (might be different company)
  const negativeContext = ['vs', 'versus', 'competitor', 'alternative to'];
  negativeContext.forEach(word => {
    if (lowerText.includes(word)) {
      score -= 5;
    }
  });
  
  return Math.max(0, score);
}