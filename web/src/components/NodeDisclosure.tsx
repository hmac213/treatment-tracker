"use client";

import { useState } from 'react';
import { VimeoPlayerButton } from './VimeoPlayer';
import { isVimeoUrl } from '@/lib/vimeoUtils';

export function NodeDisclosure({ title, videoUrl, summary }: { title: string; videoUrl?: string | null; summary?: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded border bg-white/70">
      <button
        type="button"
        className="w-full flex items-center gap-3 px-3 py-2 text-lg font-medium"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <svg
          className={`ml-auto h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.939l3.71-3.71a.75.75 0 111.06 1.061l-4.24 4.24a.75.75 0 01-1.06 0L5.25 8.29a.75.75 0 01-.02-1.08z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-3">
          {videoUrl && (
            isVimeoUrl(videoUrl) ? (
              <VimeoPlayerButton 
                videoUrl={videoUrl} 
                title={title}
                buttonText="Play video"
              />
            ) : (
              <a className="inline-block rounded bg-blue-700 text-white px-3 py-2 hover:bg-blue-800 transition-colors" href={videoUrl} target="_blank" rel="noreferrer">
                Play video
              </a>
            )
          )}
          {summary && <p className="text-gray-800 leading-relaxed whitespace-pre-line">{summary}</p>}
        </div>
      )}
    </div>
  );
} 