'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

type PlanPrices = Record<'3d' | '1m' | '3m' | '6m' | '12m', number>;
type PlanDevicePrices = Record<'3d' | '1m' | '3m' | '6m' | '12m', Record<number, number>>;

type Settings = {
  referralPercent: number;
  referralBonusRub: number;
  welcomeBonusRub: number;
  planPrices: PlanPrices;
  planDevicePrices?: PlanDevicePrices;
};

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [referralPercent, setReferralPercent] = useState('');
  const [referralBonusRub, setReferralBonusRub] = useState('');
  const [welcomeBonusRub, setWelcomeBonusRub] = useState('');
  const [prices, setPrices] = useState<Partial<PlanPrices>>({});
  const [devicePrices, setDevicePrices] = useState<PlanDevicePrices | null>(null);
  const [saving, setSaving] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [wipeConfirm, setWipeConfirm] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('admin_token')) {
      router.replace('/login');
      return;
    }
    api<Settings>('/admin/settings')
      .then((s) => {
        setSettings(s);
        setReferralPercent(String(s.referralPercent));
        setReferralBonusRub(String(s.referralBonusRub));
        setWelcomeBonusRub(String(s.welcomeBonusRub));
        setPrices(s.planPrices);
        setDevicePrices(s.planDevicePrices ?? null);
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await api<Settings>('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          referralPercent: referralPercent ? parseInt(referralPercent, 10) : undefined,
          referralBonusRub: referralBonusRub !== '' ? parseInt(referralBonusRub, 10) : undefined,
          welcomeBonusRub: welcomeBonusRub !== '' ? parseInt(welcomeBonusRub, 10) : undefined,
          planPrices: Object.keys(prices).length ? prices : undefined,
          planDevicePrices: devicePrices ?? undefined,
        }),
      });
      setSettings(updated);
      setPrices(updated.planPrices);
      setDevicePrices(updated.planDevicePrices ?? null);
      setReferralPercent(String(updated.referralPercent));
      setReferralBonusRub(String(updated.referralBonusRub));
      setWelcomeBonusRub(String(updated.welcomeBonusRub));
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  async function onWipe() {
    if (wipeConfirm !== 'удалить') return;
    setWiping(true);
    try {
      await api<{ ok: boolean }>('/admin/wipe', { method: 'POST' });
      setWipeConfirm('');
      window.alert('Все данные удалены.');
    } catch (e) {
      console.error(e);
      window.alert('Ошибка при удалении.');
    } finally {
      setWiping(false);
    }
  }

  if (!settings) {
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
        <Link href="/users" className="text-slate-400 hover:text-white">Пользователи</Link>
        <Link href="/nodes" className="text-slate-400 hover:text-white">Ноды</Link>
        <Link href="/broadcast" className="text-slate-400 hover:text-white">Рассылка</Link>
        <Link href="/bot-texts" className="text-slate-400 hover:text-white">Тексты бота</Link>
        <Link href="/settings" className="text-indigo-400 font-medium">Настройки</Link>
      </nav>
      <h1 className="text-2xl font-bold mb-6">Настройки</h1>
      <form onSubmit={onSave} className="max-w-md space-y-6">
        <div>
          <label className="block text-slate-400 text-sm mb-1">Приветственный бонус (₽)</label>
          <input
            type="number"
            min={0}
            value={welcomeBonusRub}
            onChange={(e) => setWelcomeBonusRub(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white"
          />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1">Бонус приглашённому (₽)</label>
          <input
            type="number"
            min={0}
            value={referralBonusRub}
            onChange={(e) => setReferralBonusRub(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white"
          />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-1">Процент от пополнений приглашённых (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            value={referralPercent}
            onChange={(e) => setReferralPercent(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white"
          />
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-2">Базовые цены тарифов (₽, для продления)</label>
          <div className="grid grid-cols-2 gap-2">
            {(['3d', '1m', '3m', '6m', '12m'] as const).map((plan) => (
              <div key={plan}>
                <label className="text-slate-500 text-xs">{plan}</label>
                <input
                  type="number"
                  min={0}
                  value={prices[plan] ?? ''}
                  onChange={(e) => setPrices((prev) => ({ ...prev, [plan]: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-600 text-white"
                />
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-slate-400 text-sm mb-2">Цены по количеству устройств (₽, для покупки)</label>
          <p className="text-slate-500 text-xs mb-2">План × устройства. Пустые значения = базовая цена × кол-во устройств</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-600">
                  <th className="text-left py-2 pr-4 text-slate-400">План</th>
                  {[1, 2, 3, 4, 5].map((d) => (
                    <th key={d} className="py-2 px-2 text-slate-400">{d} устр.</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(['3d', '1m', '3m', '6m', '12m'] as const).map((plan) => (
                  <tr key={plan} className="border-b border-slate-700">
                    <td className="py-2 pr-4">{plan}</td>
                    {[1, 2, 3, 4, 5].map((devices) => (
                      <td key={devices} className="py-1 px-1">
                        <input
                          type="number"
                          min={0}
                          placeholder={String((prices[plan] ?? 0) * devices)}
                          value={devicePrices?.[plan]?.[devices] ?? ''}
                          onChange={(e) => {
                            const v = e.target.value ? Number(e.target.value) : undefined;
                            setDevicePrices((prev) => {
                              const next = { ...(prev ?? {}) } as PlanDevicePrices;
                              if (!next[plan]) next[plan] = {};
                              if (v !== undefined && v > 0) next[plan][devices] = v;
                              else delete next[plan][devices];
                              return next;
                            });
                          }}
                          className="w-20 px-2 py-1 rounded bg-slate-800 border border-slate-600 text-white placeholder-slate-500"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
      </form>
      <div className="mt-12 pt-8 border-t border-slate-700">
        <h2 className="text-lg font-semibold text-amber-500 mb-2">Удалить все данные (мок)</h2>
        <p className="text-slate-400 text-sm mb-3">
          Удалит всех пользователей, подписки, платежи, ноды и настройки. Для сброса тестовых данных.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder='Введите "удалить" для подтверждения'
            value={wipeConfirm}
            onChange={(e) => setWipeConfirm(e.target.value)}
            className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white placeholder-slate-500 w-64"
          />
          <button
            type="button"
            onClick={onWipe}
            disabled={wiping || wipeConfirm !== 'удалить'}
            className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white"
          >
            {wiping ? 'Удаление...' : 'Удалить данные'}
          </button>
        </div>
      </div>
    </div>
  );
}
