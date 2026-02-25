'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

type Filter = 'with_subscriptions' | 'all' | 'without_subscriptions';

const FILTER_LABELS: Record<Filter, string> = {
  with_subscriptions: 'С активной подпиской',
  all: 'Все пользователи',
  without_subscriptions: 'Без подписки',
};

export default function BroadcastPage() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [count, setCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [sending, setSending] = useState(false);
  const [testUser, setTestUser] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'error' | null>(null);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('admin_token')) {
      router.replace('/login');
      return;
    }
  }, [router]);

  async function fetchCount() {
    setLoadingCount(true);
    try {
      const res = await api<{ count: number; filter: Filter }>(
        `/admin/broadcast/count?filter=${filter}`,
      );
      setCount(res.count);
    } catch {
      setCount(null);
    } finally {
      setLoadingCount(false);
    }
  }

  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('admin_token')) {
      fetchCount();
    }
  }, [filter]);

  async function handleTest(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setError('Введите текст сообщения');
      return;
    }
    if (!testUser.trim()) {
      setError('Введите Telegram ID тестового пользователя');
      return;
    }
    setError(null);
    setTestResult(null);
    setTesting(true);
    try {
      const res = await api<{ ok?: boolean } | { error: string }>('/admin/broadcast/test', {
        method: 'POST',
        body: JSON.stringify({ text: text.trim(), telegramId: testUser.trim() }),
      });
      if ('error' in res) {
        setError(res.error);
        setTestResult('error');
      } else {
        setTestResult('ok');
      }
    } catch (e) {
      let msg = 'Не удалось отправить';
      if (e instanceof Error && e.message) {
        try {
          const parsed = JSON.parse(e.message) as { message?: string };
          if (parsed.message) msg = parsed.message;
        } catch {
          msg = e.message;
        }
      }
      setError(msg);
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setError('Введите текст сообщения');
      return;
    }
    setError(null);
    setResult(null);
    setTestResult(null);
    setSending(true);
    try {
      const res = await api<{ sent: number; failed: number } | { error: string }>(
        '/admin/broadcast',
        {
          method: 'POST',
          body: JSON.stringify({ text: text.trim(), filter }),
        },
      );
      if ('error' in res) {
        setError(res.error);
      } else {
        setResult(res);
      }
    } catch (e) {
      let msg = 'Не удалось отправить';
      if (e instanceof Error && e.message) {
        try {
          const parsed = JSON.parse(e.message) as { message?: string };
          if (parsed.message) msg = parsed.message;
        } catch {
          msg = e.message;
        }
      }
      setError(msg);
    } finally {
      setSending(false);
    }
  }

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
        <Link href="/broadcast" className="text-indigo-400 font-medium">
          Рассылка
        </Link>
        <Link href="/bot-texts" className="text-slate-400 hover:text-white">
          Тексты бота
        </Link>
        <Link href="/settings" className="text-slate-400 hover:text-white">
          Настройки
        </Link>
      </nav>
      <h1 className="text-2xl font-bold mb-6">Массовая рассылка</h1>
      <form
        onSubmit={handleSubmit}
        className="max-w-2xl p-4 rounded-lg bg-slate-800 border border-slate-700 space-y-4"
      >
        <div>
          <label className="block text-slate-400 text-sm mb-1">Получатели</label>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => (
              <label key={f} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="filter"
                  checked={filter === f}
                  onChange={() => setFilter(f)}
                  className="rounded-full"
                />
                <span className="text-slate-300">{FILTER_LABELS[f]}</span>
              </label>
            ))}
          </div>
          <p className="text-slate-500 text-sm mt-1">
            {loadingCount ? '…' : count !== null ? `Будет отправлено: ${count} пользователей` : ''}
          </p>
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1">Текст сообщения (HTML)</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Например: <b>Важно!</b> Обновление сервиса..."
            rows={6}
            className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white font-mono text-sm"
          />
          <p className="text-slate-500 text-xs mt-1">
            Поддерживается HTML: &lt;b&gt;, &lt;i&gt;, &lt;code&gt;, &lt;a href=&quot;...&quot;&gt;
          </p>
        </div>
        <div className="flex gap-4 items-end flex-wrap p-3 rounded bg-slate-800/50 border border-slate-700">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-slate-400 text-sm mb-1">Тестовый пользователь</label>
            <input
              type="text"
              value={testUser}
              onChange={(e) => {
                setTestUser(e.target.value);
                setTestResult(null);
              }}
              placeholder="Telegram ID (например 123456789)"
              className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white font-mono"
            />
          </div>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !text.trim() || !testUser.trim()}
            className="px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50"
          >
            {testing ? 'Отправка…' : 'Тестировать'}
          </button>
          {testResult === 'ok' && (
            <span className="text-green-400 text-sm">✓ Отправлено</span>
          )}
        </div>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {result && (
          <div className="p-2 rounded bg-slate-700 text-sm">
            Отправлено: {result.sent}, ошибок: {result.failed}
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={sending || (count !== null && count === 0)}
            className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
          >
            {sending ? 'Отправка…' : 'Отправить'}
          </button>
          <button
            type="button"
            onClick={fetchCount}
            disabled={loadingCount}
            className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-50"
          >
            Обновить счётчик
          </button>
        </div>
      </form>
    </div>
  );
}
