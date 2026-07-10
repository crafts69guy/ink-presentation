import React from 'react';

export interface NotesOverlayProps {
  notes: string;
}

/**
 * Bottom strip showing the current slide's speaker notes. Lives in the light
 * DOM (outside the deck's shadow root) and renders text only — React text
 * nodes, never HTML — so note content cannot inject markup.
 */
export function NotesOverlay({ notes }: NotesOverlayProps) {
  return (
    <div className="ink-presentation-notes" role="complementary" aria-label="Speaker notes">
      {notes !== '' ? (
        <p className="ink-presentation-notes-text">{notes}</p>
      ) : (
        <p className="ink-presentation-notes-empty">No speaker notes for this slide</p>
      )}
    </div>
  );
}
