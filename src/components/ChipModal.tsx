import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Player } from '../types/mahjong';
import { formatPoint, normalizeZero } from '../utils/mahjongCalc';

interface ChipModalProps {
  open: boolean;
  participants: Player[];
  initialChips: Record<string, number>;
  chipRate?: number;
  onSave: (chips: Record<string, number>) => void;
  onClose: () => void;
}

export const ChipModal: React.FC<ChipModalProps> = ({
  open,
  participants,
  initialChips,
  chipRate = 2,
  onSave,
  onClose,
}) => {
  const [chipValues, setChipValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    participants.forEach((p) => {
      map[p.player_id] = String(initialChips[p.player_id] ?? 0);
    });
    return map;
  });

  if (!open) return null;

  const parsedChips: Record<string, number> = {};
  let allValidInt = true;
  let totalDiff = 0;

  for (const p of participants) {
    const raw = (chipValues[p.player_id] ?? '0').trim();
    if (!/^-?\d+$/.test(raw)) {
      allValidInt = false;
      parsedChips[p.player_id] = 0;
    } else {
      const val = normalizeZero(Number(raw));
      parsedChips[p.player_id] = val;
      totalDiff += val;
    }
  }

  const canSave = allValidInt && totalDiff === 0;

  const adjustChip = (playerId: string, delta: number) => {
    const cur = parsedChips[playerId] ?? 0;
    setChipValues((prev) => ({
      ...prev,
      [playerId]: String(normalizeZero(cur + delta)),
    }));
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:p-4"
      style={{ backgroundColor: 'rgba(26, 27, 25, 0.5)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="chip-modal-title"
    >
      <div
        className="surface-card w-full max-w-lg max-h-[90dvh] flex flex-col overflow-hidden rounded-b-none sm:rounded-b-2xl shadow-2xl"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        <div
          className="px-5 py-3.5 border-b flex items-center justify-between gap-3 shrink-0"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div>
            <h3 id="chip-modal-title" className="text-lg font-bold">
              チップ増減入力
            </h3>
            <p
              className="text-xs mt-0.5 tabular-nums"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              チップの増減枚数を入力（1枚 = ±{chipRate}pt · 合計 = 0枚）
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            aria-label="閉じる"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
          {participants.map((p) => {
            const valStr = chipValues[p.player_id] ?? '0';
            const valid = /^-?\d+$/.test(valStr.trim());
            const num = valid ? Number(valStr.trim()) : 0;
            const pt = normalizeZero(num * chipRate);

            return (
              <div
                key={p.player_id}
                className="surface-card p-3.5 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">{p.name}</div>
                  <div
                    className="text-xs tabular-nums font-semibold"
                    style={{
                      color:
                        pt > 0
                          ? 'var(--color-positive)'
                          : pt < 0
                            ? 'var(--color-negative)'
                            : 'var(--color-text-muted)',
                    }}
                  >
                    換算 {formatPoint(pt)} pt
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="btn btn-secondary px-2.5 text-xs tabular-nums"
                    onClick={() => adjustChip(p.player_id, -5)}
                  >
                    -5
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary px-3 text-sm tabular-nums"
                    onClick={() => adjustChip(p.player_id, -1)}
                  >
                    -1
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    className="input-field w-20 text-center font-bold tabular-nums"
                    value={valStr}
                    onChange={(e) =>
                      setChipValues((prev) => ({
                        ...prev,
                        [p.player_id]: e.target.value,
                      }))
                    }
                    aria-label={`${p.name}のチップ増減`}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary px-3 text-sm tabular-nums"
                    onClick={() => adjustChip(p.player_id, 1)}
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary px-2.5 text-xs tabular-nums"
                    onClick={() => adjustChip(p.player_id, 5)}
                  >
                    +5
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="px-5 py-3.5 border-t flex flex-wrap items-center justify-between gap-3 shrink-0"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div
            className="text-sm font-bold tabular-nums"
            style={{
              color: canSave ? 'var(--color-positive)' : 'var(--color-negative)',
            }}
          >
            {!allValidInt
              ? '整数を入力してください'
              : totalDiff === 0
                ? '合計: 0枚（保存可能）'
                : `合計: ${formatPoint(totalDiff)}枚（0枚にしてください）`}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              キャンセル
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canSave}
              onClick={() => onSave(parsedChips)}
            >
              <Check size={16} />
              <span>確定</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
