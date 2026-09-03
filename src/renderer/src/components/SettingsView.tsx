import { useEffect, useMemo, useState } from "react";
import type { DragEvent, JSX, ReactNode } from "react";
import { i18n, LANGUAGE_OPTIONS, resolveLanguage } from "../../../shared/i18n";
import { OUTFIT_SLOTS, seasonalOutfitForDate, seasonalOutfitsForDate } from "../../../shared/outfits";
import {
  hasRequiredCustomPetAssets,
  PET_STATE_ORDER,
  petAppearanceOptions,
  REQUIRED_CUSTOM_PET_STATES,
  resolveBuiltInPetAppearanceId,
  resolvePetAppearanceId
} from "../../../shared/petAppearances";
import type {
  BuiltInPetAppearanceId,
  CustomPetAppearance,
  CustomPetAsset,
  DemoTrigger,
  MoodSample,
  PetGrowth,
  PetMood,
  PetState,
  Settings
} from "../../../shared/types";
import { createEmptyStats } from "../../../shared/constants";
import {
  ALL_MILESTONE_IDS,
  daysKnown,
  eligibleMilestoneIds,
  GROWTH_STAGES,
  healthTotals,
  kindOfMilestone,
  stageRank
} from "../../../shared/growth";
import { getPetAsset } from "../assets";
import { distractionHelp, formatDistractionState, formatTimer, formatTimestamp, localeFor } from "../format";
import { useNow, useSnapshot } from "../hooks";

type SettingsCopy = ReturnType<typeof i18n>["settings"];

function Row({
  label,
  hint,
  control
}: {
  label: string;
  hint?: string;
  control: JSX.Element;
}): JSX.Element {
  return (
    <div className="pref-row">
      <div className="pref-row__label">
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </div>
      <div className="pref-row__control">{control}</div>
    </div>
  );
}

