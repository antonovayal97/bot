'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

type User = {
  id: string;
  telegramId: string;
  username: string | null;
  subscriptionUntil: string | null;
  referralCode: string;
  assignedNode: { name: string } | null;
  createdAt: string;
};

type List = { list: User[]; total: number };

export default function UsersPage() {
  const router = useRouter();
  const [data, setData] = useState<List | null>(null);
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('admin_token')) {
      router.replace('/login');
      return;
    }
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (activeOnly) params.set('activeOnly', 'true');
    api<List>(`/admin/users?${params}`)
      .then(setData)
      .catch(() => router.replace('/login'));
  }, [search, activeOnly, router]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <nav className="flex gap-4 mb-8 border-b border-slate-700 pb-4">
        <Link href="/" className="text-slate-400 hover:text-white">Dashboard</Link>
        <Link href="/users" className="text-indigo-400 font-medium">Пользователи</Link>
        <Link href="/nodes" className="text-slate-400 hover:text-white">Ноды</Link>
        <Link href="/broadcast" className="text-slate-400 hover:text-white">Рассылка</Link>
        <Link href="/bot-texts" className="text-slate-400 hover:text-white">Тексты бота</Link>
        <Link href="/settings" className="text-slate-400 hover:text-white">Настройки</Link>
      </nav>
      <h1 className="text-2xl font-bold mb-6">Пользователи</h1>
      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Поиск (telegram, username, код)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white w-80"
        />
        <label className="flex items-center gap-2 text-slate-400">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
            className="rounded"
          />
          Только с активной подпиской
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-left">
          <thead className="bg-slate-800">
            <tr>
              <th className="px-4 py-2">Telegram ID</th>
              <th className="px-4 py-2">Username</th>
              <th className="px-4 py-2">Подписка до</th>
              <th className="px-4 py-2">Реферальный код</th>
              <th className="px-4 py-2">Регистрация</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.list.map((u) => (
              <tr key={u.id} className="border-t border-slate-700 hover:bg-slate-800/50">
                <td className="px-4 py-2">{u.telegramId}</td>
                <td className="px-4 py-2">@{u.username || '—'}</td>
                <td className="px-4 py-2">
                  {u.subscriptionUntil
                    ? new Date(u.subscriptionUntil).toLocaleDateString('ru-RU')
                    : '—'}
                </td>
                <td className="px-4 py-2 font-mono text-sm">{u.referralCode}</td>
                <td className="px-4 py-2">{new Date(u.createdAt).toLocaleDateString('ru-RU')}</td>
                <td className="px-4 py-2">
                  <Link href={`/users/${u.id}`} className="text-indigo-400 hover:underline">
                    Детали
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-slate-400 text-sm">Всего: {data.total}</p>
    </div>
  );
}
