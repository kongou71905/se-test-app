import React from 'react';
import {
  ChevronRight,
  ClipboardEdit,
  History,
  Settings2,
  Sliders,
  Users,
} from 'lucide-react';
import { AppView, RuleConfig, StorageMode } from '../types/mahjong';
import { getRuleSummaryText } from '../utils/mahjongCalc';

interface TopViewProps {
  rules: RuleConfig;
  activePlayerCount: number;
  sessionCount: number;
  storageMode: StorageMode;
  onNavigate: (view: AppView) => void;
}

export const TopView: React.FC<TopViewProps> = ({
  rules,
  activePlayerCount,
  sessionCount,
  storageMode,
  onNavigate,
}) => {
  const menuItems: {
    view: AppView;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
  }[] = [
    {
      view: 'history',
      title: '過去データ',
      subtitle: `保存済み ${sessionCount} 対局の成績確認・編集・削除`,
      icon: <History size={20} />,
    },
    {
      view: 'players',
      title: '対局者管理',
      subtitle: `登録中 ${activePlayerCount} 名の追加・名前変更・削除`,
      icon: <Users size={20} />,
    },
    {
      view: 'rules',
      title: 'ルール設定',
      subtitle: getRuleSummaryText(rules),
      icon: <Sliders size={20} />,
    },
    {
      view: 'connection',
      title: '接続設定',
      subtitle:
        storageMode === 'gas'
          ? 'GAS URL設定済み · 共有リンク発行・接続テスト'
          : 'ブラウザ保存で動作中 · GAS URL登録・テスト',
      icon: <Settings2 size={20} />,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Primary Action Card */}
      <section className="surface-card p-6">
        <p
          className="text-xs font-medium"
          style={{ color: 'var(--color-text-muted)' }}
        >
          現在の適用ルール · {getRuleSummaryText(rules)}
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight">
          対局をはじめる
        </h2>
        <p
          className="mt-1.5 text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          対局日と参加対局者（4名以上）を選んでスコア入力を開始します。
        </p>
        <div className="mt-5">
          <button
            type="button"
            className="btn btn-primary w-full sm:w-auto min-w-[220px] h-12 text-base"
            onClick={() => onNavigate('setup')}
          >
            <ClipboardEdit size={18} />
            <span>成績入力</span>
          </button>
        </div>
      </section>

      {/* Secondary Navigation List */}
      <nav className="surface-card overflow-hidden" aria-label="メインメニュー">
        {menuItems.map((item, idx) => (
          <button
            key={item.view}
            type="button"
            onClick={() => onNavigate(item.view)}
            className="w-full px-5 py-4 flex items-center justify-between gap-4 text-left transition-colors hover:bg-[#faf9f5] cursor-pointer"
            style={{
              minHeight: '64px',
              borderTop: idx === 0 ? 'none' : '1px solid var(--color-border)',
              backgroundColor: 'transparent',
            }}
          >
            <div className="flex items-center gap-4 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'var(--color-surface-subtle)',
                  color: 'var(--color-text)',
                }}
              >
                {item.icon}
              </div>
              <div className="min-w-0">
                <div className="text-base font-bold">{item.title}</div>
                <div
                  className="text-xs mt-0.5 truncate"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {item.subtitle}
                </div>
              </div>
            </div>
            <ChevronRight
              size={18}
              className="shrink-0"
              style={{ color: 'var(--color-text-muted)' }}
            />
          </button>
        ))}
      </nav>
    </div>
  );
};
