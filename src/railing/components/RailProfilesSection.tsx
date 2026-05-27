import {
  BOTTOM_RAIL_PROFILE_OPTIONS,
  HANDRAIL_PROFILE_OPTIONS,
  PROFILE_OTHER,
} from '../constants'
import type { DesignDraft, SegmentGlassConfig } from '../types'

interface Props {
  draft: DesignDraft
  activeConfigs: SegmentGlassConfig[]
  showHandrail: boolean
  showBottomRail: boolean
  onChange: (draft: DesignDraft) => void
}

function ProfileSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (v: string) => void
}) {
  const isPreset = options.includes(value)
  const selectValue = isPreset ? value : PROFILE_OTHER

  return (
    <div className="profile-select-block">
      <label className="field">
        <span>{label}</span>
        <select
          value={selectValue}
          onChange={(e) => {
            const v = e.target.value
            if (v === PROFILE_OTHER) {
              if (isPreset) onChange('')
            } else {
              onChange(v)
            }
          }}
        >
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value={PROFILE_OTHER}>Other (custom)…</option>
        </select>
      </label>
      {selectValue === PROFILE_OTHER && (
        <label className="field">
          <span>Custom type</span>
          <input
            type="text"
            placeholder="Type profile name…"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      )}
    </div>
  )
}

export function RailProfilesSection({
  draft,
  activeConfigs,
  showHandrail,
  showBottomRail,
  onChange,
}: Props) {
  const patch = (p: Partial<DesignDraft>) => onChange({ ...draft, ...p })

  const applyHandrailToAll = (profile: string) => {
    patch({
      finish: { ...draft.finish, handrailProfile: profile },
      segmentConfigs: draft.segmentConfigs.map((c) => ({
        ...c,
        handrailProfile: profile,
      })),
    })
  }

  const applyBottomRailToAll = (profile: string) => {
    patch({
      finish: { ...draft.finish, bottomRailProfile: profile },
      segmentConfigs: draft.segmentConfigs.map((c) => ({
        ...c,
        bottomRailProfile: profile,
      })),
    })
  }

  const updateSegProfile = (
    key: string,
    field: 'handrailProfile' | 'bottomRailProfile',
    value: string,
  ) => {
    patch({
      segmentConfigs: draft.segmentConfigs.map((c) =>
        c.key === key ? { ...c, [field]: value } : c,
      ),
    })
  }

  const multiLeg = activeConfigs.length > 1

  return (
    <div className="rail-profiles-section">
      <p className="section-desc">
        Choose a default profile type below, then use <strong>Apply to all sides</strong> to set
        every leg at once — or set each leg separately.
      </p>

      {showHandrail && (
        <div className="profile-group">
          <h4 className="profile-group-title">Handrail type</h4>
          <ProfileSelect
            label="Default handrail (all sides)"
            value={draft.finish.handrailProfile}
            options={HANDRAIL_PROFILE_OPTIONS}
            onChange={(v) => {
              const prev = draft.finish.handrailProfile
              patch({
                finish: { ...draft.finish, handrailProfile: v },
                segmentConfigs: draft.segmentConfigs.map((c) =>
                  !c.handrailProfile || c.handrailProfile === prev
                    ? { ...c, handrailProfile: v }
                    : c,
                ),
              })
            }}
          />
          <button
            type="button"
            className="btn-apply-all"
            onClick={() => applyHandrailToAll(draft.finish.handrailProfile)}
          >
            Apply handrail to all sides
          </button>

          {multiLeg && (
            <div className="per-leg-profiles">
              <p className="hint">Per leg (optional — alag type)</p>
              {activeConfigs.map((cfg) => (
                <div key={cfg.key} className="per-leg-row">
                  <span className="per-leg-label">{cfg.label}</span>
                  <ProfileSelect
                    label=""
                    value={cfg.handrailProfile}
                    options={HANDRAIL_PROFILE_OPTIONS}
                    onChange={(v) => updateSegProfile(cfg.key, 'handrailProfile', v)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showBottomRail && (
        <div className="profile-group">
          <h4 className="profile-group-title">Bottom rail / channel type</h4>
          <ProfileSelect
            label="Default bottom rail (all sides)"
            value={draft.finish.bottomRailProfile}
            options={BOTTOM_RAIL_PROFILE_OPTIONS}
            onChange={(v) => {
              const prev = draft.finish.bottomRailProfile
              patch({
                finish: { ...draft.finish, bottomRailProfile: v },
                segmentConfigs: draft.segmentConfigs.map((c) =>
                  !c.bottomRailProfile || c.bottomRailProfile === prev
                    ? { ...c, bottomRailProfile: v }
                    : c,
                ),
              })
            }}
          />
          <button
            type="button"
            className="btn-apply-all"
            onClick={() => applyBottomRailToAll(draft.finish.bottomRailProfile)}
          >
            Apply bottom rail to all sides
          </button>

          {multiLeg && (
            <div className="per-leg-profiles">
              <p className="hint">Per leg (optional)</p>
              {activeConfigs.map((cfg) => (
                <div key={cfg.key} className="per-leg-row">
                  <span className="per-leg-label">{cfg.label}</span>
                  <ProfileSelect
                    label=""
                    value={cfg.bottomRailProfile}
                    options={BOTTOM_RAIL_PROFILE_OPTIONS}
                    onChange={(v) => updateSegProfile(cfg.key, 'bottomRailProfile', v)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
