import React, { useMemo, useState } from 'react';
import { Calendar, X } from 'lucide-react';
import {
  DailyRecord,
  GameDetail,
  Player,
  RuleConfig,
  SessionDraft,
} from '../types/mahjong';
import { formatPoint, normalizeZero } from '../utils/mahjongCalc';
import { HistoryDetailModal } from './HistoryDetailModal';

interface HistoryViewProps {
  players: Player[];
  dailyRecords: DailyRecord[];
  gameDetails: GameDetail[];
  currentRules: RuleConfig;
  onEditSession: (draft: SessionDraft) => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onBack: () => void;
}

interface SessionRowGroup {
  session_id: string;
  date: string;
  recordsByPlayer: Map<string, DailyRecord>;
  dailyRecords: DailyRecord[];
  gameCount: number;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  players,
  dailyRecords,
  gameDetails,
  currentRules,
  onEditSession,
  onDeleteSession,
  onBack,
}) => {
  const [selectedPeriod, setSelectedPeriod] = useState<string>('ALL');
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    dailyRecords.forEach((r) => {
      if (r.date && r.date.length >= 4) {
        years.add(r.date.slice(0, 4));
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [dailyRecords]);

  // Filter records & details by selected period
  const { filteredDaily, filteredGames } = useMemo(() => {
    if (selectedPeriod === 'ALL') {
      return { filteredDaily: dailyRecords, filteredGames: gameDetails };
    }
    return {
      filteredDaily: dailyRecords.filter((r) =>
        r.date.startsWith(selectedPeriod)
      ),
      filteredGames: gameDetails.filter((g) =>
        g.date.startsWith(selectedPeriod)
      ),
    };
  }, [dailyRecords, gameDetails, selectedPeriod]);

  // Columns: all active players + deleted players who have records in the selected period
  const visibleColumns: Player[] = useMemo(() => {
    const periodPlayerIds = new Set<string>();
    filteredDaily.forEach((r) => periodPlayerIds.add(r.player_id));
    filteredGames.forEach((g) => periodPlayerIds.add(g.player_id));

    const cols: Player[] = [];
    const seen = new Set<string>();

    for (const p of players) {
      if (p.is_active || periodPlayerIds.has(p.player_id)) {
        cols.push(p);
        seen.add(p.player_id);
      }
    }
    // Fallback for any orphaned IDs in records
    filteredDaily.forEach((r) => {
      if (!seen.has(r.player_id)) {
        seen.add(r.player_id);
        cols.push({
          player_id: r.player_id,
          name: r.player_name,
          is_active: false,
          created_at: '',
        });
      }
    });
    return cols;
  }, [players, filteredDaily, filteredGames]);

  // Group rows by session_id (supports multiple sessions on the same date)
  const sessionRows: SessionRowGroup[] = useMemo(() => {
    const map = new Map<string, DailyRecord[]>();
    filteredDaily.forEach((r) => {
      const list = map.get(r.session_id) ?? [];
      list.push(r);
      map.set(r.session_id, list);
    });

    const gameNumMap = new Map<string, Set<number>>();
    filteredGames.forEach((g) => {
      const set = gameNumMap.get(g.session_id) ?? new Set<number>();
      set.add(g.game_number);
      gameNumMap.set(g.session_id, set);
    });

    const groups: SessionRowGroup[] = Array.from(map.entries()).map(
      ([session_id, recs]) => {
        const byPlayer = new Map(recs.map((r) => [r.player_id, r]));
        return {
          session_id,
          date: recs[0]?.date ?? '',
          recordsByPlayer: byPlayer,
          dailyRecords: recs,
          gameCount: gameNumMap.get(session_id)?.size ?? 0,
        };
      }
    );

    // Reverse order for same date so newer entries appear on top, then sort date desc
    return groups.reverse().sort((a, b) => b.date.localeCompare(a.date));
  }, [filteredDaily, filteredGames]);

  // Summary metrics per player column
  const summaryByPlayer = useMemo(() => {
    const totalPoints: Record<string, number> = {};
    const gameCounts: Record<string, number> = {};
    const rankSum: Record<string, number> = {};

    filteredDaily.forEach((r) => {
      totalPoints[r.player_id] = normalizeZero(
        (totalPoints[r.player_id] ?? 0) + r.total_point
      );
    });
    filteredGames.forEach((g) => {
      gameCounts[g.player_id] = (gameCounts[g.player_id] ?? 0) + 1;
      rankSum[g.player_id] = (rankSum[g.player_id] ?? 0) + g.rank;
    });

    const avgRank: Record<string, string> = {};
    visibleColumns.forEach((p) => {
      const count = gameCounts[p.player_id] ?? 0;
      avgRank[p.player_id] =
        count > 0 ? (rankSum[p.player_id] / count).toFixed(2) : 'ー';
    });

    return { totalPoints, gameCounts, avgRank };
  }, [filteredDaily, filteredGames, visibleColumns]);

  const activeDetailSession = useMemo(() => {
    if (!detailSessionId) return null;
    const recs = dailyRecords.filter((r) => r.session_id === detailSessionId);
    if (recs.length === 0) return null;
    const details = gameDetails.filter((g) => g.session_id === detailSessionId);
    return {
      sessionId: detailSessionId,
      date: recs[0].date,
      dailyRecords: recs,
      gameDetails: details,
    };
  }, [detailSessionId, dailyRecords, gameDetails]);

  const pointClass = (val: number) =>
    val > 0 ? 'point-pos' : val < 0 ? 'point-neg' : 'point-zero';

  return (
    <div className="flex-1 flex flex-col gap-3 min-h-0">
      {/* Toolbar */}
      <div className="surface-card px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-lg font-bold">過去データ</h2>
          <p
            className="text-xs tabular-nums"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {selectedPeriod === 'ALL' ? '全期間' : `${selectedPeriod}年`} ·{' '}
            {sessionRows.length} 対局（行をタップで詳細表示）
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setPeriodModalOpen(true)}
          >
            <Calendar size={16} />
            <span>
              期間: {selectedPeriod === 'ALL' ? '全期間' : `${selectedPeriod}年`}
            </span>
          </button>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            戻る
          </button>
        </div>
      </div>

      {/* Scrollable Sticky History Table */}
      <div className="sticky-table-wrap">
        <table className="score-table history-table">
          <thead>
            <tr className="header-names">
              <th className="sticky-col">日付</th>
              {visibleColumns.map((p) => (
                <th key={p.player_id}>
                  <span className="block truncate max-w-[110px] mx-auto">
                    {p.name}
                  </span>
                </th>
              ))}
            </tr>
            <tr className="summary-row-1">
              <th className="sticky-col">合計</th>
              {visibleColumns.map((p) => {
                const pt = summaryByPlayer.totalPoints[p.player_id] ?? 0;
                return (
                  <td
                    key={p.player_id}
                    className={`font-bold tabular-nums ${pointClass(pt)}`}
                  >
                    {formatPoint(pt)}
                  </td>
                );
              })}
            </tr>
            <tr className="summary-row-2">
              <th className="sticky-col">試合数</th>
              {visibleColumns.map((p) => (
                <td
                  key={p.player_id}
                  className="tabular-nums"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {summaryByPlayer.gameCounts[p.player_id] ?? 0}戦
                </td>
              ))}
            </tr>
            <tr className="summary-row-3">
              <th className="sticky-col">平均順位</th>
              {visibleColumns.map((p) => (
                <td
                  key={p.player_id}
                  className="tabular-nums"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {summaryByPlayer.avgRank[p.player_id]}
                </td>
              ))}
            </tr>
          </thead>

          <tbody>
            {sessionRows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(visibleColumns.length + 1, 2)}
                  className="py-12 text-sm"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  該当期間の対局データがありません。
                </td>
              </tr>
            ) : (
              sessionRows.map((row) => (
                <tr
                  key={row.session_id}
                  onClick={() => setDetailSessionId(row.session_id)}
                  className="cursor-pointer hover:bg-[#faf9f5] transition-colors"
                >
                  <th className="sticky-col">
                    <div className="tabular-nums text-xs font-bold">
                      {row.date}
                    </div>
                    <div
                      className="text-[11px] font-normal tabular-nums"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {row.gameCount}戦
                    </div>
                  </th>
                  {visibleColumns.map((p) => {
                    const rec = row.recordsByPlayer.get(p.player_id);
                    if (!rec) {
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
                      <td
                        key={p.player_id}
                        className={`text-sm font-bold tabular-nums ${pointClass(
                          rec.total_point
                        )}`}
                      >
                        {formatPoint(rec.total_point)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Period Filter Modal */}
      {periodModalOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(26, 27, 25, 0.5)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="period-modal-title"
        >
          <div className="surface-card w-full max-w-sm overflow-hidden shadow-2xl">
            <div
              className="px-5 py-3.5 border-b flex items-center justify-between"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <h3 id="period-modal-title" className="text-base font-bold">
                集計期間の選択
              </h3>
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label="閉じる"
                onClick={() => setPeriodModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedPeriod('ALL');
                  setPeriodModalOpen(false);
                }}
                className="btn w-full justify-between"
                style={{
                  backgroundColor:
                    selectedPeriod === 'ALL'
                      ? 'var(--color-accent-soft)'
                      : 'var(--color-surface)',
                  borderColor:
                    selectedPeriod === 'ALL'
                      ? 'var(--color-accent)'
                      : 'var(--color-border-strong)',
                  color:
                    selectedPeriod === 'ALL'
                      ? 'var(--color-accent)'
                      : 'var(--color-text)',
                }}
              >
                <span>全期間</span>
              </button>
              {availableYears.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => {
                    setSelectedPeriod(year);
                    setPeriodModalOpen(false);
                  }}
                  className="btn w-full justify-between tabular-nums"
                  style={{
                    backgroundColor:
                      selectedPeriod === year
                        ? 'var(--color-accent-soft)'
                        : 'var(--color-surface)',
                    borderColor:
                      selectedPeriod === year
                        ? 'var(--color-accent)'
                        : 'var(--color-border-strong)',
                    color:
                      selectedPeriod === year
                        ? 'var(--color-accent)'
                        : 'var(--color-text)',
                  }}
                >
                  <span>{year}年</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Session Detail Modal */}
      {activeDetailSession && (
        <HistoryDetailModal
          open={Boolean(activeDetailSession)}
          sessionId={activeDetailSession.sessionId}
          date={activeDetailSession.date}
          dailyRecords={activeDetailSession.dailyRecords}
          gameDetails={activeDetailSession.gameDetails}
          players={players}
          currentRules={currentRules}
          onEdit={(draft) => {
            setDetailSessionId(null);
            onEditSession(draft);
          }}
          onDelete={onDeleteSession}
          onClose={() => setDetailSessionId(null)}
        />
      )}
    </div>
  );
};
