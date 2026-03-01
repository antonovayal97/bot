'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getCountryName } from '@vpn-v/shared-types';

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

const BALANCE_TOP_UP_SOURCE_LABELS: Record<string, string> = {
  admin: 'Админ-панель',
  referral_commission: 'От реферала',
  referral_bonus: 'Реферальный бонус',
  payment_gateway: 'Платёжный шлюз',
  riopay: 'RioPay',
  maxelpay: 'MaxelPay',
  welcome_bonus: 'Приветственный бонус',
};

type UserDetail = {
  id: string;
  telegramId: string;
  username: string | null;
  subscriptionUntil: string | null;
  referralCode: string;
  balanceRub: number;
  referralBonusRubOverride: number | null;
  referralPercentOverride: number | null;
  assignedNode: { id: string; name: string; country: string } | null;
  referredByUser: { id: string; telegramId: string; username: string | null; referralCode: string } | null;
  referrals: { id: string; telegramId: string; username: string | null; createdAt: string }[];
  subscriptions: { id: string; plan: string; price: string; startedAt: string; expiresAt: string; status: string; nodeId?: string; node?: { id: string; name: string; country: string }; devices: { id: string; configContent: string }[] }[];
  payments: { id: string; amount: string; status: string; createdAt: string }[];
  balanceTopUps?: { id: string; amount: number; source: string; createdAt: string; relatedUser?: { id: string; telegramId: string; username: string | null } | null }[];
  createdAt: string;
};

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [user, setUser] = useState<UserDetail | null>(null);
  const [balanceAmount, setBalanceAmount] = useState(100);
  const [addingBalance, setAddingBalance] = useState(false);
  const [extendModalSub, setExtendModalSub] = useState<{ id: string; nodeName: string } | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [extendAdminMessage, setExtendAdminMessage] = useState('');
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [deleteModalSub, setDeleteModalSub] = useState<{ id: string; nodeName: string } | null>(null);
  const [deleteAdminMessage, setDeleteAdminMessage] = useState('');
  const [deletingConfigId, setDeletingConfigId] = useState<string | null>(null);
  const [setExpires5Id, setSetExpires5Id] = useState<string | null>(null);
  const [setExpires24Id, setSetExpires24Id] = useState<string | null>(null);
  const [migrateModalSub, setMigrateModalSub] = useState<{ id: string; nodeName: string; nodeId: string } | null>(null);
  const [nodes, setNodes] = useState<{ id: string; name: string; country: string; sshUser?: string | null }[]>([]);
  const [migrateTargetNodeId, setMigrateTargetNodeId] = useState('');
  const [migratingId, setMigratingId] = useState<string | null>(null);
  const [sendMessageText, setSendMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [refBonusOverride, setRefBonusOverride] = useState('');
  const [refPercentOverride, setRefPercentOverride] = useState('');
  const [savingRefOverrides, setSavingRefOverrides] = useState(false);

  const refetch = () => api<UserDetail>(`/admin/users/${id}`).then(setUser);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('admin_token')) {
      router.replace('/login');
      return;
    }
    refetch().catch(() => router.replace('/login'));
  }, [id, router]);

  useEffect(() => {
    if (user) {
      setRefBonusOverride(user.referralBonusRubOverride != null ? String(user.referralBonusRubOverride) : '');
      setRefPercentOverride(user.referralPercentOverride != null ? String(user.referralPercentOverride) : '');
    }
  }, [user]);

  useEffect(() => {
    if (migrateModalSub) {
      api<{ id: string; name: string; country: string; sshUser?: string | null }[]>('/admin/nodes')
        .then(setNodes)
        .catch(() => setNodes([]));
      setMigrateTargetNodeId('');
    }
  }, [migrateModalSub]);

  async function handleExtendSubscription() {
    if (!extendModalSub) return;
    const days = extendDays;
    if (days < 1 || days > 365) return;
    setExtendingId(extendModalSub.id);
    try {
      await api<{ ok: boolean; expiresAt: string }>(`/admin/subscriptions/${extendModalSub.id}/extend`, {
        method: 'POST',
        body: JSON.stringify({ days, adminMessage: extendAdminMessage.trim() || undefined }),
      });
      setExtendModalSub(null);
      setExtendDays(30);
      setExtendAdminMessage('');
      await refetch();
    } catch (e) {
      console.error(e);
    } finally {
      setExtendingId(null);
    }
  }

  async function handleSetExpiresIn5Min(subId: string) {
    setSetExpires5Id(subId);
    try {
      await api<{ ok: boolean; expiresAt: string }>(`/admin/subscriptions/${subId}/set-expires-in-5min`, { method: 'POST' });
      await refetch();
    } catch (e) {
      console.error(e);
      window.alert('Ошибка');
    } finally {
      setSetExpires5Id(null);
    }
  }

  async function handleMigrateSubscription() {
    if (!migrateModalSub || !migrateTargetNodeId.trim()) return;
    setMigratingId(migrateModalSub.id);
    try {
      await api<{ ok: boolean }>(`/admin/subscriptions/${migrateModalSub.id}/migrate`, {
        method: 'POST',
        body: JSON.stringify({ targetNodeId: migrateTargetNodeId.trim() }),
      });
      setMigrateModalSub(null);
      setMigrateTargetNodeId('');
      await refetch();
    } catch (e) {
      console.error(e);
      window.alert(e instanceof Error ? e.message : 'Ошибка миграции');
    } finally {
      setMigratingId(null);
    }
  }

  async function handleSetExpiresIn24h(subId: string) {
    setSetExpires24Id(subId);
    try {
      await api<{ ok: boolean; expiresAt: string }>(`/admin/subscriptions/${subId}/set-expires-in-24h`, { method: 'POST' });
      await refetch();
    } catch (e) {
      console.error(e);
      window.alert('Ошибка');
    } finally {
      setSetExpires24Id(null);
    }
  }

  async function handleDeleteConfig() {
    if (!deleteModalSub) return;
    setDeletingConfigId(deleteModalSub.id);
    try {
      await api<{ ok: boolean }>(`/admin/subscriptions/${deleteModalSub.id}/delete-config`, {
        method: 'POST',
        body: JSON.stringify({ adminMessage: deleteAdminMessage.trim() || undefined }),
      });
      setDeleteModalSub(null);
      setDeleteAdminMessage('');
      await refetch();
    } catch (e: unknown) {
      let msg = 'Ошибка удаления подписки';
      if (e instanceof Error) {
        try {
          const body = JSON.parse(e.message) as { message?: string };
          msg = body.message ?? e.message;
        } catch {
          msg = e.message;
        }
      }
      window.alert(msg);
    } finally {
      setDeletingConfigId(null);
    }
  }

  async function handleSaveReferralOverrides() {
    const bonus = refBonusOverride === '' ? null : parseInt(refBonusOverride, 10);
    const percent = refPercentOverride === '' ? null : parseInt(refPercentOverride, 10);
    if (refBonusOverride !== '' && (isNaN(bonus!) || bonus! < 0)) {
      window.alert('Бонус приглашённому: введите число ≥ 0 или оставьте пустым');
      return;
    }
    if (refPercentOverride !== '' && (isNaN(percent!) || percent! < 0 || percent! > 100)) {
      window.alert('Процент от пополнений: введите число от 0 до 100 или оставьте пустым');
      return;
    }
    setSavingRefOverrides(true);
    try {
      const res = await api<{ ok: boolean; referralBonusRubOverride?: number | null; referralPercentOverride?: number | null }>(
        `/admin/users/${id}/referral-overrides`,
        {
          method: 'POST',
          body: JSON.stringify({
            referralBonusRubOverride: refBonusOverride === '' ? null : bonus,
            referralPercentOverride: refPercentOverride === '' ? null : percent,
          }),
        },
      );
      await refetch();
      setRefBonusOverride(res.referralBonusRubOverride != null ? String(res.referralBonusRubOverride) : '');
      setRefPercentOverride(res.referralPercentOverride != null ? String(res.referralPercentOverride) : '');
    } catch (e) {
      console.error(e);
    } finally {
      setSavingRefOverrides(false);
    }
  }

  async function handleSendMessage() {
    if (!sendMessageText.trim()) return;
    setSendingMessage(true);
    try {
      const res = await api<{ ok?: boolean; error?: string }>(`/admin/users/${id}/send-message`, {
        method: 'POST',
        body: JSON.stringify({ text: sendMessageText.trim() }),
      });
      if ((res as { error?: string }).error) {
        window.alert((res as { error: string }).error);
      } else {
        setSendMessageText('');
      }
    } catch (e: unknown) {
      let msg = 'Ошибка отправки';
      if (e instanceof Error) {
        try {
          const body = JSON.parse(e.message) as { message?: string };
          msg = body.message ?? e.message;
        } catch {
          msg = e.message;
        }
      }
      window.alert(msg);
    } finally {
      setSendingMessage(false);
    }
  }

  async function handleAddBalance() {
    if (balanceAmount < 1) return;
    setAddingBalance(true);
    try {
      await api<{ ok: boolean; balanceRub: number }>(`/admin/users/${id}/balance`, {
        method: 'POST',
        body: JSON.stringify({ amount: balanceAmount }),
      });
      await refetch();
    } catch (e) {
      console.error(e);
    } finally {
      setAddingBalance(false);
    }
  }

  function getInternalIpFromConfig(config?: string | null): string | null {
    if (!config) return null;
    const match = config.match(/^Address\s*=\s*([^\s/]+)/m);
    return match ? match[1] : null;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400">Загрузка...</div>
      </div>
    );
  }

  const completedPayments = user.payments.filter((p) => p.status === 'completed');
  const totalPaid = completedPayments.reduce((s, p) => s + Number(p.amount), 0);
  const lastPayment = completedPayments.length > 0
    ? completedPayments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
    : null;

  return (
    <div className="min-h-screen p-6">
      <nav className="flex gap-4 mb-8 border-b border-slate-700 pb-4">
        <Link href="/" className="text-slate-400 hover:text-white">Dashboard</Link>
        <Link href="/users" className="text-indigo-400 font-medium">Пользователи</Link>
        <Link href="/nodes" className="text-slate-400 hover:text-white">Ноды</Link>
        <Link href="/settings" className="text-slate-400 hover:text-white">Настройки</Link>
      </nav>
      <Link href="/users" className="text-slate-400 hover:text-white text-sm mb-4 inline-block">
        ← Назад к списку
      </Link>
      <h1 className="text-2xl font-bold mb-6">
        Пользователь {user.telegramId} {user.username && `@${user.username}`}
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
          <h2 className="font-semibold mb-2">Основное</h2>
          <p>Подписка до: {user.subscriptionUntil ? formatDateTime(user.subscriptionUntil) : '—'}</p>
          <p>Баланс (рубли): {user.balanceRub} ₽</p>
          <p>Реферальный код: <code className="bg-slate-700 px-1 rounded">{user.referralCode}</code></p>
          <p>Приглашён: {user.referredByUser ? (
            <Link href={`/users/${user.referredByUser.id}`} className="text-indigo-400 hover:underline">
              {user.referredByUser.username ? `@${user.referredByUser.username}` : user.referredByUser.telegramId} ({user.referredByUser.referralCode})
            </Link>
          ) : '—'}</p>
          <p>Регистрация: {new Date(user.createdAt).toLocaleString('ru-RU')}</p>
        </div>
        <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
          <h2 className="font-semibold mb-2">Реферальные настройки</h2>
          <p className="text-slate-400 text-sm mb-3">Переопределение для этого пользователя как реферера. Пусто — использовать глобальные значения.</p>
          <div className="space-y-2 mb-3">
            <div>
              <label className="block text-slate-400 text-xs mb-0.5">Бонус приглашённому (₽)</label>
              <input
                type="number"
                min={0}
                value={refBonusOverride}
                onChange={(e) => setRefBonusOverride(e.target.value)}
                placeholder="По умолчанию"
                className="w-32 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-0.5">Процент от пополнений приглашённых (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={refPercentOverride}
                onChange={(e) => setRefPercentOverride(e.target.value)}
                placeholder="По умолчанию"
                className="w-32 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-white text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveReferralOverrides}
            disabled={savingRefOverrides}
            className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-50"
          >
            {savingRefOverrides ? '…' : 'Сохранить'}
          </button>
        </div>
        <div className="p-4 rounded-lg bg-slate-800 border border-slate-700">
          <h2 className="font-semibold mb-2">Платежи</h2>
          <p>Всего потрачено: <b>{totalPaid} ₽</b></p>
          <p>Последнее пополнение: {lastPayment
            ? `${new Date(lastPayment.createdAt).toLocaleString('ru-RU')}, ${lastPayment.amount} ₽`
            : '—'}</p>
          <div className="mt-3 pt-4 border-t border-slate-600 flex items-center gap-2">
            <label className="text-slate-400 text-sm">Пополнить баланс (₽)</label>
            <input
              type="number"
              min={1}
              value={balanceAmount}
              onChange={(e) => setBalanceAmount(Number(e.target.value) || 0)}
              className="w-24 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-white"
            />
            <button
              onClick={handleAddBalance}
              disabled={addingBalance}
              className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-sm disabled:opacity-50"
            >
              {addingBalance ? '…' : 'Пополнить'}
            </button>
          </div>
        </div>
      </div>
      <div className="mb-6 p-4 rounded-lg bg-slate-800 border border-slate-700">
        <h2 className="font-semibold mb-2">Отправить сообщение в Telegram</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <textarea
            value={sendMessageText}
            onChange={(e) => setSendMessageText(e.target.value)}
            placeholder="Текст сообщения (поддерживается HTML)"
            rows={2}
            className="flex-1 px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white placeholder-slate-500 resize-none"
          />
          <button
            type="button"
            onClick={handleSendMessage}
            disabled={sendingMessage || !sendMessageText.trim()}
            className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 self-start"
          >
            {sendingMessage ? 'Отправка…' : 'Отправить'}
          </button>
        </div>
      </div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Рефералы ({(user.referrals ?? []).length})</h2>
        {(user.referrals ?? []).length === 0 ? (
          <p className="text-slate-400 text-sm">Пока никого не пригласил</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-left">
              <thead className="bg-slate-800">
                <tr>
                  <th className="px-4 py-2">Пользователь</th>
                  <th className="px-4 py-2">Стал рефералом</th>
                </tr>
              </thead>
              <tbody>
                {(user.referrals ?? []).map((r) => (
                  <tr key={r.id} className="border-t border-slate-700">
                    <td className="px-4 py-2">
                      <Link href={`/users/${r.id}`} className="text-indigo-400 hover:underline">
                        {r.username ? `@${r.username}` : r.telegramId}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{new Date(r.createdAt).toLocaleString('ru-RU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Подписки</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-left">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-4 py-2">Нода (страна)</th>
                <th className="px-4 py-2">Начало</th>
                <th className="px-4 py-2">Окончание (дата и время)</th>
                <th className="px-4 py-2">Остаток</th>
                <th className="px-4 py-2">Статус</th>
                <th className="px-4 py-2">Действия</th>
              </tr>
            </thead>
            <tbody>
              {user.subscriptions.map((s) => {
                const devices = s.devices ?? [];
                const ips = devices
                  .map((d) => getInternalIpFromConfig(d.configContent))
                  .filter((ip): ip is string => !!ip);
                const nodeLabel = s.node ? `${s.node.name} (${getCountryName(s.node.country)})` : '—';
                const expiresAt = new Date(s.expiresAt);
                const now = new Date();
                const daysLeft = s.status === 'active' && expiresAt >= now
                  ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
                  : null;
                const hasDevices = devices.length > 0;
                return (
                <tr key={s.id} className="border-t border-slate-700">
                  <td className="px-4 py-2">
                    {nodeLabel}
                    {hasDevices && (
                      <span className="block text-slate-400 text-xs mt-0.5">
                        IP: {ips.length > 0 ? ips.join(', ') : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">{formatDateTime(s.startedAt)}</td>
                  <td className="px-4 py-2">{formatDateTime(s.expiresAt)}</td>
                  <td className="px-4 py-2">
                    {daysLeft !== null ? `${daysLeft} дн.` : '—'}
                  </td>
                  <td className="px-4 py-2">{s.status}</td>
                  <td className="px-4 py-2">
                    {s.status === 'active' ? (
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => { setExtendModalSub({ id: s.id, nodeName: nodeLabel }); setExtendDays(30); setExtendAdminMessage(''); }}
                          disabled={extendingId === s.id}
                          className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-50"
                        >
                          {extendingId === s.id ? '…' : 'Добавить дни'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetExpiresIn24h(s.id)}
                          disabled={setExpires24Id === s.id}
                          className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-sm disabled:opacity-50"
                          title="Установить окончание через 24 часа для теста напоминания"
                        >
                          {setExpires24Id === s.id ? '…' : 'Оставить 24 часа'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetExpiresIn5Min(s.id)}
                          disabled={setExpires5Id === s.id}
                          className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-sm disabled:opacity-50"
                          title="Установить окончание через 5 мин для теста cron"
                        >
                          {setExpires5Id === s.id ? '…' : '5 мин (тест cron)'}
                        </button>
                        {hasDevices && (s.nodeId || s.node?.id) && (
                          <button
                            type="button"
                            onClick={() => setMigrateModalSub({ id: s.id, nodeName: nodeLabel, nodeId: s.nodeId ?? s.node!.id })}
                            disabled={migratingId === s.id}
                            className="px-2 py-0.5 rounded bg-slate-600 hover:bg-slate-500 text-white text-sm disabled:opacity-50"
                            title="Перенести подписку (все устройства) на другую ноду"
                          >
                            {migratingId === s.id ? '…' : 'Миграция'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => { setDeleteModalSub({ id: s.id, nodeName: nodeLabel }); setDeleteAdminMessage(''); }}
                          disabled={deletingConfigId === s.id}
                          className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-sm disabled:opacity-50"
                          title={!hasDevices ? 'Удалить подписку без устройств (создана с ошибками VPS)' : 'Удалить подписку'}
                        >
                          {deletingConfigId === s.id ? '…' : 'Удалить'}
                        </button>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
      {extendModalSub && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setExtendModalSub(null)}>
          <div className="bg-slate-800 rounded-lg p-4 w-full max-w-md border border-slate-600" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">Добавить дни — {extendModalSub.nodeName}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-slate-400 text-sm mb-1">Количество дней</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={extendDays}
                  onChange={(e) => setExtendDays(Number(e.target.value) || 30)}
                  className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-1">Сообщение от админа</label>
                <input
                  type="text"
                  value={extendAdminMessage}
                  onChange={(e) => setExtendAdminMessage(e.target.value)}
                  placeholder="Опционально"
                  className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={handleExtendSubscription}
                disabled={extendingId === extendModalSub.id}
                className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
              >
                {extendingId === extendModalSub.id ? '…' : 'Добавить'}
              </button>
              <button
                type="button"
                onClick={() => setExtendModalSub(null)}
                className="px-4 py-2 rounded bg-slate-600 hover:bg-slate-500 text-white"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
      {migrateModalSub && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setMigrateModalSub(null)}>
          <div className="bg-slate-800 rounded-lg p-4 w-full max-w-md border border-slate-600" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Миграция подписки — {migrateModalSub.nodeName}</h3>
            <p className="text-slate-400 text-sm mb-4">Перенести на другую ноду. Пользователь получит уведомление и новый конфиг.</p>
            <div className="mb-4">
              <label className="block text-slate-400 text-sm mb-1">Целевая нода</label>
              <select
                value={migrateTargetNodeId}
                onChange={(e) => setMigrateTargetNodeId(e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white"
              >
                <option value="">Выберите ноду</option>
                {nodes
                  .filter((n) => n.id !== migrateModalSub.nodeId && n.sshUser)
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({getCountryName(n.country) || n.country})
                    </option>
                  ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleMigrateSubscription}
                disabled={migratingId === migrateModalSub.id || !migrateTargetNodeId.trim()}
                className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
              >
                {migratingId === migrateModalSub.id ? 'Миграция…' : 'Мигрировать'}
              </button>
              <button
                type="button"
                onClick={() => setMigrateModalSub(null)}
                className="px-4 py-2 rounded bg-slate-600 hover:bg-slate-500 text-white"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteModalSub && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setDeleteModalSub(null)}>
          <div className="bg-slate-800 rounded-lg p-4 w-full max-w-md border border-slate-600" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Удалить подписку — {deleteModalSub.nodeName}</h3>
            <p className="text-slate-400 text-sm mb-4">Конфиг будет удалён на VPS, подписка — в базе. Пользователь получит уведомление в Telegram.</p>
            <div className="mb-4">
              <label className="block text-slate-400 text-sm mb-1">Сообщение от админа</label>
              <input
                type="text"
                value={deleteAdminMessage}
                onChange={(e) => setDeleteAdminMessage(e.target.value)}
                placeholder="Опционально — будет включено в уведомление"
                className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDeleteConfig}
                disabled={deletingConfigId === deleteModalSub.id}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white disabled:opacity-50"
              >
                {deletingConfigId === deleteModalSub.id ? '…' : 'Удалить'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteModalSub(null)}
                className="px-4 py-2 rounded bg-slate-600 hover:bg-slate-500 text-white"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">История платежей</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-left">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-4 py-2">Сумма</th>
                <th className="px-4 py-2">Статус</th>
                <th className="px-4 py-2">Дата</th>
              </tr>
            </thead>
            <tbody>
              {user.payments.map((p) => (
                <tr key={p.id} className="border-t border-slate-700">
                  <td className="px-4 py-2">{p.amount} ₽</td>
                  <td className="px-4 py-2">{p.status}</td>
                  <td className="px-4 py-2">{new Date(p.createdAt).toLocaleString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-2">История пополнений</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-left">
            <thead className="bg-slate-800">
              <tr>
                <th className="px-4 py-2">Источник</th>
                <th className="px-4 py-2">Сумма</th>
                <th className="px-4 py-2">Дата</th>
              </tr>
            </thead>
            <tbody>
              {(user.balanceTopUps ?? []).length === 0 ? (
                <tr className="border-t border-slate-700">
                  <td colSpan={3} className="px-4 py-2 text-slate-400 text-sm">
                    Нет записей
                  </td>
                </tr>
              ) : (
                (user.balanceTopUps ?? []).map((t) => (
                  <tr key={t.id} className="border-t border-slate-700">
                    <td className="px-4 py-2">
                      {t.source === 'referral_commission' && t.relatedUser
                        ? `От реферала (${t.relatedUser.username ? `@${t.relatedUser.username}` : t.relatedUser.telegramId})`
                        : (BALANCE_TOP_UP_SOURCE_LABELS[t.source] ?? t.source)}
                    </td>
                    <td className="px-4 py-2">{t.amount} ₽</td>
                    <td className="px-4 py-2">{new Date(t.createdAt).toLocaleString('ru-RU')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
