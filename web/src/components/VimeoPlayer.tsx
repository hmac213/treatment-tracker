"use client";

import { useState } from 'react';
import { extractVimeoId, getVimeoEmbedUrl, isVimeoUrl } from '@/lib/vimeoUtils';

interface VimeoPlayerProps {
  videoUrl: string;
  title?: string;
  className?: string;
  /** Fill a positioned parent (e.g. inside `relative aspect-video`) with no extra gap */
  fill?: boolean;
  width?: number | string;
  height?: number | string;
  autoplay?: boolean;
  muted?: boolean;
  showTitle?: boolean;
  showByline?: boolean;
  showPortrait?: boolean;
}

export function VimeoPlayer({
  videoUrl,
  title = "Video",
  className = "",
  fill = false,
  width = "100%",
  height = 315,
  autoplay = false,
  muted = false,
  showTitle = false,
  showByline = false,
  showPortrait = false
}: VimeoPlayerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Extract Vimeo ID from the URL
  const vimeoId = extractVimeoId(videoUrl);

  // If it's not a Vimeo URL, show fallback
  if (!isVimeoUrl(videoUrl) || !vimeoId) {
    return (
      <div className={`bg-gray-100 border rounded-lg p-4 ${className}`}>
        <p className="text-gray-600 mb-2">Video not available for embedding</p>
        <a 
          href={videoUrl} 
          target="_blank" 
          rel="noreferrer"
          className="inline-block rounded bg-blue-700 text-white px-3 py-2 hover:bg-blue-800 transition-colors"
        >
          Watch video externally
        </a>
      </div>
    );
  }

  const embedUrl = getVimeoEmbedUrl(vimeoId, {
    autoplay,
    muted,
    title: showTitle,
    byline: showByline,
    portrait: showPortrait
  });

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const rootClass = fill
    ? `absolute inset-0 min-h-0 ${className}`.trim()
    : `relative ${className}`.trim();

  const iframeClass = fill
    ? 'rounded-lg shadow-sm absolute inset-0 h-full w-full max-w-full border-0'
    : `rounded-lg shadow-sm max-w-full ${width === '100%' ? 'w-full' : ''}`;

  if (hasError) {
    return (
      <div className={`bg-gray-100 border rounded-lg p-4 ${className}`}>
        <p className="text-gray-600 mb-2">Unable to load video</p>
        <a 
          href={videoUrl} 
          target="_blank" 
          rel="noreferrer"
          className="inline-block rounded bg-blue-700 text-white px-3 py-2 hover:bg-blue-800 transition-colors"
        >
          Watch video externally
        </a>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      {isLoading && (
        <div className="absolute inset-0 z-10 bg-gray-100 border rounded-lg flex items-center justify-center">
          <div className="text-gray-500">Loading video...</div>
        </div>
      )}
      <iframe
        src={embedUrl}
        width={fill ? '100%' : width}
        height={fill ? '100%' : height}
        frameBorder="0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        title={title}
        className={iframeClass}
        onLoad={handleLoad}
        onError={handleError}
        style={{ display: isLoading ? 'none' : 'block' }}
      />
    </div>
  );
}

interface VimeoPlayerButtonProps {
  videoUrl: string;
  title?: string;
  buttonText?: string;
  buttonClassName?: string;
  playerClassName?: string;
}

/**
 * A component that shows a button to reveal an embedded Vimeo player
 * Useful for performance when you have multiple videos on a page
 */
export function VimeoPlayerButton({
  videoUrl,
  title = "Video",
  buttonText = "Play video",
  buttonClassName = "inline-block rounded bg-blue-700 text-white px-3 py-2 hover:bg-blue-800 transition-colors",
  playerClassName = "mt-3"
}: VimeoPlayerButtonProps) {
  const [showPlayer, setShowPlayer] = useState(false);

  if (showPlayer) {
    return (
      <div>
        <VimeoPlayer 
          videoUrl={videoUrl} 
          title={title}
          className={playerClassName}
        />
        <button
          onClick={() => setShowPlayer(false)}
          className="mt-2 text-sm text-gray-600 hover:text-gray-800 underline"
        >
          Hide video
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowPlayer(true)}
      className={buttonClassName}
    >
      {buttonText}
    </button>
  );
}
