import { useMemo, useState } from 'react';
import type { WindowConfig } from '../types';
import { WindowType } from '../types';
import { buildWindow3DSceneSpec } from './configToScene';
import { Window3DViewer } from './Window3DViewer';

type Props = {
  config: WindowConfig;
  onClose: () => void;
};

export default function Window3DPreviewModal({ config, onClose }: Props) {
  const spec = useMemo(() => buildWindow3DSceneSpec(config), [config]);
  const [slideOpen, setSlideOpen] = useState(0);
  const [casementOpenDeg, setCasementOpenDeg] = useState(0);

  const showSlide = spec?.kind === 'sliding';
  const showCasement = spec?.kind === 'casement';

  return (
    <div
      className="no-print fixed inset-0 z-[100] flex flex-col bg-slate-200/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="3D window preview"
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-300 bg-white/90 px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">3D Preview</h2>
          <p className="text-xs text-slate-600">
            Isolated viewer — drag to orbit · scroll to zoom · does not change your design or quotation
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Close
        </button>
      </header>

      {!spec ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-slate-300">
          Enter valid width and height to preview in 3D.
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1 flex-col">
            <Window3DViewer spec={spec} slideOpen={slideOpen} casementOpenDeg={casementOpenDeg} />
          </div>
          <footer className="shrink-0 space-y-3 border-t border-slate-300 bg-white/95 px-4 py-3">
            {showSlide && (
              <label className="flex flex-col gap-1 text-sm text-slate-800">
                <span>Slide shutters open ({Math.round(slideOpen * 100)}%)</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(slideOpen * 100)}
                  onChange={(e) => setSlideOpen(Number(e.target.value) / 100)}
                  className="w-full accent-indigo-500"
                />
              </label>
            )}
            {showCasement && (
              <label className="flex flex-col gap-1 text-sm text-slate-800">
                <span>Open casement ({casementOpenDeg}°)</span>
                <input
                  type="range"
                  min={0}
                  max={90}
                  value={casementOpenDeg}
                  onChange={(e) => setCasementOpenDeg(Number(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </label>
            )}
            {!showSlide && !showCasement && (
              <p className="text-xs text-slate-400">
                {config.windowType === WindowType.LOUVERS
                  ? 'Louver blades shown with profile color · Phase 1 preview'
                  : 'Orbit the model · more types & materials in later phases'}
              </p>
            )}
          </footer>
        </>
      )}
    </div>
  );
}