function ToggleControl({
  checked,
  onChange,
  ariaLabel
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`pref-toggle${checked ? " is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="pref-toggle__thumb" />
    </button>
  );
}

function NumberControl({
  value,
  min,
  max,
  unit,
  onChange
}: {
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (next: number) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commitDraft(raw: string): void {
    const next = Number(raw);
    if (!Number.isFinite(next)) {
      setDraft(String(value));
      return;
    }

    const normalized = Math.min(max, Math.max(min, Math.round(next)));
    setDraft(String(normalized));
    onChange(normalized);
  }

  function step(next: number): void {
    const normalized = Math.min(max, Math.max(min, next));
    setDraft(String(normalized));
    onChange(normalized);
  }

  return (
    <div className="pref-stepper">
      <button
        type="button"
        className="pref-stepper__btn"
        aria-label="−"
        disabled={value <= min}
        onClick={() => step(value - 1)}
      >
        −
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(event) => {
          const nextDraft = event.target.value;
          setDraft(nextDraft);

          const next = Number(nextDraft);
          if (Number.isFinite(next) && next >= min && next <= max) {
            onChange(Math.round(next));
          }
        }}
        onBlur={() => commitDraft(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
      <span className="pref-stepper__unit">{unit}</span>
      <button
        type="button"
        className="pref-stepper__btn"
        aria-label="+"
        disabled={value >= max}
        onClick={() => step(value + 1)}
      >
        +
      </button>
    </div>
  );
}

function SelectControl({
  value,
  options,
  onChange
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}): JSX.Element {
  return (
    <select className="pref-select" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function ChipsControl({
  value,
  onChange,
  labels
}: {
  value: string[];
  onChange: (next: string[]) => void;
  labels: SettingsCopy;
}): JSX.Element {
  const [draft, setDraft] = useState("");

  function commit(raw: string): void {
    const trimmed = raw.trim().replace(/,$/, "").trim();
    if (!trimmed) return;
    if (value.some((entry) => entry.toLowerCase() === trimmed.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...value, trimmed]);
    setDraft("");
  }

  return (
    <div className="pref-chips">
      <div className="pref-chips__list">
        {value.map((entry) => (
          <span key={entry} className="pref-chip">
            {entry}
            <button
              type="button"
              aria-label={labels.removeListItem(entry)}
              onClick={() => onChange(value.filter((item) => item !== entry))}
            >
              ×
            </button>
          </span>
        ))}
        <input
          className="pref-chips__input"
          placeholder={labels.addListItem}
          value={draft}
          onChange={(event) => {
            const next = event.target.value;
            if (next.endsWith(",")) commit(next);
            else setDraft(next);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(draft);
            }
            if (event.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => commit(draft)}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit
}: {
  label: string;
  value: number;
  unit?: string;
}): JSX.Element {
  return (
    <div className="stat-card">
      <span className="stat-card__label">{label}</span>
      <strong className="stat-card__value">
        {value}
        {unit ? <small>{unit}</small> : null}
      </strong>
    </div>
  );
}

function updateCustomPetAsset(
  customPetAppearance: CustomPetAppearance | null,
  state: PetState,
  asset: CustomPetAsset,
  name: string
): CustomPetAppearance {
  return {
    name: customPetAppearance?.name ?? name,
    assets: {
      ...customPetAppearance?.assets,
      [state]: asset
    }
  };
}

function throwRandomBall(): void {
  if (!window.pawpal) return;
  // Throw roughly toward the screen center plus a random offset,
  // picked within a 600x400 region so the ball lands on the desktop.
  const cx = Math.round(window.innerWidth / 2 + (Math.random() - 0.5) * 600);
  const cy = Math.round(window.innerHeight / 2 + (Math.random() - 0.5) * 400);
  window.pawpal.petPlayCatch(cx, cy);
}

function RosterPanel({ labels }: { labels: SettingsCopy }): JSX.Element {
  const snapshot = useSnapshot();
  const [newLabel, setNewLabel] = useState("");
  const roster = snapshot.petRoster;
  const activeId = roster?.activePetId ?? snapshot.activePetId;

  async function handleSwitch(petId: string): Promise<void> {
    if (petId === activeId) return;
    await window.pawpal.switchPet(petId);
  }

  async function handleAdd(): Promise<void> {
    const label = newLabel.trim();
    await window.pawpal.addPet(label);
    setNewLabel("");
  }

  async function handleRemove(petId: string): Promise<void> {
    if ((roster?.pets.length ?? 0) <= 1) return;
    await window.pawpal.removePet(petId);
  }

  return (
    <section className="prefs__group">
      <h2 className="prefs__group-title">{labels.roster}</h2>
      <div className="roster-list">
        {(roster?.pets ?? []).map((pet) => {
          const isActive = pet.id === activeId;
          return (
            <div
              key={pet.id}
              className={`roster-row ${isActive ? "is-active" : ""}`}
            >
              <div className="roster-row__main">
                <span className="roster-row__label">{pet.label}</span>
                {isActive ? (
                  <span className="roster-row__active-tag">{labels.rosterActive}</span>
                ) : null}
              </div>
              <div className="roster-row__actions">
                {isActive ? null : (
                  <button
                    type="button"
                    className="pref-chip-button"
                    onClick={() => void handleSwitch(pet.id)}
                  >
                    {labels.rosterSwitch}
                  </button>
                )}
                {(roster?.pets.length ?? 0) > 1 ? (
                  <button
                    type="button"
                    className="pref-chip-button is-danger"
                    onClick={() => void handleRemove(pet.id)}
                  >
                    {labels.rosterRemove}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <Row
        label={labels.rosterAddLabel}
        control={
          <div className="pref-input-row">
            <input
              type="text"
              className="pref-input"
              value={newLabel}
              placeholder={labels.rosterAddPlaceholder}
              onChange={(event) => setNewLabel(event.target.value)}
            />
            <button
              type="button"
              className="pref-chip-button is-primary"
              onClick={() => void handleAdd()}
            >
              {labels.rosterAdd}
            </button>
          </div>
        }
      />
    </section>
  );
}

// mood ordinal y-position (top -> bottom): energetic 0, playful 1, calm 2, bored 3, sleepy 4
const MOOD_Y_INDEX: Record<PetMood, number> = {
  energetic: 0,
  playful: 1,
  calm: 2,
  bored: 3,
  sleepy: 4
};

const MOOD_CHART_WIDTH = 320;
const MOOD_CHART_HEIGHT = 80;

function MoodChart({ samples, labels }: { samples: MoodSample[]; labels: SettingsCopy }): JSX.Element {
  if (samples.length === 0) {
    return <p className="pref-hint">—</p>;
  }
  // bucket: x = ((bucket - firstBucket) / totalSpan) * width, clamped 0..width
  const first = samples[0].bucket;
  const last = samples[samples.length - 1].bucket;
  const totalSpan = Math.max(1, last - first);
  const xOf = (bucket: number): number =>
    Math.max(0, Math.min(MOOD_CHART_WIDTH, ((bucket - first) / totalSpan) * MOOD_CHART_WIDTH));
  const yOf = (mood: PetMood): number => {
    const idx = MOOD_Y_INDEX[mood] ?? 2;
    return (idx / 4) * MOOD_CHART_HEIGHT;
  };
  const points = samples
    .map((s) => `${xOf(s.bucket).toFixed(1)},${yOf(s.mood).toFixed(1)}`)
    .join(" ");
  const latest = samples[samples.length - 1];
  return (
    <div className="mood-chart">
      <svg
        viewBox={`0 0 ${MOOD_CHART_WIDTH} ${MOOD_CHART_HEIGHT}`}
        width={MOOD_CHART_WIDTH}
        height={MOOD_CHART_HEIGHT}
        aria-label="pet mood over time"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <line
            key={i}
            x1={0}
            x2={MOOD_CHART_WIDTH}
            y1={(i / 4) * MOOD_CHART_HEIGHT}
            y2={(i / 4) * MOOD_CHART_HEIGHT}
            stroke="rgba(60, 47, 28, 0.08)"
            strokeWidth={1}
          />
        ))}
        {samples.length > 1 ? (
          <polyline
            fill="none"
            stroke="rgba(74, 144, 226, 0.7)"
            strokeWidth={1.6}
            points={points}
          />
        ) : null}
        {samples.map((s, idx) => (
          <circle
            key={idx}
            cx={xOf(s.bucket)}
            cy={yOf(s.mood)}
            r={idx === samples.length - 1 ? 2.6 : 1.6}
            fill={idx === samples.length - 1 ? "#4a90e2" : "rgba(74, 144, 226, 0.55)"}
          />
        ))}
      </svg>
      <p className="mood-chart__legend">
        {labels.petMoods[latest.mood]} · {new Date(latest.bucket).getHours()}:00
      </p>
    </div>
  );
}

function MoodPanel({ labels }: { labels: SettingsCopy }): JSX.Element {
  const snapshot = useSnapshot();
  const samples = snapshot.petMoodHistory?.samples ?? [];
  return (
    <section className="prefs__group">
      <h2 className="prefs__group-title">{labels.moodChart}</h2>
      <Row
        label={labels.moodChart}
        hint={labels.moodChartHint}
        control={<MoodChart samples={samples} labels={labels} />}
      />
    </section>
  );
}

function SnapshotPanel({ labels }: { labels: SettingsCopy }): JSX.Element {
  const [status, setStatus] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const [path, setPath] = useState<string>("");

  async function handleExport(): Promise<void> {
    setStatus("busy");
    setPath("");
    const result = await window.pawpal.exportSnapshot();
    if (result) {
      setStatus("ok");
      setPath(result);
    } else {
      setStatus("idle");
    }
  }

  return (
    <section className="prefs__group">
      <h2 className="prefs__group-title">{labels.snapshot}</h2>
      <Row
        label={labels.snapshotExport}
        control={
          <div className="pref-button-group">
            <button
              type="button"
              className="pref-button is-primary"
              disabled={status === "busy"}
              onClick={() => void handleExport()}
            >
              {labels.snapshotExport}
            </button>
            {path ? (
              <span className="pref-status is-ok">✓ {path.split("/").pop()}</span>
            ) : null}
          </div>
        }
      />
    </section>
  );
}

function BackupPanel({ labels }: { labels: SettingsCopy }): JSX.Element {
  const [status, setStatus] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const [message, setMessage] = useState<string>("");

  async function handleExport(): Promise<void> {
    setStatus("busy");
    setMessage("");
    const result = await window.pawpal.exportBackup();
    if (result) {
      setStatus("ok");
      setMessage(result);
    } else {
      setStatus("idle");
    }
  }

  async function handleImport(mode: "merge" | "replace"): Promise<void> {
    setStatus("busy");
    setMessage("");
    const parent = window.pawpal;
    const { dialog } = await import("electron").catch(() => ({ dialog: undefined as never }));
    void parent;
    void dialog;
    // We don't have a synchronous file-pick API in the preload bridge;
    // instead, route through a hidden input. Fallback: ask user to
    // type a path. We add a minimal file-pick via a temporary input
    // element.
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.display = "none";
    document.body.appendChild(input);
    input.click();
    const file = await new Promise<File | null>((resolve) => {
      input.addEventListener(
        "change",
        () => {
          resolve(input.files?.[0] ?? null);
        },
        { once: true }
      );
      input.addEventListener(
        "cancel",
        () => {
          resolve(null);
        },
        { once: true }
      );
    });
    document.body.removeChild(input);
    if (!file) {
      setStatus("idle");
      return;
    }
    const result = await window.pawpal.importBackup(window.pawpal.pathForFile(file), mode);
    if (result.ok) {
      setStatus("ok");
      setMessage(labels.backupImported);
    } else {
      setStatus("err");
      setMessage(result.message);
    }
  }

  return (
    <section className="prefs__group">
      <h2 className="prefs__group-title">{labels.backup}</h2>
      <Row
        label={labels.backupExport}
        hint={labels.backupExportHint}
        control={
          <div className="pref-button-group">
            <button
              type="button"
              className="pref-button"
              disabled={status === "busy"}
              onClick={() => void handleExport()}
            >
              {labels.backupExport}
            </button>
          </div>
        }
      />
      <Row
        label={labels.backupImport}
        control={
          <div className="pref-button-group">
            <button
              type="button"
              className="pref-button"
              disabled={status === "busy"}
              onClick={() => void handleImport("merge")}
            >
              {labels.backupImportMerge}
            </button>
            <button
              type="button"
              className="pref-button is-danger"
              disabled={status === "busy"}
              onClick={() => void handleImport("replace")}
            >
              {labels.backupImportReplace}
            </button>
          </div>
        }
      />
      {message ? (
        <p className={`pref-hint ${status === "err" ? "is-error" : "is-ok"}`}>{message}</p>
      ) : null}
    </section>
  );
}

function GrowthPanel({ labels }: { labels: SettingsCopy }): JSX.Element {
  const snapshot = useSnapshot();
  const now = useNow(60_000);
  const growth = snapshot.petGrowth;
  const safeGrowth: PetGrowth = growth ?? {
    bornAt: 0,
    totalInteractions: 0,
    lastMilestone: null,
    stage: "acquaintance",
    stageChangedAt: null,
    milestones: []
  };
  const language = snapshot.settings.language;
  const days = daysKnown(safeGrowth.bornAt, now);
  const totals = healthTotals(
    snapshot.stats ?? createEmptyStats(),
    snapshot.statsHistory ?? {}
  );
  const eligible = eligibleMilestoneIds(safeGrowth, totals, now);
  const unlockedAt = new Map<string, number>(
    safeGrowth.milestones.map((m) => [m.id, m.unlockedAt])
  );
  const nextDef = GROWTH_STAGES[stageRank(safeGrowth.stage) + 1] ?? null;
  const progressPercent = nextDef
    ? Math.min(
        100,
        Math.round(
          Math.min(
            days / nextDef.requireDays,
            safeGrowth.totalInteractions / nextDef.requireInteractions
          ) * 100
        )
      )
    : 100;
  const totalMilestones = ALL_MILESTONE_IDS.length;

  return (
    <section className="prefs__group">
      <h2 className="prefs__group-title">{labels.growth}</h2>

      <div className="growth-stage">
        <div className="growth-stage__head">
          <span className="growth-stage__name">{labels.growthStageName[safeGrowth.stage]}</span>
          <span className="growth-stage__meta">
            {days <= 0 ? labels.growthAgeDaysOne : labels.growthAgeDays(days)} ·{" "}
            {labels.growthInteractions(safeGrowth.totalInteractions)}
          </span>
        </div>
        <p className="growth-stage__desc">{labels.growthStageDesc[safeGrowth.stage]}</p>
        {nextDef ? (
          <div className="growth-stage__progress">
            <div className="growth-stage__bar">
              <div
                className="growth-stage__bar-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <small>
              {labels.growthNextStage}：{labels.growthStageName[nextDef.id]} ·{" "}
              {labels.growthStageNeedsDaysAndInteractions(
                Math.max(0, nextDef.requireDays - days),
                Math.max(0, nextDef.requireInteractions - safeGrowth.totalInteractions)
              )}
            </small>
          </div>
        ) : (
          <small className="growth-stage__max">{labels.growthStageMax}</small>
        )}
      </div>

      <h3 className="prefs__group-subtitle">
        <span>{labels.growthMilestones}</span>
        <span className="pref-hint">
          {labels.growthMilestoneCount(safeGrowth.milestones.length, totalMilestones)}
        </span>
      </h3>
      <ul className="growth-milestones">
        {ALL_MILESTONE_IDS.map((id) => {
          const kind = kindOfMilestone(id);
          const value = Number(id.slice(id.indexOf("-") + 1));
          const label =
            kind === "age"
              ? labels.growthMilestoneAge(value)
              : kind === "interaction"
                ? labels.growthMilestoneInteractions(value)
                : id.startsWith("breaks-")
                  ? labels.growthMilestoneBreaks(value)
                  : id.startsWith("waters-")
                    ? labels.growthMilestoneWaters(value)
                    : labels.growthMilestoneFocus(value);
          const unlocked = unlockedAt.get(id);
          return (
            <li
              key={id}
              className={`growth-milestones__item${unlocked ? " growth-milestones__item--unlocked" : ""}`}
            >
              <span className="growth-milestones__label">{label}</span>
              <span className="growth-milestones__meta">
                {unlocked
                  ? `${labels.growthUnlockedAt} ${formatTimestamp(unlocked, language, labels)}`
                  : labels.growthLocked}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DiaryPanel({ labels }: { labels: SettingsCopy }): JSX.Element {
  const snapshot = useSnapshot();
  const [generating, setGenerating] = useState(false);

  async function handleGenerate(): Promise<void> {
    setGenerating(true);
    try {
      await window.pawpal.generateDiary();
    } finally {
      setGenerating(false);
    }
  }

  const entries = snapshot.petDiary?.entries ?? [];

  return (
    <section className="prefs__group">
      <h2 className="prefs__group-title">{labels.diary}</h2>
      <Row
        label={labels.diary}
        control={
          <button
            type="button"
            className="pref-button"
            disabled={generating}
            onClick={() => void handleGenerate()}
          >
            {generating ? labels.diaryGenerating : labels.diaryGenerate}
          </button>
        }
      />
      {entries.length === 0 ? (
        <p className="pref-hint">{labels.diaryEmpty}</p>
      ) : (
        <div className="diary-list">
          {entries.map((entry) => (
            <article key={entry.date} className="diary-entry">
              <header className="diary-entry__meta">
                <span className="diary-entry__date">{entry.date}</span>
                <span
                  className={`diary-entry__source diary-entry__source--${entry.source}`}
                >
                  {entry.source === "ai" ? labels.diarySourceAi : labels.diarySourceFallback}
                </span>
              </header>
              <p className="diary-entry__body">{entry.body}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function AiSettingsPanel({
  labels,
  draft,
  updateDraft
}: {
  labels: SettingsCopy;
  draft: Settings;
  updateDraft: (partial: Partial<Settings>) => void;
}): JSX.Element {
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState<null | true | false>(null);
  const [testMessage, setTestMessage] = useState<string>("");

  async function handleTest(): Promise<void> {
    setTesting(null);
    const result = await window.pawpal.aiTestConnection();
    setTesting(result.ok);
    setTestMessage(result.message);
  }

  return (
    <section className="prefs__group">
      <h2 className="prefs__group-title">{labels.ai}</h2>
      <Row
        label={labels.aiProvider}
        hint={labels.aiProviderHelp}
        control={
          <SelectControl
            value={draft.aiProvider}
            options={[
              { value: "none", label: labels.aiProviderNone },
              { value: "deepseek", label: labels.aiProviderDeepseek },
              { value: "ollama", label: labels.aiProviderOllama }
            ]}
            onChange={(value) => updateDraft({ aiProvider: value as Settings["aiProvider"] })}
          />
        }
      />
      <Row
        label={draft.aiProvider === "ollama" ? labels.aiOllamaUrl : labels.aiApiKey}
        hint={
          draft.aiProvider === "ollama"
            ? labels.aiOllamaUrlHint
            : undefined
        }
        control={
          <div className="pref-input-row">
            <input
              type={showKey ? "text" : "password"}
              className="pref-input"
              value={draft.aiApiKey}
              placeholder={
                draft.aiProvider === "ollama"
                  ? labels.aiOllamaUrlPlaceholder
                  : labels.aiApiKeyPlaceholder
              }
              onChange={(event) => updateDraft({ aiApiKey: event.target.value })}
            />
            <button
              type="button"
              className="pref-chip-button"
              onClick={() => setShowKey((value) => !value)}
            >
              {showKey ? "🙈" : "👁"}
            </button>
          </div>
        }
      />
      <Row
        label={labels.aiTestConnection}
        control={
          <div className="pref-button-group">
            <button
              type="button"
              className="pref-button"
              disabled={testing === null}
              onClick={() => void handleTest()}
            >
              {testing === null ? labels.aiTestConnection : labels.aiTesting}
            </button>
            {testing !== null && testMessage ? (
              <span className={`pref-status ${testing ? "is-ok" : "is-error"}`}>
                {testMessage}
              </span>
            ) : null}
          </div>
        }
      />
    </section>
  );
}

function removeCustomPetState(
  customPetAppearance: CustomPetAppearance | null,
  state: PetState,
  name: string
): CustomPetAppearance | null {
  if (!customPetAppearance) return null;
  const { [state]: _removed, ...assets } = customPetAppearance.assets;
  if (Object.keys(assets).length === 0) return null;
  return {
    name: customPetAppearance.name || name,
    assets
  };
}

function BirthdayRow({
  labels,
  draft,
  updateDraft
}: {
  labels: SettingsCopy;
  draft: Settings;
  updateDraft: (partial: Partial<Settings>) => void;
}): JSX.Element {
  const month = draft.birthdayMonth ?? 0;
  const day = draft.birthdayDay ?? 0;
  const dayMax = month >= 1 && month <= 12 ? new Date(2024, month, 0).getDate() : 31;
  return (
    <Row
      label={labels.birthday}
      hint={labels.birthdayHint}
      control={
        <div className="pref-input-row">
          <select
            className="pref-input"
            value={month || 0}
            onChange={(event) => {
              const next = Number(event.target.value);
              updateDraft({
                birthdayMonth: next > 0 ? next : null,
                birthdayDay:
                  next > 0 && (draft.birthdayDay ?? 0) > new Date(2024, next, 0).getDate()
                    ? null
                    : draft.birthdayDay
              });
            }}
          >
            <option value={0}>—</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <span>/</span>
          <select
            className="pref-input"
            value={day || 0}
            onChange={(event) => {
              const next = Number(event.target.value);
              updateDraft({ birthdayDay: next > 0 ? next : null });
            }}
          >
            <option value={0}>—</option>
            {Array.from({ length: dayMax }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      }
    />
  );
}

function OutfitPicker({
  labels,
  draft,
  updateDraft
}: {
  labels: SettingsCopy;
  draft: Settings;
  updateDraft: (partial: Partial<Settings>) => void;
}): JSX.Element | null {
  const now = new Date();
  const seasonalCollection = seasonalOutfitsForDate(now);
  const seasonal = seasonalOutfitForDate(now);
  const isAuto = draft.outfitMode === "seasonal";
  const [customOutfits, setCustomOutfits] = useState<
    Array<{ id: string; part: string; label: Record<string, string>; relativePath: string }>
  >([]);

  useEffect(() => {
    void window.pawpal.listCustomOutfits().then(setCustomOutfits);
  }, []);

  async function handleAddCustom(part: string): Promise<void> {
    const sourcePath = await window.pawpal.selectOutfitFile(part as never);
    if (!sourcePath) return;
    const item = await window.pawpal.importOutfit(part as never, sourcePath, "");
    if (!item) return;
    setCustomOutfits((prev) => [
      ...prev,
      { id: item.id, part: item.part, label: item.label, relativePath: item.relativePath }
    ]);
    updateDraft({ outfit: { ...draft.outfit, [part]: item.id } });
  }
  return (
    <section className="prefs__group">
      <h2 className="prefs__group-title">{labels.outfit}</h2>
      <Row
        label={labels.outfitMode}
        hint={
          isAuto && seasonalCollection && seasonal
            ? labels.outfitSeasonalVariant(seasonal.label[draft.language], seasonalCollection.outfits.length)
            : isAuto
              ? labels.outfitModeHint
              : labels.outfitSeasonalNow(seasonalCollection?.label[draft.language] ?? labels.none)
        }
        control={
          <div className="pref-chip-group">
            <button
              type="button"
              className={`pref-chip-button ${isAuto ? "is-active" : ""}`}
              onClick={() => updateDraft({ outfitMode: "seasonal" })}
            >
              {labels.outfitModeAuto}
            </button>
            <button
              type="button"
              className={`pref-chip-button ${!isAuto ? "is-active" : ""}`}
              onClick={() => updateDraft({ outfitMode: "manual" })}
            >
              {labels.outfitModeManual}
            </button>
          </div>
        }
      />
      {!isAuto
        ? OUTFIT_SLOTS.map((slot) => (
            <Row
              key={slot.part}
              label={slot.label[draft.language]}
              control={
                <div className="pref-chip-group">
                  <button
                    type="button"
                    className={`pref-chip-button ${draft.outfit[slot.part] === undefined ? "is-active" : ""}`}
                    onClick={() => {
                      const outfit = { ...draft.outfit };
                      delete outfit[slot.part];
                      updateDraft({ outfit });
                    }}
                  >
                    {labels.outfitNone}
                  </button>
                  {slot.items.map((item) => {
                    const isActive = draft.outfit[slot.part] === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`pref-chip-button ${isActive ? "is-active" : ""}`}
                        onClick={() =>
                          updateDraft({
                            outfit: { ...draft.outfit, [slot.part]: item.id }
                          })
                        }
                      >
                        {item.label[draft.language]}
                      </button>
                    );
                  })}
                  {customOutfits
                    .filter((item) => item.part === slot.part)
                    .map((item) => {
                      const isActive = draft.outfit[slot.part] === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`pref-chip-button ${isActive ? "is-active" : ""}`}
                          onClick={() =>
                            updateDraft({
                              outfit: { ...draft.outfit, [slot.part]: item.id }
                            })
                          }
                        >
                          {item.label[draft.language]}
                        </button>
                      );
                    })}
                  <button
                    type="button"
                    className="pref-chip-button"
                    onClick={() => void handleAddCustom(slot.part)}
                  >
                    {labels.outfitUploadCustom}
                  </button>
                </div>
              }
            />
          ))
        : null}
    </section>
  );
}

function customPetStateKind(state: PetState, labels: SettingsCopy): string {
  return REQUIRED_CUSTOM_PET_STATES.includes(state)
    ? labels.customPetRequired
    : labels.customPetOptional;
}

function customPetStateKindClass(state: PetState): string {
  return REQUIRED_CUSTOM_PET_STATES.includes(state) ? " is-required" : "";
}

function customPetAssetPreviewSrc(asset: CustomPetAsset): string {
  return new URL(window.pawpal.assetUrl(asset.relativePath)).href;
}

export function SettingsView(): JSX.Element {
  const snapshot = useSnapshot();
  const { settings, stats } = snapshot;
  const [draft, setDraft] = useState(settings);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [customEditorOpen, setCustomEditorOpen] = useState(settings.petAppearanceId === "custom");
  const now = useNow();
  const savedSettingsKey = JSON.stringify(settings);
  const language = resolveLanguage(draft.language);
  const labels = i18n(language).settings;
  const customPetReady = hasRequiredCustomPetAssets(draft.customPetAppearance);

  const petAvatar = useMemo(
    () =>
      getPetAsset(
        resolvePetAppearanceId(draft.petAppearanceId),
        "happy",
        0,
        0,
        draft.customPetAppearance
      ),
    [draft.customPetAppearance, draft.petAppearanceId]
  );

  useEffect(() => {
    setDraft(settings);
    setSettingsDirty(false);
    if (settings.petAppearanceId === "custom") setCustomEditorOpen(true);
  }, [savedSettingsKey, settings]);

  useEffect(() => {
    if (!settingsDirty) return;
    const timer = window.setTimeout(() => {
      window.pawpal.updateSettings(draft);
      setSettingsDirty(false);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, settingsDirty]);

  function updateDraft(partial: Partial<Settings>): void {
    setDraft((current) => ({ ...current, ...partial }));
    setSettingsDirty(true);
  }

  async function uploadCustomPetAsset(state: PetState): Promise<void> {
    const asset = await window.pawpal.selectCustomPetAsset(state);
    if (!asset) return;
    applyCustomPetAsset(state, asset);
  }

  async function uploadDroppedCustomPetAsset(state: PetState, file: File): Promise<void> {
    if (!file.name.toLowerCase().endsWith(".gif")) return;
    const sourcePath = window.pawpal.pathForFile(file);
    if (!sourcePath) return;
    const asset = await window.pawpal.importCustomPetAsset(state, sourcePath);
    if (!asset) return;
    applyCustomPetAsset(state, asset);
  }

  function applyCustomPetAsset(state: PetState, asset: CustomPetAsset): void {
    setCustomEditorOpen(true);
    const customPetAppearance = updateCustomPetAsset(
      draft.customPetAppearance,
      state,
      asset,
      labels.customPet
    );
    updateDraft({
      customPetAppearance,
      petAppearanceId: hasRequiredCustomPetAssets(customPetAppearance)
        ? "custom"
        : draft.petAppearanceId
    });
  }

  function removeCustomPetAsset(state: PetState): void {
    const customPetAppearance = removeCustomPetState(draft.customPetAppearance, state, labels.customPet);
    updateDraft({
      customPetAppearance,
      petAppearanceId:
        draft.petAppearanceId === "custom" && !hasRequiredCustomPetAssets(customPetAppearance)
          ? "lineDog"
          : draft.petAppearanceId
    });
  }

  return (
    <main className="prefs">
      <header className="prefs__head">
        <img className="prefs__avatar" src={petAvatar.src} alt="" />
        <div className="prefs__intro">
          <p className="prefs__eyebrow">PawPal</p>
          <h1 className="prefs__title">{labels.today}</h1>
        </div>
      </header>

      <section className="prefs__stats" aria-label={labels.today}>
        <StatCard label={labels.breaks} value={stats.breaksTaken} unit={labels.countUnit} />
        <StatCard label={labels.waters} value={stats.watersLogged} unit={labels.countUnit} />
        <StatCard label={labels.focusMin} value={stats.focusMinutes} unit={labels.minuteUnit} />
        <StatCard label={labels.warnings} value={stats.focusWarnings} unit={labels.countUnit} />
      </section>

      {!draft.onboardingDismissed ? (
        <aside className="prefs__welcome">
          <p>
            <strong>{labels.welcomeTitle}.</strong> {labels.welcomeCopy}
          </p>
          <button
            type="button"
            className="text-link"
            onClick={() => updateDraft({ onboardingDismissed: true })}
          >
            {labels.dismissWelcome}
          </button>
        </aside>
      ) : null}

      <section className="prefs__group">
        <h2 className="prefs__group-title">{labels.appearance}</h2>
        <Row
          label={labels.language}
          control={
            <SelectControl
              value={language}
              options={[...LANGUAGE_OPTIONS]}
              onChange={(value) => updateDraft({ language: resolveLanguage(value) })}
            />
          }
        />
        <div className="pref-block">
          <span className="pref-block__label">{labels.petAppearance}</span>
          <div className="pet-picker">
            {petAppearanceOptions(language).map((option) => (
              <PetCard
                key={option.value}
                appearanceId={option.value}
                label={option.label}
                selected={
                  !customEditorOpen &&
                  draft.petAppearanceId !== "custom" &&
                  resolveBuiltInPetAppearanceId(draft.petAppearanceId) === option.value
                }
                onSelect={() => {
                  setCustomEditorOpen(false);
                  updateDraft({ petAppearanceId: resolvePetAppearanceId(option.value) });
                }}
              />
            ))}
            <PetCard
              label={labels.customPet}
              previewSrc={
                customPetReady
                  ? getPetAsset("custom", "idle", 0, 0, draft.customPetAppearance).src
                  : undefined
              }
              selected={customEditorOpen || draft.petAppearanceId === "custom"}
              onSelect={() => {
                setCustomEditorOpen(true);
                if (customPetReady) updateDraft({ petAppearanceId: "custom" });
              }}
            />
          </div>
        </div>
        {customEditorOpen ? (
          <CustomPetEditor
            customPetAppearance={draft.customPetAppearance}
            labels={labels}
            onDrop={uploadDroppedCustomPetAsset}
            onRemove={removeCustomPetAsset}
            onUpload={(state) => void uploadCustomPetAsset(state)}
          />
        ) : null}
      </section>

      <OutfitPicker labels={labels} draft={draft} updateDraft={updateDraft} />
      <BirthdayRow labels={labels} draft={draft} updateDraft={updateDraft} />

      <section className="prefs__group">
        <h2 className="prefs__group-title">{labels.reminders}</h2>
        <Row
          label={labels.enableBreakReminder}
          control={
            <ToggleControl
              checked={draft.breakReminderEnabled}
              onChange={(breakReminderEnabled) => updateDraft({ breakReminderEnabled })}
              ariaLabel={labels.enableBreakReminder}
            />
          }
        />
        <Row
          label={labels.breakInterval}
          control={
            <NumberControl
              value={draft.breakIntervalMinutes}
              min={1}
              max={900}
              unit={labels.minuteUnit}
              onChange={(breakIntervalMinutes) => updateDraft({ breakIntervalMinutes })}
            />
          }
        />
        <Row
          label={labels.breakRunDuration}
          control={
            <NumberControl
              value={draft.breakRunDurationSeconds}
              min={10}
              max={900}
              unit={labels.secondUnit}
              onChange={(breakRunDurationSeconds) => updateDraft({ breakRunDurationSeconds })}
            />
          }
        />
        <Row
          label={labels.enableHydrationReminder}
          control={
            <ToggleControl
              checked={draft.hydrationReminderEnabled}
              onChange={(hydrationReminderEnabled) => updateDraft({ hydrationReminderEnabled })}
              ariaLabel={labels.enableHydrationReminder}
            />
          }
        />
        <Row
          label={labels.hydrationInterval}
          control={
            <NumberControl
              value={draft.hydrationIntervalMinutes}
              min={1}
              max={900}
              unit={labels.minuteUnit}
              onChange={(hydrationIntervalMinutes) => updateDraft({ hydrationIntervalMinutes })}
            />
          }
        />
      </section>

      <section className="prefs__group">
        <h2 className="prefs__group-title">{labels.focus}</h2>
        <Row
          label={labels.focusDuration}
          control={
            <NumberControl
              value={draft.focusDurationMinutes}
              min={1}
              max={900}
              unit={labels.minuteUnit}
              onChange={(focusDurationMinutes) => updateDraft({ focusDurationMinutes })}
            />
          }
        />
        <Row
          label={labels.enableDistractionDetection}
          hint={
            draft.distractionDetectionEnabled
              ? labels.detectionFocusHelp
              : labels.detectionOffHelp
          }
          control={
            <ToggleControl
              checked={draft.distractionDetectionEnabled}
              onChange={(distractionDetectionEnabled) => updateDraft({ distractionDetectionEnabled })}
              ariaLabel={labels.enableDistractionDetection}
            />
          }
        />
        {draft.distractionDetectionEnabled ? (
          <>
            <Row
              label={labels.detectionGrace}
              control={
                <NumberControl
                  value={draft.distractionGraceSeconds}
                  min={0}
                  max={900}
                  unit={labels.secondUnit}
                  onChange={(distractionGraceSeconds) => updateDraft({ distractionGraceSeconds })}
                />
              }
            />
            <Row
              label={labels.blockedApps}
              control={
                <ChipsControl
                  value={draft.distractionBlockedApps}
                  labels={labels}
                  onChange={(distractionBlockedApps) => updateDraft({ distractionBlockedApps })}
                />
              }
            />
            <Row
              label={labels.blockedKeywords}
              control={
                <ChipsControl
                  value={draft.distractionBlockedKeywords}
                  labels={labels}
                  onChange={(distractionBlockedKeywords) => updateDraft({ distractionBlockedKeywords })}
                />
              }
            />
          </>
        ) : null}
        <div className="prefs__inline-actions">
          {snapshot.focusActive ? (
            <button type="button" className="pref-button" onClick={window.pawpal.stopFocus}>
              {labels.stopFocus}
            </button>
          ) : (
            <button type="button" className="pref-button is-primary" onClick={window.pawpal.startFocus}>
              {labels.startFocus}
            </button>
          )}
        </div>
      </section>

      {!window.pawpal.isPackaged && (
        <section className="prefs__group">
          <h2 className="prefs__group-title">{labels.testTools}</h2>
          <div className="test-tools">
            <DemoChip trigger="break" label={labels.demoBreak} />
            <DemoChip trigger="hydration" label={labels.demoWater} />
            <DemoChip trigger="focusWarning" label={labels.demoFocusWarning} />
            <DemoChip trigger="happy" label={labels.demoHappy} />
            <button
              type="button"
              className="pref-chip-button"
              onClick={() => throwRandomBall()}
            >
              {labels.playCatch}
            </button>
            <button type="button" className="pref-chip-button" onClick={window.pawpal.resetToday}>
              {labels.resetToday}
            </button>
          </div>
        </section>
      )}

      <AiSettingsPanel labels={labels} draft={draft} updateDraft={updateDraft} />

      <DiaryPanel labels={labels} />

      <MoodPanel labels={labels} />
      <SnapshotPanel labels={labels} />
      <BackupPanel labels={labels} />

      <GrowthPanel labels={labels} />

      <RosterPanel labels={labels} />

      <section className="prefs__group">
        <h2 className="prefs__group-title">{labels.chatWithPet}</h2>
        <Row
          label={labels.chatWithPet}
          control={
            <button
              type="button"
              className="pref-button is-primary"
              onClick={() => void window.pawpal.openChat()}
            >
              {labels.chatWithPet}
            </button>
          }
        />
      </section>

      <section className="prefs__group">
        <h2 className="prefs__group-title">{labels.system}</h2>
        <Row
          label={labels.launchAtLogin}
          hint={labels.launchAtLoginHelp}
          control={
            <ToggleControl
              checked={draft.launchAtLoginEnabled}
              onChange={(launchAtLoginEnabled) => updateDraft({ launchAtLoginEnabled })}
              ariaLabel={labels.launchAtLogin}
            />
          }
        />
        <Row
          label={labels.soundEnabled}
          hint={labels.soundEnabledHelp}
          control={
            <ToggleControl
              checked={draft.soundEnabled}
              onChange={(soundEnabled) => updateDraft({ soundEnabled })}
              ariaLabel={labels.soundEnabled}
            />
          }
        />
        <Row
          label={labels.ttsEnabled}
          hint={labels.ttsEnabledHelp}
          control={
            <ToggleControl
              checked={draft.ttsEnabled}
              onChange={(ttsEnabled) => updateDraft({ ttsEnabled })}
              ariaLabel={labels.ttsEnabled}
            />
          }
        />
        {draft.ttsEnabled ? (
          <Row
            label={labels.ttsRate}
            control={
              <NumberControl
                value={draft.ttsRate}
                min={0.5}
                max={2}
                unit="x"
                onChange={(ttsRate) => updateDraft({ ttsRate })}
              />
            }
          />
        ) : null}
        <Row
          label={labels.easterEggsEnabled}
          hint={labels.easterEggsEnabledHelp}
          control={
            <ToggleControl
              checked={draft.easterEggsEnabled}
              onChange={(easterEggsEnabled) => updateDraft({ easterEggsEnabled })}
              ariaLabel={labels.easterEggsEnabled}
            />
          }
        />
        <Row
          label={labels.theme}
          control={
            <SelectControl
              value={draft.theme}
              options={[
                { value: "default", label: labels.themeDefault },
                { value: "midnight", label: labels.themeMidnight },
                { value: "paperwhite", label: labels.themePaperwhite },
                { value: "sakura", label: labels.themeSakura }
              ]}
              onChange={(value) => {
                const theme = value as Settings["theme"];
                updateDraft({ theme });
                // Hot-swap the chat window's theme class. The chat
                // window reads this on next mount; for instant feel we
                // also flip the body class here so a future reload
                // picks the right one immediately.
                document.documentElement.classList.remove(
                  "theme-default",
                  "theme-midnight",
                  "theme-paperwhite",
                  "theme-sakura"
                );
                document.documentElement.classList.add(`theme-${theme}`);
                window.localStorage.setItem("pawpal-theme", theme);
              }}
            />
          }
        />
        {/* Local-only fork: update-check toggle removed (always off). */}
      </section>

      <section className="prefs__group">
        <h2 className="prefs__group-title">{labels.about}</h2>
        <Row
          label={labels.version}
          control={
            <span className="pref-static-value">{snapshot.appInfo.version || labels.none}</span>
          }
        />
        {/* Local-only fork: update status / release-notes UI removed. */}
      </section>

      <section className="prefs__group prefs__group--quiet">
        <button
          type="button"
          className="prefs__disclosure"
          onClick={() => setDiagnosticsOpen((open) => !open)}
          aria-expanded={diagnosticsOpen}
        >
          <span>{labels.diagnostics}</span>
          <span className="prefs__disclosure-caret">{diagnosticsOpen ? "▾" : "▸"}</span>
        </button>
        {diagnosticsOpen ? (
          <div className="prefs__diag">
            <DiagGroup title={labels.runtime}>
              <DiagCard label={labels.state} value={snapshot.petState} />
              <DiagCard label={labels.mood} value={labels.petMoods[snapshot.petMood]} />
              <DiagCard
                label={labels.mode}
                value={
                  snapshot.focusActive
                    ? labels.focus
                    : labels.idle
                }
              />
              <DiagCard label={labels.reminder} value={snapshot.blockingMode ?? labels.none} />
              <DiagCard
                label={labels.dog}
                value={snapshot.dogVisible ? labels.visible : labels.hidden}
              />
            </DiagGroup>

            <DiagGroup title={labels.distraction}>
              <DiagCard
                label={labels.status}
                value={formatDistractionState(snapshot.distraction.state, labels)}
              />
              <DiagCard
                label={labels.matched}
                value={snapshot.distraction.matchedRule ?? labels.none}
              />
              <DiagCard
                label={labels.app}
                value={snapshot.distraction.activeApp || labels.none}
              />
              <DiagCard
                label={labels.checked}
                value={formatTimestamp(snapshot.distraction.lastCheckedAt, language, labels)}
              />
            </DiagGroup>

            {snapshot.distraction.activeWindowTitle ? (
              <p className="prefs__diag-note">{snapshot.distraction.activeWindowTitle}</p>
            ) : null}
            <p className="prefs__diag-hint">{distractionHelp(snapshot, labels)}</p>

            <DiagGroup title={labels.timers}>
              <DiagCard
                label={labels.break}
                value={formatTimer(snapshot.timers.breakDueAt, now, language, labels)}
              />
              <DiagCard
                label={labels.water}
                value={formatTimer(snapshot.timers.hydrationDueAt, now, language, labels)}
              />
              <DiagCard
                label={labels.focusEnd}
                value={formatTimer(snapshot.timers.focusEndsAt, now, language, labels)}
              />
              <DiagCard
                label={labels.updated}
                value={new Intl.DateTimeFormat(localeFor(language), {
                  hour: "2-digit",
                  minute: "2-digit"
                }).format(now)}
              />
            </DiagGroup>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function PetCard({
  appearanceId,
  label,
  previewSrc,
  selected,
  disabled = false,
  onSelect
}: {
  appearanceId?: BuiltInPetAppearanceId;
  label: string;
  previewSrc?: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}): JSX.Element {
  const asset = useMemo(
    () => (appearanceId ? getPetAsset(appearanceId, "idle") : null),
    [appearanceId]
  );
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={`pet-card${selected ? " is-selected" : ""}`}
      disabled={disabled}
      onClick={onSelect}
    >
      <span className="pet-card__preview">
        {previewSrc || asset ? <img src={previewSrc ?? asset?.src} alt="" /> : <span>+</span>}
      </span>
      <span className="pet-card__name">{label}</span>
    </button>
  );
}

function CustomPetEditor({
  customPetAppearance,
  labels,
  onDrop,
  onUpload,
  onRemove
}: {
  customPetAppearance: CustomPetAppearance | null;
  labels: SettingsCopy;
  onDrop: (state: PetState, file: File) => void;
  onUpload: (state: PetState) => void;
  onRemove: (state: PetState) => void;
}): JSX.Element {
  function allowGifDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, state: PetState): void {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;
    onDrop(state, file);
  }

  return (
    <div className="custom-pet">
      <div className="custom-pet__head">
        <div className="custom-pet__title">
          <span className="pref-block__label">{labels.customPetAssets}</span>
          <span className="custom-pet__help">
            <button
              type="button"
              className="custom-pet__help-button"
              aria-label={labels.customPetRequirements}
            >
              ?
            </button>
            <span className="custom-pet__tooltip" role="tooltip">
              {labels.customPetRequirements}
            </span>
          </span>
        </div>
        <span className="custom-pet__status">
          {hasRequiredCustomPetAssets(customPetAppearance)
            ? labels.customPetReady
            : labels.customPetMissingRequired}
        </span>
      </div>
      <div className="custom-pet__grid">
        {PET_STATE_ORDER.map((state) => {
          const reference = getPetAsset("lineDog", state);
          const customAsset = customPetAppearance?.assets[state] ?? null;
          const customPreview = customAsset ? customPetAssetPreviewSrc(customAsset) : null;
          return (
            <div className="custom-pet-slot" key={state}>
              <div className="custom-pet-slot__meta">
                <span className="custom-pet-slot__state">{labels.petStates[state]}</span>
                <span className="custom-pet-slot__description">
                  {labels.petStateDescriptions[state]}
                </span>
                <span className={`custom-pet-slot__kind${customPetStateKindClass(state)}`}>
                  {customPetStateKind(state, labels)}
                </span>
              </div>
              <div className="custom-pet-slot__media">
                <div className="custom-pet-slot__preview">
                  <span className="custom-pet-slot__badge">{labels.referenceAsset}</span>
                  <img src={reference.src} alt="" />
                </div>
                <div
                  className={`custom-pet-slot__preview custom-pet-slot__dropzone${
                    customPreview ? "" : " is-empty"
                  }`}
                  onDragOver={allowGifDrop}
                  onDrop={(event) => handleDrop(event, state)}
                >
                  {customPreview ? <img src={customPreview} alt="" /> : <strong>+</strong>}
                  {!customAsset ? (
                    <button
                      type="button"
                      className="pref-button custom-pet-slot__upload"
                      onClick={() => onUpload(state)}
                    >
                      {labels.uploadGif}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="custom-pet-slot__actions">
                {customAsset ? (
                  <>
                    <button type="button" className="pref-button" onClick={() => onUpload(state)}>
                      {labels.replaceGif}
                    </button>
                    <button
                      type="button"
                      className="pref-button"
                      onClick={() => onRemove(state)}
                    >
                      {labels.removeGif}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DemoChip({ trigger, label }: { trigger: DemoTrigger; label: string }): JSX.Element {
  return (
    <button
      type="button"
      className="pref-chip-button"
      onClick={() => window.pawpal.triggerDemo(trigger)}
    >
      {label}
    </button>
  );
}

function DiagGroup({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="diag-group">
      <h3 className="diag-group__title">{title}</h3>
      <div className="diag-group__grid">{children}</div>
    </section>
  );
}

function DiagCard({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="diag-card">
      <span className="diag-card__label">{label}</span>
      <span className="diag-card__value">{value}</span>
    </div>
  );
}
