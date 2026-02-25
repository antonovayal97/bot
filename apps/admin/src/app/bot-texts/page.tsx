'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

const GROUP_LABELS: Record<string, string> = {
  start: 'Старт / Главное меню',
  referral: 'Команда /referral',
  renew: 'Купить / Продлить',
  plans: 'Тарифы',
  configs: 'Мои конфиги',
  referrals: 'Реферальная программа',
  instructions: 'Инструкция по установке',
  about: 'О сервисе (правила)',
  help: 'Справка',
  support: 'Поддержка',
  expiring: 'Напоминания',
};

function getGroup(key: string): string {
  const idx = key.indexOf('_');
  return idx > 0 ? key.slice(0, idx) : 'other';
}

export default function BotTextsPage() {
  const router = useRouter();
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('admin_token')) {
      router.replace('/login');
      return;
    }
    api<Record<string, string>>('/admin/bot-texts')
      .then(setTexts)
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api<Record<string, string>>('/admin/bot-texts', {
        method: 'PUT',
        body: JSON.stringify(texts),
      });
      setTexts(updated);
    } catch (e) {
      console.error(e);
      window.alert('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Загрузка...</div>
      </div>
    );
  }

  const keys = Object.keys(texts).sort();
  const byGroup = keys.reduce<Record<string, string[]>>((acc, k) => {
    const g = getGroup(k);
    if (!acc[g]) acc[g] = [];
    acc[g].push(k);
    return acc;
  }, {});

  return (
    <div className="min-h-screen p-6">
      <nav className="flex gap-4 mb-8 border-b border-slate-700 pb-4">
        <Link href="/" className="text-slate-400 hover:text-white">
          Dashboard
        </Link>
        <Link href="/users" className="text-slate-400 hover:text-white">
          Пользователи
        </Link>
        <Link href="/nodes" className="text-slate-400 hover:text-white">
          Ноды
        </Link>
        <Link href="/broadcast" className="text-slate-400 hover:text-white">
          Рассылка
        </Link>
        <Link href="/bot-texts" className="text-indigo-400 font-medium">
          Тексты бота
        </Link>
        <Link href="/settings" className="text-slate-400 hover:text-white">
          Настройки
        </Link>
      </nav>
      <h1 className="text-2xl font-bold mb-2">CMS — Тексты бота</h1>
      <p className="text-slate-400 text-sm mb-6">
        Изменения применятся после перезапуска бота. Placeholders: {'{{key}}'} — подставляются автоматически.
      </p>
      <form onSubmit={handleSave} className="space-y-8">
        {Object.entries(byGroup).map(([group, groupKeys]) => (
          <div key={group} className="p-4 rounded-lg bg-slate-800 border border-slate-700">
            <h2 className="text-lg font-semibold mb-4 text-slate-200">
              {GROUP_LABELS[group] ?? group}
            </h2>
            <div className="space-y-4">
              {groupKeys.map((key) => (
                <div key={key}>
                  <label className="block text-slate-400 text-sm mb-1 font-mono">{key}</label>
                  <textarea
                    value={texts[key] ?? ''}
                    onChange={(e) => setTexts((prev) => ({ ...prev, [key]: e.target.value }))}
                    rows={texts[key]?.includes('\n') ? Math.min(8, texts[key].split('\n').length + 1) : 2}
                    className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white text-sm font-mono"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </form>
    </div>
  );
}
