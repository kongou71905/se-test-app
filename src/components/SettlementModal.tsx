import React from 'react';
import { X } from 'lucide-react';
import { Player } from '../types/mahjong';
import { formatNumber, formatPoint, normalizeZero } from '../utils/mahjongCalc';

interface SettlementModalProps {
  open: boolean;
  participants: Player[];
  totalsByPlayer: Record<string, number>;
  rate: number;
  onClose: () => void;
}

export const SettlementModal: React.FC<SettlementModalProps> = ({
  open,
  participants,
  totalsByPlayer,
  rate,
  onClose,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(26, 27, 25, 0.5)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settlement-modal-title"
    >
      <div className="surface-card w-full max-w-md overflow-hidden shadow-2xl">
        <div
          className="px-5 py-3.5 border-b flex items-center justify-between gap-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div>
            <h3 id="settlement-modal-title" className="text-lg font-bold">
              精算集計
            </h3>
            <p
              className="text-xs tabular-nums"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              レート: 1pt = {formatNumber(rate)}
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

        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {participants.map((p) => {
            const pt = normalizeZero(totalsByPlayer[p.player_id] ?? 0);
            const settled = normalizeZero(pt * rate);
            return (
              <div
                key={p.player_id}
                className="px-5 py-3.5 flex items-center justify-between gap-4"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <span className="font-bold text-sm truncate">{p.name}</span>
                <div className="text-right tabular-nums">
                  <div
                    className="text-base font-bold"
                    style={{
                      color:
                        settled > 0
                          ? 'var(--color-positive)'
                          : settled < 0
                            ? 'var(--color-negative)'
                            : 'var(--color-text-secondary)',
                    }}
                  >
                    {settled > 0
                      ? `+${formatNumber(settled)}`
                      : settled < 0
                        ? `-${formatNumber(Math.abs(settled))}`
                        : '0'}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {formatPoint(pt)} pt
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="px-5 py-3.5 border-t flex justify-end"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button type="button" className="btn btn-primary" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
