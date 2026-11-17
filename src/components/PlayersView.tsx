import React, { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Player } from '../types/mahjong';
import {
  getHalfWidthLength,
  validatePlayerName,
} from '../utils/mahjongCalc';
import { ConfirmModal } from './ConfirmModal';

interface PlayersViewProps {
  players: Player[];
  onSavePlayers: (
    payload: { player_id: string; name: string; is_active: boolean }[]
  ) => Promise<void>;
  onBack: () => void;
}

export const PlayersView: React.FC<PlayersViewProps> = ({
  players,
  onSavePlayers,
  onBack,
}) => {
  const [newName, setNewName] = useState('');
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editName, setEditName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activePlayers = players.filter((p) => p.is_active);
  const deletedPlayers = players.filter((p) => !p.is_active);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = newName.trim();
    const msg = validatePlayerName(trimmed, players);
    if (msg) {
      setError(msg);
      return;
    }
    setBusy(true);
    try {
      await onSavePlayers([
        { player_id: '', name: trimmed, is_active: true },
      ]);
      setNewName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登録に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;
    setError(null);
    const trimmed = editName.trim();
    const msg = validatePlayerName(trimmed, players, editingPlayer.player_id);
    if (msg) {
      setError(msg);
      return;
    }
    setBusy(true);
    try {
      await onSavePlayers([
        {
          player_id: editingPlayer.player_id,
          name: trimmed,
          is_active: true,
        },
      ]);
      setEditingPlayer(null);
      setEditName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    setError(null);
    try {
      await onSavePlayers([
        {
          player_id: deleteTarget.player_id,
          name: deleteTarget.name,
          is_active: false,
        },
      ]);
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Add Player Form */}
      <section className="surface-card p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">対局者管理</h2>
            <p
              className="mt-1 text-sm"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              全角8文字（半角16文字）まで登録できます。論理削除した対局者と同名の再登録はできません。
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            戻る
          </button>
        </div>

        <form onSubmit={handleAdd} className="mt-5 flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="text"
              className="input-field"
              placeholder="新しい対局者名（例: 田中）"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setError(null);
              }}
            />
            <div
              className="mt-1 text-xs tabular-nums"
              style={{ color: 'var(--color-text-muted)' }}
            >
              文字数（半角換算）: {getHalfWidthLength(newName.trim())} / 16
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary sm:self-start"
            disabled={busy || !newName.trim()}
          >
            <Plus size={18} />
            <span>登録</span>
          </button>
        </form>

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
      </section>

      {/* Active Players List */}
      <section className="surface-card overflow-hidden">
        <div
          className="px-5 py-3.5 border-b flex items-center justify-between"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <h3 className="text-sm font-bold">
            有効な対局者（{activePlayers.length}名）
          </h3>
        </div>

        {activePlayers.length === 0 ? (
          <div
            className="p-8 text-center text-sm"
            style={{ color: 'var(--color-text-muted)' }}
          >
            対局者がまだ登録されていません。上の入力欄から4名以上登録してください。
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {activePlayers.map((player) => {
              const isEditing = editingPlayer?.player_id === player.player_id;
              return (
                <div
                  key={player.player_id}
                  className="px-5 py-3 flex items-center justify-between gap-3"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  {isEditing ? (
                    <form
                      onSubmit={handleSaveEdit}
                      className="flex-1 flex flex-wrap items-center gap-2"
                    >
                      <input
                        type="text"
                        className="input-field flex-1 min-w-[160px]"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={busy}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={busy}
                        onClick={() => {
                          setEditingPlayer(null);
                          setEditName('');
                          setError(null);
                        }}
                      >
                        取消
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <div className="text-base font-semibold truncate">
                          {player.name}
                        </div>
                        <div
                          className="text-xs tabular-nums"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          ID: {player.player_id}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          className="btn btn-secondary btn-icon"
                          aria-label={`${player.name}を編集`}
                          onClick={() => {
                            setEditingPlayer(player);
                            setEditName(player.name);
                            setError(null);
                          }}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-icon"
                          aria-label={`${player.name}を削除`}
                          onClick={() => setDeleteTarget(player)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Soft-deleted Players Reference */}
      {deletedPlayers.length > 0 && (
        <section className="surface-card p-5">
          <h3
            className="text-xs font-bold mb-2"
            style={{ color: 'var(--color-text-muted)' }}
          >
            削除済み対局者（過去データ表示用・同名再登録不可）
          </h3>
          <div
            className="text-sm flex flex-wrap gap-x-4 gap-y-1"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {deletedPlayers.map((p) => (
              <span key={p.player_id}>
                {p.name} ({p.player_id})
              </span>
            ))}
          </div>
        </section>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="対局者を削除"
        message={
          deleteTarget
            ? `「${deleteTarget.name}」を削除しますか？\n過去の成績データには影響しませんが、新規対局では選択できなくなります。`
            : ''
        }
        confirmLabel="削除する"
        confirmTone="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
