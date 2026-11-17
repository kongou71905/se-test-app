import React, { useMemo, useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import {
  DailyRecord,
  DraftGame,
  GameDetail,
  Player,
  RuleConfig,
  SessionDraft,
  WINDS,
} from '../types/mahjong';
import {
  formatNumber,
  formatPoint,
  getRuleSummaryText,
  parseRuleSnapshot,
} from '../utils/mahjongCalc';
import { ConfirmModal } from './ConfirmModal';

interface HistoryDetailModalProps {
  open: boolean;
  sessionId: string;
  date: string;
  dailyRecords: DailyRecord[];
  gameDetails: GameDetail[];
  players: Player[];
  currentRules: RuleConfig;
  onEdit: (draft: SessionDraft) => void;
  onDelete: (sessionId: string) => Promise<void>;
  onClose: () => void;
}

export const HistoryDetailModal: React.FC<HistoryDetailModalProps> = ({
  open,
  sessionId,
  date,
  dailyRecords,
  gameDetails,
  players,
  currentRules,
  onEdit,
  onDelete,
  onClose,
}) => {
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.player_id, p])),
    [players]
  );

  const getPlayerName = (playerId: string, fallbackName: string) =>
    playerMap.get(playerId)?.name ?? fallbackName;

  const appliedRules = useMemo(
    () => parseRuleSnapshot(dailyRecords[0]?.rule_snapshot, currentRules),
    [dailyRecords, currentRules]
  );

  const gamesGrouped = useMemo(() => {
    const map = new Map<number, GameDetail[]>();
    for (const g of gameDetails) {
      const list = map.get(g.game_number) ?? [];
      list.push(g);
      map.set(g.game_number, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([game_number, details]) => ({
        game_number,
        details: [...details].sort(
          (a, b) => WINDS.indexOf(a.wind) - WINDS.indexOf(b.wind)
        ),
      }));
  }, [gameDetails]);

  if (!open) return null;

  const handleStartEdit = () => {
    // Collect all participant IDs from dailyRecords & gameDetails
    const idSet = new Set<string>();
    dailyRecords.forEach((r) => idSet.add(r.player_id));
    gameDetails.forEach((g) => idSet.add(g.player_id));

    // Order participants consistently with players master list
    const orderedIds: string[] = [];
    players.forEach((p) => {
      if (idSet.has(p.player_id)) {
        orderedIds.push(p.player_id);
        idSet.delete(p.player_id);
      }
    });
    idSet.forEach((id) => orderedIds.push(id));

    const chips: Record<string, number> = {};
    orderedIds.forEach((id) => {
      chips[id] = 0;
    });
    dailyRecords.forEach((r) => {
      chips[r.player_id] = r.chip_diff;
    });

    const draftGames: DraftGame[] = gamesGrouped.map((g, idx) => ({
      game_number: idx + 1,
      details: g.details.map((d) => ({
        ...d,
        game_number: idx + 1,
        player_name: getPlayerName(d.player_id, d.player_name),
      })),
    }));

    const editDraft: SessionDraft = {
      mode: 'edit',
      session_id: sessionId,
      date,
      participant_ids: orderedIds,
      rule_snapshot: appliedRules,
      games: draftGames,
      chips,
    };
    onEdit(editDraft);
  };

  const handleConfirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await onDelete(sessionId);
      setConfirmDeleteOpen(false);
      onClose();
    } catch (err) {
      setConfirmDeleteOpen(false);
      setError(
        err instanceof Error ? err.message : '削除に失敗しました。'
      );
    } finally {
      setDeleting(false);
    }
  };

  const pointColor = (val: number) =>
    val > 0
      ? 'var(--color-positive)'
      : val < 0
        ? 'var(--color-negative)'
        : 'var(--color-text-secondary)';

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:p-4"
      style={{ backgroundColor: 'rgba(26, 27, 25, 0.5)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-detail-title"
    >
      <div
        className="surface-card w-full max-w-2xl max-h-[92dvh] flex flex-col overflow-hidden rounded-b-none sm:rounded-b-2xl shadow-2xl"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        <div
          className="px-5 py-3.5 border-b flex items-center justify-between gap-3 shrink-0"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <div className="min-w-0">
            <h3 id="history-detail-title" className="text-lg font-bold tabular-nums">
              {date} の試合詳細
            </h3>
            <p
              className="text-xs truncate mt-0.5"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {getRuleSummaryText(appliedRules)}
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

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Session Summary */}
          <section className="surface-card overflow-hidden">
            <div
              className="px-4 py-2.5 border-b text-xs font-bold"
              style={{
                backgroundColor: 'var(--color-surface-subtle)',
                borderColor: 'var(--color-border)',
              }}
            >
              対局サマリー
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
              {dailyRecords.map((rec) => (
                <div
                  key={rec.player_id}
                  className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="min-w-0">
                    <span className="font-bold">
                      {getPlayerName(rec.player_id, rec.player_name)}
                    </span>
                    <span
                      className="ml-2 text-xs tabular-nums"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {rec.game_count}戦
                      {appliedRules.use_chip === 'true'
                        ? ` · チップ ${formatPoint(rec.chip_point)}pt (${formatPoint(
                            rec.chip_diff
                          )}枚)`
                        : ''}
                    </span>
                  </div>
                  <div
                    className="font-bold tabular-nums"
                    style={{ color: pointColor(rec.total_point) }}
                  >
                    {formatPoint(rec.total_point)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Game by Game Details */}
          {gamesGrouped.length === 0 ? (
            <div
              className="surface-card p-6 text-center text-sm"
              style={{ color: 'var(--color-text-muted)' }}
            >
              試合詳細データはありません（チップのみの記録です）。
            </div>
          ) : (
            gamesGrouped.map((game) => (
              <section key={game.game_number} className="surface-card overflow-hidden">
                <div
                  className="px-4 py-2 border-b text-xs font-bold tabular-nums"
                  style={{
                    backgroundColor: 'var(--color-surface-subtle)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  第{game.game_number}戦
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {[...game.details]
                    .sort((a, b) => a.rank - b.rank)
                    .map((d) => (
                      <div
                        key={d.player_id}
                        className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="text-xs font-bold w-8 shrink-0 tabular-nums"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            {d.rank}着
                          </span>
                          <span
                            className="text-xs font-semibold px-1.5 py-0.5 rounded shrink-0"
                            style={{
                              backgroundColor: 'var(--color-surface-subtle)',
                            }}
                          >
                            {d.wind}
                          </span>
                          <span className="font-semibold truncate">
                            {getPlayerName(d.player_id, d.player_name)}
                          </span>
                          {(d.is_tobi || d.tobi_count > 0 || d.is_yakitori) && (
                            <span
                              className="text-xs shrink-0"
                              style={{ color: 'var(--color-text-muted)' }}
                            >
                              {d.is_tobi ? '飛び ' : ''}
                              {d.tobi_count > 0 ? `飛ばし+${d.tobi_count} ` : ''}
                              {d.is_yakitori ? '焼き鳥' : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 tabular-nums shrink-0">
                          <span
                            className="text-xs"
                            style={{ color: 'var(--color-text-secondary)' }}
                          >
                            {formatNumber(d.raw_score)}
                          </span>
                          <span
                            className="font-bold min-w-[48px] text-right"
                            style={{ color: pointColor(d.final_point) }}
                          >
                            {formatPoint(d.final_point)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </section>
            ))
          )}

          {error && (
            <div
              className="rounded-xl border p-3 text-sm font-medium"
              style={{
                backgroundColor: 'var(--color-danger-soft)',
                borderColor: '#fecaca',
                color: 'var(--color-danger)',
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div
          className="px-5 py-3.5 border-t flex items-center justify-between gap-3 shrink-0"
          style={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
          }}
        >
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={deleting}
          >
            <Trash2 size={16} />
            <span>削除</span>
          </button>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={deleting}
            >
              閉じる
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleStartEdit}
              disabled={deleting}
            >
              <Pencil size={16} />
              <span>編集</span>
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmDeleteOpen}
        title="対局データを削除"
        message={`${date} のこの対局データを削除しますか？\n関連する試合詳細もすべて削除されます。この操作は取り消せません。`}
        confirmLabel={deleting ? '削除中...' : '削除する'}
        confirmTone="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!deleting) setConfirmDeleteOpen(false);
        }}
      />
    </div>
  );
};
