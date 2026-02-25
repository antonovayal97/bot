'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getToken } from '@/lib/api';

type Stats = { usersCount: number; activeSubscriptions: number; revenueMonth: number };
type Registrations = Record<string, number>;

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [registrations, setRegistrations] = useState<Registrations | null>(null);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) {
      router.replace('/login');
      return;
    }
    Promise.all([
      api<Stats>('/admin/dashboard/stats'),
      api<Registrations>('/admin/dashboard/registrations?days=30'),
    ])
      .then(([s, r]) => {
        setStats(s);
        setRegistrations(r);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Загрузка...</div>
      </div>
    );
  }

  const regEntries = registrations
    ? Object.entries(registrations).sort(([a], [b]) => a.localeCompare(b))
    : [];

  return (
    <div className="min-h-screen p-6">
      <nav className="flex gap-4 mb-8 border-b border-slate-700 pb-4">
        <Link href="/" className="text-indigo-400 font-medium">Dashboard</Link>
        <Link href="/users" className="text-slate-400 hover:text-white">Пользователи</Link>
        <Link href="/nodes" className="text-slate-400 hover:text-white">Ноды</Link>
        <Link href="/broadcast" className="text-slate-400 hover:text-white">Рассылка</Link>
        <Link href="/bot-texts" className="text-slate-400 hover:text-white">Тексты бота</Link>
        <Link href="/settings" className="text-slate-400 hover:text-white">Настройки</Link>
      </nav>
      <h1 className="text-2xl font-bold mb-6">Дашборд</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
          <p className="text-slate-400 text-sm">Пользователей</p>
          <p className="text-2xl font-bold">{stats.usersCount}</p>
        </div>
        <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
          <p className="text-slate-400 text-sm">Активных подписок</p>
          <p className="text-2xl font-bold">{stats.activeSubscriptions}</p>
        </div>
        <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
          <p className="text-slate-400 text-sm">Доход за месяц (₽)</p>
          <p className="text-2xl font-bold">{stats.revenueMonth}</p>
        </div>
      </div>
      <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
        <h2 className="text-lg font-semibold mb-4">Регистрации за 30 дней</h2>
        <div className="flex flex-wrap gap-2">
          {regEntries.map(([day, count]) => (
            <span
              key={day}
              className="px-2 py-1 rounded bg-slate-700 text-sm"
              title={`${day}: ${count}`}
            >
              {day}: {count}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
