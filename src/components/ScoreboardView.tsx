import React, { useMemo, useState } from 'react';
import {
  Calculator,
  Coins,
  PlusCircle,
  RotateCcw,
  Save,
} from 'lucide-react';
import {
  GameDetail,
  Player,
  SessionDraft,
} from '../types/mahjong';
import {
  formatPoint,
  getRuleSummaryText,
  normalizeZero,
} from '../utils/mahjongCalc';
import { ChipModal } from './ChipModal';
import { ConfirmModal } from './ConfirmModal';
import { GameScoreModal } from './GameScoreModal';
import { SettlementModal } from './SettlementModal';

interface ScoreboardViewProps {
  draft: SessionDraft;
  players: Player[];
  onUpdateDraft: (nextDraft: SessionDraft) => void;
  onFinalizeSession: (draft: SessionDraft) => Promise<void>;
  onDiscardDraft: () => void;
}

export const ScoreboardView: React.FC<ScoreboardViewProps> = ({
  draft,
  players,
  onUpdateDraft,
  onFinalizeSession,
  onDiscardDraft,
}) => {
  const [gameModalOpen, setGameModalOpen] = useState(false);
  const [editingGameIdx, setEditingGameIdx] = useState<number | null>(null);
  const [chipModalOpen, setChipModalOpen] = useState(false);
  const [settlementModalOpen, setSettlementModalOpen] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const playerMap = useMemo(
    () => new Map(players.map((p) => [p.player_id, p])),
    [players]
  );

  const participants: Player[] = useMemo(() => {
    return draft.participant_ids.map(
      (id) =>
        playerMap.get(id) ?? {
          player_id: id,
          name: id,
          is_active: true,
          created_at: '',
        }
    );
  }, [draft.participant_ids, playerMap]);

  const useChip = draft.rule_snapshot.use_chip === 'true';
  const useSettlement = draft.rule_snapshot.use_settlement === 'true';
  const settlementRate = Number(draft.rule_snapshot.settlement_rate) || 50;

  // Compute game sums and total points per participant
  const { gameSums, totalsByPlayer } = useMemo(() => {
    const gSums: Record<string, number> = {};
    const totals: Record<string, number> = {};
    draft.participant_ids.forEach((id) => {
      gSums[id] = 0;
    });
    draft.games.forEach((g) => {
      g.details.forEach((d) => {
        gSums[d.player_id] = normalizeZero(
          (gSums[d.player_id] ?? 0) + d.final_point
        );
      });
    });
    draft.participant_ids.forEach((id) => {
      const chipPt = useChip
        ? normalizeZero((draft.chips[id] ?? 0) * 2)
        : 0;
      totals[id] = normalizeZero((gSums[id] ?? 0) + chipPt);
    });
    return { gameSums: gSums, totalsByPlayer: totals };
  }, [draft, useChip]);

  const handleOpenNewGame = () => {
    setEditingGameIdx(null);
    setGameModalOpen(true);
  };

  const handleOpenEditGame = (idx: number) => {
    setEditingGameIdx(idx);
    setGameModalOpen(true);
  };

  const handleSaveGame = (details: GameDetail[]) => {
    let nextGames = [...draft.games];
    if (editingGameIdx !== null) {
      nextGames[editingGameIdx] = {
        game_number: editingGameIdx + 1,
        details,
      };
    } else {
      nextGames.push({
        game_number: nextGames.length + 1,
        details,
      });
    }
    nextGames = nextGames.map((g, idx) => ({
      game_number: idx + 1,
      details: g.details.map((d) => ({ ...d, game_number: idx + 1 })),
    }));
    onUpdateDraft({
      ...draft,
      games: nextGames,
    });
    setGameModalOpen(false);
    setEditingGameIdx(null);
  };

  const handleDeleteGame = () => {
    if (editingGameIdx === null) return;
    const filtered = draft.games
      .filter((_, idx) => idx !== editingGameIdx)
      .map((g, idx) => ({
        game_number: idx + 1,
        details: g.details.map((d) => ({ ...d, game_number: idx + 1 })),
      }));
    onUpdateDraft({
      ...draft,
      games: filtered,
    });
    setGameModalOpen(false);
    setEditingGameIdx(null);
  };

  const handleSaveChips = (nextChips: Record<string, number>) => {
    onUpdateDraft({
      ...draft,
      chips: nextChips,
    });
    setChipModalOpen(false);
  };

  const handleRequestFinalize = () => {
    const hasAnyChip =
      useChip &&
      Object.values(draft.chips).some((val) => normalizeZero(val) !== 0);
    if (draft.games.length === 0 && !hasAnyChip) {
      setNoticeMessage(
        '保存できる試合またはチップ増減がありません。\n対局を中止する場合は「対局を破棄（トップへ戻る）」を押してください。'
      );
      return;
    }
    setConfirmSaveOpen(true);
  };

  const handleConfirmFinalize = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onFinalizeSession(draft);
      setConfirmSaveOpen(false);
    } catch (err) {
      setConfirmSaveOpen(false);
      setNoticeMessage(
        err instanceof Error
          ? err.message
          : '保存に失敗しました。通信状況を確認して再度お試しください。'
      );
    } finally {
      setSaving(false);
    }
  };

  const gameTypeLabel =
    draft.rule_snapshot.game_type === 'hanchan' ? '半荘' : '東風';
  const sessionTitle = `${gameTypeLabel}第${draft.games.length}戦`;

  const pointClass = (val: number) =>
    val > 0 ? 'point-pos' : val < 0 ? 'point-neg' : 'point-zero';

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0">
      {/* Top Info & Discard Bar */}
      <div className="surface-card px-4 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
            <h2 className="text-lg font-bold tabular-nums">{sessionTitle}</h2>
            <span
              className="text-xs font-semibold tabular-nums"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {draft.date}
            </span>
            {draft.mode === 'edit' && (
              <span
                className="text-xs font-bold"
                style={{ color: 'var(--color-warning)' }}
              >
                · 過去データ編集モード
              </span>
            )}
          </div>
          <p
            className="text-xs truncate mt-0.5"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {getRuleSummaryText(draft.rule_snapshot)}
          </p>
        </div>

        <button
          type="button"
          className="btn btn-ghost text-xs px-3"
          style={{ color: 'var(--color-danger)' }}
          onClick={() => setConfirmDiscardOpen(true)}
          disabled={saving}
        >
          <RotateCcw size={14} />
          <span>
            {draft.mode === 'edit'
              ? '編集を破棄して戻る'
              : '対局を破棄（トップへ戻る）'}
          </span>
        </button>
      </div>

      {/* Scrollable Sticky Scoreboard Table */}
      <div className="sticky-table-wrap">
        <table className="score-table">
          <thead>
            <tr>
              <th className="sticky-col">試合</th>
              {participants.map((p) => (
                <th key={p.player_id}>
                  <span className="block truncate max-w-[110px] mx-auto">
                    {p.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {draft.games.length === 0 ? (
              <tr>
                <td
                  colSpan={participants.length + 1}
                  className="py-12 text-sm"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  まだ試合が入力されていません。下の「入力」ボタンから第1戦を追加してください。
                </td>
              </tr>
            ) : (
              draft.games.map((game, idx) => {
                const detailMap = new Map(
                  game.details.map((d) => [d.player_id, d])
                );
                return (
                  <tr
                    key={game.game_number}
                    onClick={() => handleOpenEditGame(idx)}
                    className="cursor-pointer hover:bg-[#faf9f5] transition-colors"
                  >
                    <th className="sticky-col">
                      <span className="tabular-nums">第{idx + 1}戦</span>
                    </th>
                    {participants.map((p) => {
                      const d = detailMap.get(p.player_id);
                      if (!d) {
                        return (
                          <td
                            key={p.player_id}
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            ー
                          </td>
                        );
                      }
                      return (
                        <td key={p.player_id}>
                          <div
                            className={`text-sm font-bold tabular-nums ${pointClass(
                              d.final_point
                            )}`}
                          >
                            {formatPoint(d.final_point)}
                          </div>
                          <div
                            className="text-[11px] tabular-nums"
                            style={{ color: 'var(--color-text-muted)' }}
                          >
                            {d.wind} · {d.rank}着
                            {d.is_tobi ? ' 飛' : ''}
                            {d.tobi_count > 0 ? ` 飛+${d.tobi_count}` : ''}
                            {d.is_yakitori ? ' 焼' : ''}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>

          <tfoot>
            {useChip && (
              <tr className="chip-row">
                <th className="sticky-col">チップ</th>
                {participants.map((p) => {
                  const diff = normalizeZero(draft.chips[p.player_id] ?? 0);
                  const chipPt = normalizeZero(diff * 2);
                  return (
                    <td
                      key={p.player_id}
                      className={`text-sm tabular-nums ${pointClass(chipPt)}`}
                    >
                      {formatPoint(chipPt)}
                    </td>
                  );
                })}
              </tr>
            )}
            <tr>
              <th className="sticky-col">成績</th>
              {participants.map((p) => {
                const total = totalsByPlayer[p.player_id] ?? 0;
                return (
                  <td
                    key={p.player_id}
                    className={`text-base tabular-nums ${pointClass(total)}`}
                  >
                    {formatPoint(total)}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Bottom Action Bar */}
      <div className="surface-card p-3 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenNewGame}
            disabled={saving}
          >
            <PlusCircle size={18} />
            <span>入力</span>
          </button>

          {useChip && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setChipModalOpen(true)}
              disabled={saving}
            >
              <Coins size={18} />
              <span>チップ</span>
            </button>
          )}

          {useSettlement && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSettlementModalOpen(true)}
              disabled={saving}
            >
              <Calculator size={18} />
              <span>集計</span>
            </button>
          )}
        </div>

        <button
          type="button"
          className="btn btn-primary min-w-[120px]"
          style={{
            backgroundColor: '#1e293b',
          }}
          onClick={handleRequestFinalize}
          disabled={saving}
        >
          <Save size={18} />
          <span>
            {saving
              ? '保存中...'
              : draft.mode === 'edit'
                ? '更新保存'
                : '終了'}
          </span>
        </button>
      </div>

      {/* Modals */}
      {gameModalOpen && (
        <GameScoreModal
          key={`${editingGameIdx ?? 'new'}-${draft.games.length}`}
          open={gameModalOpen}
          sessionId={draft.session_id}
          date={draft.date}
          gameNumber={
            editingGameIdx !== null
              ? editingGameIdx + 1
              : draft.games.length + 1
          }
          participants={participants}
          rules={draft.rule_snapshot}
          initialGame={
            editingGameIdx !== null ? draft.games[editingGameIdx] : null
          }
          onSave={handleSaveGame}
          onDelete={editingGameIdx !== null ? handleDeleteGame : undefined}
          onClose={() => {
            setGameModalOpen(false);
            setEditingGameIdx(null);
          }}
        />
      )}

      {chipModalOpen && (
        <ChipModal
          key={`chip-${draft.session_id}-${JSON.stringify(draft.chips)}`}
          open={chipModalOpen}
          participants={participants}
          initialChips={draft.chips}
          onSave={handleSaveChips}
          onClose={() => setChipModalOpen(false)}
        />
      )}

      {settlementModalOpen && (
        <SettlementModal
          open={settlementModalOpen}
          participants={participants}
          totalsByPlayer={totalsByPlayer}
          rate={settlementRate}
          onClose={() => setSettlementModalOpen(false)}
        />
      )}

      <ConfirmModal
        open={confirmSaveOpen}
        title={draft.mode === 'edit' ? '編集内容を更新' : '対局を終了して保存'}
        message={
          draft.mode === 'edit'
            ? `この対局（全${draft.games.length}戦）の変更内容を保存しますか？`
            : `全${draft.games.length}戦の成績を保存して対局を終了しますか？`
        }
        confirmLabel={saving ? '保存中...' : draft.mode === 'edit' ? '更新する' : '保存して終了'}
        onConfirm={handleConfirmFinalize}
        onCancel={() => {
          if (!saving) setConfirmSaveOpen(false);
        }}
      />

      <ConfirmModal
        open={confirmDiscardOpen}
        title={draft.mode === 'edit' ? '編集内容を破棄' : '対局を破棄'}
        message={
          draft.mode === 'edit'
            ? '編集中の変更内容を破棄して過去データへ戻りますか？保存済みのデータは変更されません。'
            : '入力中の成績を保存せずに破棄してトップ画面へ戻りますか？この操作は取り消せません。'
        }
        confirmLabel="破棄して戻る"
        confirmTone="danger"
        onConfirm={() => {
          setConfirmDiscardOpen(false);
          onDiscardDraft();
        }}
        onCancel={() => setConfirmDiscardOpen(false)}
      />

      <ConfirmModal
        open={Boolean(noticeMessage)}
        title="お知らせ"
        message={noticeMessage ?? ''}
        confirmLabel="OK"
        showCancel={false}
        onConfirm={() => setNoticeMessage(null)}
        onCancel={() => setNoticeMessage(null)}
      />
    </div>
  );
};
