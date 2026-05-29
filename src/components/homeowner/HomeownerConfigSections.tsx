import React, { useMemo, useState } from 'react';
import type { HandleConfig, MaterialRateSettings, WindowConfig } from '../../types';
import { GlassSpecialType, GlassType, WindowType } from '../../types';
import { Button } from '../ui/Button';
import { CollapsibleCard } from '../ui/CollapsibleCard';
import { getDefaultHandleConfig, type HandleMemberPlacement } from '../../utils/handleDefaults';
import { useHomeownerHandlePlacement } from './HomeownerHandlePlacementContext';
import {
  calcHomeownerFullPricing,
  HOMEOWNER_ALUMINIUM_PER_KG,
  type HomeownerLockType,
} from '../../utils/homeownerPricing';
import { listOperablePanelIds } from '../../utils/homeownerOperablePanels';
import { loadHomeownerDefaults, saveHomeownerDefaults } from '../../utils/homeownerDefaultsStorage';

type GlassPreset = 'single' | 'safety' | 'soundproof';

export function HomeownerConfigSections(props: {
  config: WindowConfig;
  displayConfig: WindowConfig;
  setConfig: (field: keyof WindowConfig, value: unknown) => void;
  onUpdateHandle: (panelId: string, cfg: HandleConfig | null) => void;
  rates: MaterialRateSettings;
  openCard: string | null;
  onToggleCard: (title: string) => void;
  idPrefix?: string;
  onLiveBaseRate?: (ratePerSqFt: number) => void;
}) {
  const { config, displayConfig, setConfig, onUpdateHandle, rates, openCard, onToggleCard, idPrefix = '', onLiveBaseRate } = props;
  const { placement, setPlacement } = useHomeownerHandlePlacement();

  const panelIds = useMemo(() => listOperablePanelIds(displayConfig), [displayConfig]);
  const panelCount = panelIds.length;
  const panelLabel = displayConfig.windowType === WindowType.SLIDING ? 'shutters' : 'doors';

  const initialDefaults = useMemo(() => loadHomeownerDefaults(), []);
  const [lockType, setLockType] = useState<HomeownerLockType>((initialDefaults?.lockType as HomeownerLockType) || 'mortice');
  const [preset, setPreset] = useState<GlassPreset>((initialDefaults?.preset as GlassPreset) || 'single');
  const [frostedExtra, setFrostedExtra] = useState(Boolean(initialDefaults?.frostedExtra));

  const lockRate = Number(rates.lockRates?.[lockType] ?? 0) || 0;

  const pricing = useMemo(
    () =>
      calcHomeownerFullPricing({
        config: displayConfig,
        rates,
        hardwareItems: displayConfig.series?.hardwareItems ?? [],
        lockType,
      }),
    [displayConfig, lockType, rates],
  );

  React.useEffect(() => {
    if (pricing?.baseRatePerSqFt && onLiveBaseRate) {
      onLiveBaseRate(pricing.baseRatePerSqFt);
    }
  }, [onLiveBaseRate, pricing?.baseRatePerSqFt]);

  const persistDefaults = (partial: {
    lockType?: HomeownerLockType;
    preset?: GlassPreset;
    frostedExtra?: boolean;
    profileColor?: string;
    handle?: { enabled: boolean; config: HandleConfig };
  }) => {
    saveHomeownerDefaults({
      version: 1,
      lockType: partial.lockType ?? lockType,
      preset: partial.preset ?? preset,
      frostedExtra: partial.frostedExtra ?? frostedExtra,
      profileColor: partial.profileColor ?? config.profileColor,
      single: {
        glassType: config.glassType,
        thicknessMm: Number(config.glassThickness) || 6,
      },
      handle:
        partial.handle ??
        initialDefaults?.handle ?? {
          enabled: false,
          config: { x: 75, y: 55, orientation: 'vertical', length: 172, variant: 'casement' },
        },
    });
  };

  const applyHandlesToAll = () => {
    if (!displayConfig.series?.dimensions) return;
    panelIds.forEach((id) => {
      onUpdateHandle(id, getDefaultHandleConfig(id, displayConfig));
    });
    const first = panelIds[0] ? getDefaultHandleConfig(panelIds[0], displayConfig) : null;
    if (first) {
      persistDefaults({ handle: { enabled: true, config: first } });
    }
  };

  const alignAllHandlesY = (y: number) => {
    panelIds.forEach((id) => {
      const cur = getDefaultHandleConfig(id, displayConfig);
      const existing =
        displayConfig.windowType === WindowType.SLIDING
          ? displayConfig.slidingHandles[parseInt(id.split('-')[1], 10)]
          : null;
      const base = existing ?? cur;
      onUpdateHandle(id, { ...base, y });
    });
  };

  const setAllHandlesX = (x: number) => {
    panelIds.forEach((id) => {
      const cur = getDefaultHandleConfig(id, displayConfig);
      const idx = parseInt(id.split('-')[1], 10);
      let existing: HandleConfig | null | undefined = cur;
      if (displayConfig.windowType === WindowType.SLIDING) {
        existing = displayConfig.slidingHandles[idx];
      } else if (displayConfig.windowType === WindowType.CASEMENT) {
        const parts = id.split('-');
        const row = parseInt(parts[1], 10);
        const col = parseInt(parts[2], 10);
        existing = displayConfig.doorPositions.find((p) => p.row === row && p.col === col)?.handle;
      }
      const base = existing ?? cur;
      onUpdateHandle(id, { ...base, x });
    });
  };

  const applyGlassPreset = (p: GlassPreset) => {
    setPreset(p);
    if (p === 'single') {
      setConfig('glassSpecialType', 'none');
      setConfig('glassThickness', Number(config.glassThickness) || 6);
      setConfig('glassType', config.glassType || GlassType.CLEAR);
    } else if (p === 'safety') {
      setConfig('glassSpecialType', 'laminated' as GlassSpecialType);
      setConfig('laminatedGlassConfig', {
        ...config.laminatedGlassConfig,
        glass1Thickness: config.laminatedGlassConfig?.glass1Thickness || 5,
        glass1Type: config.laminatedGlassConfig?.glass1Type || GlassType.CLEAR,
        pvbThickness: config.laminatedGlassConfig?.pvbThickness || 1.52,
        pvbType: config.laminatedGlassConfig?.pvbType || 'clear',
        glass2Thickness: config.laminatedGlassConfig?.glass2Thickness || 6,
        glass2Type: config.laminatedGlassConfig?.glass2Type || GlassType.CLEAR,
        isToughened: Boolean(config.laminatedGlassConfig?.isToughened),
      });
    } else {
      setConfig('glassSpecialType', 'dgu' as GlassSpecialType);
      setConfig('dguGlassConfig', {
        ...config.dguGlassConfig,
        glass1Thickness: config.dguGlassConfig?.glass1Thickness || 5,
        glass1Type: config.dguGlassConfig?.glass1Type || GlassType.CLEAR,
        airGap: config.dguGlassConfig?.airGap || 12,
        glass2Thickness: config.dguGlassConfig?.glass2Thickness || 5,
        glass2Type: config.dguGlassConfig?.glass2Type || GlassType.CLEAR,
        isToughened: Boolean(config.dguGlassConfig?.isToughened),
      });
    }
    persistDefaults({ preset: p });
  };

  const quickColors = [
    { name: 'Matt Black', value: '#374151' },
    { name: 'Dark Grey', value: '#4B5563' },
    { name: 'White', value: '#F9FAFB' },
    { name: 'Gold', value: '#D6A158' },
  ];

  return (
    <>
      <CollapsibleCard
        title="Handles & locks"
        isOpen={openCard === 'Handles & locks'}
        onToggle={() => onToggleCard('Handles & locks')}
      >
        <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
          <span className="rounded bg-slate-700 px-2 py-1">{panelCount} {panelLabel}</span>
          {pricing ? (
            <>
              <span className="rounded bg-slate-700 px-2 py-1">
                Al ₹{pricing.aluminiumPerSqFt}/sft ({pricing.aluminiumKg.toFixed(1)} kg @ ₹{HOMEOWNER_ALUMINIUM_PER_KG}/kg)
              </span>
              <span className="rounded bg-slate-700 px-2 py-1">PC ₹{pricing.powderPerSqFt}/sft</span>
              <span className="rounded bg-slate-700 px-2 py-1">Glass ₹{pricing.glassPerSqFt}/sft</span>
              {pricing.meshPerSqFt > 0 ? (
                <span className="rounded bg-slate-700 px-2 py-1">Mesh ₹{pricing.meshPerSqFt}/sft</span>
              ) : null}
              <span className="rounded bg-slate-700 px-2 py-1">Making ₹{pricing.makingPerSqFt}/sft</span>
              <span className="rounded bg-slate-700 px-2 py-1">Lock ₹{lockRate}/pc → ₹{pricing.lockCost}</span>
              <span className="rounded bg-indigo-800/80 px-2 py-1 font-semibold text-indigo-100">
                Base rate ₹{pricing.baseRatePerSqFt}/sft · Total ₹{pricing.total.toLocaleString('en-IN')}
              </span>
            </>
          ) : (
            <span className="rounded bg-slate-700 px-2 py-1">Enter dimensions to see live base rate</span>
          )}
        </div>
        {pricing && rates.powderCoatingPerRft ? (
          <p className="mb-2 text-[10px] leading-snug text-slate-500">
            Powder coating: track ₹{rates.powderCoatingPerRft.track}/rft · shutters ₹{rates.powderCoatingPerRft.shutterSections}/rft · slim interlock ₹
            {rates.powderCoatingPerRft.slimInterlock}/rft
            {rates.powderCoatingPerRft.trackClip != null ? ` · track clip ₹${rates.powderCoatingPerRft.trackClip}/rft` : ''}
          </p>
        ) : null}
        <Button
          variant="primary"
          className="mb-3 w-full"
          onClick={applyHandlesToAll}
          disabled={panelCount === 0}
        >
          Add handles to all {panelLabel} ({panelCount})
        </Button>
        <p className="mb-2 text-xs text-slate-400">
          Drag a handle up/down on the canvas to move all handles together — live mm from top and bottom are shown. Pick a frame member below, then click a shutter/door on the model.
        </p>
        <p className="mb-2 text-xs font-semibold text-slate-300">Place on frame member (then click panel)</p>
        <div className="mb-3 grid grid-cols-4 gap-2">
          {(
            [
              ['top', 'Top'],
              ['bottom', 'Bottom'],
              ['left', 'Left'],
              ['right', 'Right'],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={placement === key ? 'primary' : 'secondary'}
              onClick={() => setPlacement(placement === key ? null : (key as HandleMemberPlacement))}
            >
              {label}
            </Button>
          ))}
        </div>
        {placement && (
          <p className="mb-3 rounded-md bg-indigo-900/40 px-2 py-1.5 text-xs text-indigo-200">
            Click a {panelLabel.slice(0, -1)} on the canvas — handle aligns to the <strong>{placement}</strong> frame member.
          </p>
        )}
        <div className="mb-3 grid grid-cols-3 gap-2">
          <Button variant={lockType === 'touch' ? 'primary' : 'secondary'} onClick={() => { setLockType('touch'); persistDefaults({ lockType: 'touch' }); }}>
            Touch ₹{rates.lockRates?.touch ?? 550}
          </Button>
          <Button variant={lockType === 'multipoint' ? 'primary' : 'secondary'} onClick={() => { setLockType('multipoint'); persistDefaults({ lockType: 'multipoint' }); }}>
            Multi ₹{rates.lockRates?.multipoint ?? 1550}
          </Button>
          <Button variant={lockType === 'mortice' ? 'primary' : 'secondary'} onClick={() => { setLockType('mortice'); persistDefaults({ lockType: 'mortice' }); }}>
            Mortice ₹{rates.lockRates?.mortice ?? 2500}
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" onClick={() => setAllHandlesX(25)} disabled={panelCount === 0}>
            All left
          </Button>
          <Button variant="secondary" onClick={() => alignAllHandlesY(55)} disabled={panelCount === 0}>
            Align height
          </Button>
          <Button variant="secondary" onClick={() => setAllHandlesX(75)} disabled={panelCount === 0}>
            All right
          </Button>
        </div>
      </CollapsibleCard>

      {config.windowType !== WindowType.MIRROR && config.windowType !== WindowType.LOUVERS && (
        <CollapsibleCard
          title="Glass & color"
          isOpen={openCard === 'Glass & color'}
          onToggle={() => onToggleCard('Glass & color')}
        >
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Button variant={preset === 'single' ? 'primary' : 'secondary'} onClick={() => applyGlassPreset('single')}>
              Single
            </Button>
            <Button variant={preset === 'safety' ? 'primary' : 'secondary'} onClick={() => applyGlassPreset('safety')}>
              Safety
            </Button>
            <Button variant={preset === 'soundproof' ? 'primary' : 'secondary'} onClick={() => applyGlassPreset('soundproof')}>
              Soundproof
            </Button>
          </div>
          {preset === 'single' && (
            <div className="mb-3 grid grid-cols-4 gap-2">
              {[5, 6, 8, 10, 12].map((mm) => (
                <Button
                  key={mm}
                  variant={Number(config.glassThickness) === mm ? 'primary' : 'secondary'}
                  onClick={() => setConfig('glassThickness', mm)}
                >
                  {mm}mm
                </Button>
              ))}
            </div>
          )}
          <div className="mb-3 flex flex-wrap gap-2">
            {[
              { t: GlassType.CLEAR, label: 'Clear' },
              { t: GlassType.BROWN_TINTED, label: 'Brown' },
              { t: GlassType.TINTED_GREY, label: 'Grey' },
              { t: GlassType.BLACK_TINTED, label: 'Black' },
              { t: GlassType.CLEAR_SAPPHIRE, label: 'Sapphire' },
              { t: GlassType.FROSTED, label: 'Frosted' },
            ].map(({ t, label }) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setConfig('glassType', t);
                  if (t === GlassType.FROSTED) setFrostedExtra(true);
                  if (preset === 'single' && !config.glassThickness) setConfig('glassThickness', 6);
                }}
                className={`rounded-md px-2 py-1 text-[11px] ring-1 ${
                  config.glassType === t ? 'bg-indigo-600 text-white ring-indigo-400' : 'bg-slate-700 text-slate-200 ring-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="mb-3 flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              id={`${idPrefix}homeowner-frosted-extra`}
              checked={frostedExtra}
              onChange={(e) => {
                setFrostedExtra(e.target.checked);
                if (e.target.checked) setConfig('glassType', GlassType.FROSTED);
                persistDefaults({ frostedExtra: e.target.checked });
              }}
            />
            Frosting extra (+₹{rates.glassPerSqFt.extras?.frostingExtraPerSqFt ?? 45}/sft)
          </label>
          <p className="mb-2 text-xs font-semibold text-slate-200">Profile color</p>
          <div className="flex flex-wrap gap-2">
            {quickColors.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.name}
                onClick={() => {
                  setConfig('profileColor', c.value);
                  persistDefaults({ profileColor: c.value });
                }}
                className="h-10 w-10 rounded-md ring-2"
                style={{
                  backgroundColor: c.value,
                  borderColor: config.profileColor === c.value ? '#6366f1' : 'transparent',
                }}
              />
            ))}
          </div>
        </CollapsibleCard>
      )}
    </>
  );
}
