/**
 * Utility functions for working with Vimeo URLs and video IDs
 */

/**
 * Extracts the Vimeo video ID from various Vimeo URL formats
 * Supports:
 * - https://vimeo.com/123456789
 * - https://player.vimeo.com/video/123456789
 * - https://vimeo.com/channels/staffpicks/123456789
 * - https://vimeo.com/groups/shortfilms/videos/123456789
 */
export function extractVimeoId(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Remove any query parameters and fragments
  const cleanUrl = url.split('?')[0].split('#')[0];
  
  // Various Vimeo URL patterns
  const patterns = [
    /(?:vimeo\.com\/(?:channels\/[^\/]+\/|groups\/[^\/]+\/videos\/|video\/|))(\d+)/,
    /(?:player\.vimeo\.com\/video\/)(\d+)/,
    /(?:vimeo\.com\/)(\d+)/
  ];

  for (const pattern of patterns) {
    const match = cleanUrl.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Checks if a URL is a valid Vimeo URL
 */
export function isVimeoUrl(url: string): boolean {
  return extractVimeoId(url) !== null;
}

/**
 * Generates the embed URL for a Vimeo video
 */
export function getVimeoEmbedUrl(videoId: string, options: {
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  title?: boolean;
  byline?: boolean;
  portrait?: boolean;
} = {}): string {
  const params = new URLSearchParams();
  
  if (options.autoplay) params.set('autoplay', '1');
  if (options.muted) params.set('muted', '1');
  if (options.loop) params.set('loop', '1');
  if (options.title === false) params.set('title', '0');
  if (options.byline === false) params.set('byline', '0');
  if (options.portrait === false) params.set('portrait', '0');

  const queryString = params.toString();
  return `https://player.vimeo.com/video/${videoId}${queryString ? `?${queryString}` : ''}`;
}
