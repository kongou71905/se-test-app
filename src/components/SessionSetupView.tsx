import React, { useState } from 'react';
import { Check, Play, Users } from 'lucide-react';
import { Player, RuleConfig, SessionDraft } from '../types/mahjong';
import {
  generateSessionId,
  getRuleSummaryText,
  getTodayYYYYMMDD,
  toInputDateValue,
  toSlashDateValue,
} from '../utils/mahjongCalc';

interface SessionSetupViewProps {
  players: Player[];
  rules: RuleConfig;
  onStartSession: (draft: SessionDraft) => void;
  onBack: () => void;
  onGoToPlayers: () => void;
}

export const SessionSetupView: React.FC<SessionSetupViewProps> = ({
  players,
  rules,
  onStartSession,
  onBack,
  onGoToPlayers,
}) => {
  const activePlayers = players.filter((p) => p.is_active);
  const [dateInput, setDateInput] = useState<string>(() =>
    toInputDateValue(getTodayYYYYMMDD())
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    activePlayers.length >= 4 && activePlayers.length <= 5
      ? activePlayers.map((p) => p.player_id)
      : []
  );
  const [error, setError] = useState<string | null>(null);

  const togglePlayer = (playerId: string) => {
    setError(null);
    setSelectedIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    );
  };

  const handleSelectAll = () => {
    setError(null);
    setSelectedIds(activePlayers.map((p) => p.player_id));
  };

  const handleClear = () => {
    setError(null);
    setSelectedIds([]);
  };

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      setError('対局日を正しく選択してください。');
      return;
    }

    // Preserve activePlayers display order
    const orderedSelectedIds = activePlayers
      .filter((p) => selectedIds.includes(p.player_id))
      .map((p) => p.player_id);

    if (orderedSelectedIds.length < 4) {
      setError('参加対局者を4名以上選択してください。');
      return;
    }

    const initialChips: Record<string, number> = {};
    orderedSelectedIds.forEach((id) => {
      initialChips[id] = 0;
    });

    const draft: SessionDraft = {
      mode: 'new',
      session_id: generateSessionId(),
      date: toSlashDateValue(dateInput),
      participant_ids: orderedSelectedIds,
      rule_snapshot: { ...rules },
      games: [],
      chips: initialChips,
    };

    onStartSession(draft);
  };

  return (
    <form onSubmit={handleStart} className="flex flex-col gap-5">
      <section className="surface-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">日付・対局者設定</h2>
            <p
              className="mt-1 text-xs font-medium"
              style={{ color: 'var(--color-text-muted)' }}
            >
              適用ルール（対局中固定） · {getRuleSummaryText(rules)}
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            戻る
          </button>
        </div>

        {/* Date Picker */}
        <div className="mt-5">
          <label
            htmlFor="session-date-input"
            className="block text-sm font-bold mb-1.5"
          >
            対局日
          </label>
          <input
            id="session-date-input"
            type="date"
            className="input-field max-w-xs tabular-nums"
            value={dateInput}
            onChange={(e) => {
              setDateInput(e.target.value);
              setError(null);
            }}
            required
          />
        </div>
      </section>

      {/* Participant Multi-select */}
      <section className="surface-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold">
              参加対局者（4名以上選択）
            </h3>
            <p
              className="text-xs mt-0.5 tabular-nums"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              現在 {selectedIds.length} 名選択中（5名以上の抜け番あり対局にも対応）
            </p>
          </div>
          {activePlayers.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSelectAll}
              >
                全員選択
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleClear}
              >
                クリア
              </button>
            </div>
          )}
        </div>

        {activePlayers.length < 4 ? (
          <div
            className="mt-4 rounded-xl border p-5 text-center"
            style={{
              backgroundColor: 'var(--color-surface-subtle)',
              borderColor: 'var(--color-border)',
            }}
          >
            <p
              className="text-sm font-medium"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              対局を開始するには有効な対局者が4名以上必要です（現在{' '}
              {activePlayers.length}名）。
            </p>
            <button
              type="button"
              className="btn btn-primary mt-4"
              onClick={onGoToPlayers}
            >
              <Users size={18} />
              <span>対局者管理へ進む</span>
            </button>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {activePlayers.map((player) => {
              const selected = selectedIds.includes(player.player_id);
              return (
                <button
                  key={player.player_id}
                  type="button"
                  onClick={() => togglePlayer(player.player_id)}
                  aria-pressed={selected}
                  className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border text-left font-semibold transition-colors cursor-pointer"
                  style={{
                    minHeight: '48px',
                    backgroundColor: selected
                      ? 'var(--color-accent-soft)'
                      : 'var(--color-surface)',
                    borderColor: selected
                      ? 'var(--color-accent)'
                      : 'var(--color-border-strong)',
                    color: selected
                      ? 'var(--color-accent)'
                      : 'var(--color-text)',
                  }}
                >
                  <span className="truncate text-sm">{player.name}</span>
                  <span
                    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 border"
                    style={{
                      backgroundColor: selected
                        ? 'var(--color-accent)'
                        : 'transparent',
                      borderColor: selected
                        ? 'var(--color-accent)'
                        : 'var(--color-border-strong)',
                      color: '#ffffff',
                    }}
                  >
                    {selected && <Check size={14} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <div
            className="mt-4 rounded-xl border p-3 text-sm font-medium"
            style={{
              backgroundColor: 'var(--color-danger-soft)',
              borderColor: '#fecaca',
              color: 'var(--color-danger)',
            }}
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="submit"
            className="btn btn-primary w-full sm:w-auto min-w-[200px]"
            disabled={activePlayers.length < 4 || selectedIds.length < 4}
          >
            <Play size={16} />
            <span>OK（対局開始）</span>
          </button>
        </div>
      </section>
    </form>
  );
};
