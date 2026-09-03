import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { JSX } from "react";

type PetMood = "energetic" | "playful" | "calm" | "sleepy" | "bored";

interface SnapshotData {
  petLabel: string;
  petState: string;
  mood: PetMood;
  moodEmoji: string;
  petPngDataUrl: string | null;
  outfitPngDataUrls: string[];
  ageDays: number;
  totalInteractions: number;
  contextLine: string;
  capturedAt: string;
}

declare global {
  interface Window {
    __snapshotData: SnapshotData;
  }
}

function Snapshot(): JSX.Element {
  const [data, setData] = useState<SnapshotData | null>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const incoming = (window as any).__snapshotData;
    if (incoming) setData(incoming);
  }, []);

  if (!data) {
    return (
      <main className="snapshot">
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main className="snapshot">
      <div className="snapshot__card">
        <header className="snapshot__header">
          <div className="snapshot__title">
            <span className="snapshot__pet-name">{data.petLabel}</span>
            <span className="snapshot__pet-state">{data.petState}</span>
          </div>
          <div className="snapshot__mood" aria-label={`mood: ${data.mood}`}>
            <span className="snapshot__mood-emoji">{data.moodEmoji}</span>
            <span className="snapshot__mood-name">{data.mood}</span>
          </div>
        </header>

        <div className="snapshot__stage">
          {data.petPngDataUrl ? (
            <img
              className="snapshot__pet"
              src={data.petPngDataUrl}
              alt={data.petLabel}
            />
          ) : (
            <div className="snapshot__pet snapshot__pet--placeholder" />
          )}
          {data.outfitPngDataUrls.map((url, idx) => (
            <img
              key={idx}
              className={`snapshot__outfit snapshot__outfit--${idx}`}
              src={url}
              alt=""
            />
          ))}
        </div>

        <p className="snapshot__context">{data.contextLine}</p>

        <footer className="snapshot__footer">
          <span>陪伴 {data.ageDays} 天</span>
          <span>·</span>
          <span>互动 {data.totalInteractions} 次</span>
        </footer>
      </div>
      <p className="snapshot__caption">PawPal Local · {data.capturedAt}</p>
    </main>
  );
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<Snapshot />);
}