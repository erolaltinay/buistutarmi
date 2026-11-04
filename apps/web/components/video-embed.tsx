'use client';
// YouTube oynatıcısı kullanıcı isteyene kadar yüklenmez: sayfa hızlı açılır, üçüncü tarafa istek gitmez.
import { useState } from 'react';

export function VideoEmbed({
  id,
  title,
  play,
  note,
}: {
  id: string;
  title: string;
  play: string;
  note: string;
}) {
  const [on, setOn] = useState(false);
  if (on)
    return (
      <div className="video-frame">
        <iframe
          data-testid="video-iframe"
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  return (
    <div className="video-frame">
      <button type="button" className="solid" data-testid="video-play" onClick={() => setOn(true)}>
        {play}
      </button>
      <p className="note">{note}</p>
    </div>
  );
}
