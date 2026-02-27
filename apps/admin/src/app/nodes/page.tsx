'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { VPN_COUNTRIES, getCountryName } from '@vpn-v/shared-types';

type Node = {
  id: string;
  name: string;
  country: string;
  ip: string;
  isActive: boolean;
  maxUsers: number;
  sshPort?: number;
  sshUser?: string | null;
  sshPrivateKey?: string | null;
  _count: { activeSubscriptions: number };
};

export default function NodesPage() {
  const router = useRouter();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [name, setName] = useState('');
  const [country, setCountry] = useState(VPN_COUNTRIES[0]?.code ?? '');
  const [ip, setIp] = useState('');
  const [maxUsers, setMaxUsers] = useState('2');
  const [sshPort, setSshPort] = useState('22');
  const [sshUser, setSshUser] = useState('');
  const [sshPrivateKey, setSshPrivateKey] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Node | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    country: '',
    ip: '',
    maxUsers: '50',
    sshPort: '22',
    sshUser: '',
    sshPrivateKey: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [testingSshId, setTestingSshId] = useState<string | null>(null);
  const [rebootingId, setRebootingId] = useState<string | null>(null);
  const [creatingUserId, setCreatingUserId] = useState<string | null>(null);
  const [testUserConfig, setTestUserConfig] = useState<{ nodeName: string; filename?: string; config: string } | null>(null);
  const [removeUserNode, setRemoveUserNode] = useState<Node | null>(null);
  const [removeUserIp, setRemoveUserIp] = useState('');
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [migrateSourceNode, setMigrateSourceNode] = useState<Node | null>(null);
  const [migrateTargetNodeId, setMigrateTargetNodeId] = useState('');
  const [migrateSkipRemove, setMigrateSkipRemove] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState<{ migrated: number; failed: { subscriptionId: string; error: string }[] } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refetch = () => api<Node[]>('/admin/nodes').then(setNodes);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('admin_token')) {
      router.replace('/login');
      return;
    }
    refetch().catch(() => router.replace('/login'));
  }, [router]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const c = country.trim();
    const i = ip.trim();
    if (!n || !i) {
      setError('Заполните название и IP');
      return;
    }
    setError(null);
    setAdding(true);
    try {
      await api<Node>('/admin/nodes', {
        method: 'POST',
        body: JSON.stringify({
          name: n,
          country: c,
          ip: i,
          maxUsers: maxUsers ? Math.min(300, Math.max(2, parseInt(maxUsers, 10) || 2)) : 2,
          sshPort: sshPort ? parseInt(sshPort, 10) : 22,
          sshUser: sshUser.trim() || undefined,
          sshPrivateKey: sshPrivateKey.trim() || undefined,
        }),
      });
      setName('');
      setCountry(VPN_COUNTRIES[0]?.code ?? '');
      setIp('');
      setMaxUsers('2');
      setSshPort('22');
      setSshUser('');
      setSshPrivateKey('');
      await refetch();
    } catch (e) {
      setError('Не удалось добавить ноду');
      console.error(e);
    } finally {
      setAdding(false);
    }
  }

  function openEdit(node: Node) {
    setEditing(node);
    const countryCode = VPN_COUNTRIES.some((c) => c.code === node.country)
      ? node.country
      : VPN_COUNTRIES.find((c) => c.name === node.country)?.code ?? VPN_COUNTRIES[0]?.code ?? '';
    setEditForm({
      name: node.name,
      country: countryCode,
      ip: node.ip,
      maxUsers: String(node.maxUsers),
      sshPort: String(node.sshPort ?? 22),
      sshUser: node.sshUser ?? '',
      sshPrivateKey: node.sshPrivateKey ?? '',
    });
  }

  async function testSsh(node: Node) {
    if (!node.sshUser) {
      window.alert('Сначала укажите пользователя и ключ SSH у ноды (кнопка «Изменить»).');
      return;
    }
    setTestingSshId(node.id);
    try {
      const res = await api<{ ok: boolean; error?: string }>(`/admin/nodes/${node.id}/ssh-test`);
      if (res.ok) window.alert('Подключение по SSH успешно.');
      else window.alert('Ошибка: ' + (res.error || 'Не удалось подключиться'));
    } catch (e) {
      window.alert('Ошибка запроса: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setTestingSshId(null);
    }
  }

  async function doReboot(node: Node) {
    if (!node.sshUser) {
      window.alert('У ноды должны быть указаны пользователь и ключ SSH.');
      return;
    }
    if (!window.confirm(`Перезапустить сервер ноды «${node.name}» (${node.ip})? Подключение пропадёт на 1–2 минуты.`)) return;
    setRebootingId(node.id);
    try {
      const res = await api<{ ok: boolean; error?: string }>(`/admin/nodes/${node.id}/reboot`, { method: 'POST' });
      if (res.ok) window.alert('Команда перезагрузки отправлена. Сервер перезапустится в течение минуты.');
      else window.alert('Ошибка: ' + (res.error || 'Не удалось выполнить перезагрузку'));
    } catch (e) {
      window.alert('Ошибка запроса: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setRebootingId(null);
    }
  }

  async function createTestUser(node: Node) {
    if (!node.sshUser) {
      window.alert('У ноды должны быть указаны пользователь и ключ SSH.');
      return;
    }
    if (!window.confirm(`Создать тестового пользователя на ноде «${node.name}» (${node.ip})? Скрипт может выполняться до 2 минут.`)) return;
    setCreatingUserId(node.id);
    try {
      const res = await api<{ ok: boolean; config?: string; filename?: string; error?: string }>(
        `/admin/nodes/${node.id}/test-user`,
        { method: 'POST' },
      );
      if (!res.ok || !res.config) {
        window.alert('Ошибка: ' + (res.error || 'Не удалось создать пользователя'));
        return;
      }
      setTestUserConfig({
        nodeName: node.name,
        filename: res.filename,
        config: res.config,
      });
    } catch (e) {
      window.alert('Ошибка запроса: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setCreatingUserId(null);
    }
  }

  function openRemoveUser(node: Node) {
    setRemoveUserNode(node);
    setRemoveUserIp('');
  }

  function openMigrate(node: Node) {
    setMigrateSourceNode(node);
    setMigrateTargetNodeId('');
    setMigrateSkipRemove(false);
    setMigrateResult(null);
  }

  async function submitMigrate(e: React.FormEvent) {
    e.preventDefault();
    if (!migrateSourceNode || !migrateTargetNodeId.trim()) return;
    setMigrating(true);
    setMigrateResult(null);
    try {
      const res = await api<{ migrated: number; failed: { subscriptionId: string; error: string }[] }>(
        '/admin/subscriptions/migrate-node',
        {
          method: 'POST',
          body: JSON.stringify({
            sourceNodeId: migrateSourceNode.id,
            targetNodeId: migrateTargetNodeId.trim(),
            delayBetweenMs: 3000,
            skipRemoveFromSource: migrateSkipRemove,
          }),
        },
      );
      setMigrateResult(res);
      if (res.failed.length === 0) {
        await refetch();
      }
    } catch (e) {
      window.alert('Ошибка: ' + (e instanceof Error ? e.message : 'Не удалось выполнить миграцию'));
    } finally {
      setMigrating(false);
    }
  }

  async function submitRemoveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!removeUserNode || !removeUserIp.trim()) return;
    setRemovingUserId(removeUserNode.id);
    try {
      const res = await api<{ ok: boolean; error?: string }>(`/admin/nodes/${removeUserNode.id}/remove-user`, {
        method: 'POST',
        body: JSON.stringify({ ip: removeUserIp.trim() }),
      });
      if (res.ok) {
        window.alert('Пользователь успешно удалён.');
        setRemoveUserNode(null);
      } else {
        window.alert('Ошибка: ' + (res.error || 'Не удалось удалить'));
      }
    } catch (e) {
      window.alert('Ошибка запроса: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setRemovingUserId(null);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    try {
      await api(`/admin/nodes/${editing.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editForm.name.trim(),
          country: editForm.country.trim(),
          ip: editForm.ip.trim(),
          maxUsers: editForm.maxUsers
            ? Math.min(300, Math.max(2, parseInt(editForm.maxUsers, 10) || 2))
            : 2,
          sshPort: editForm.sshPort ? parseInt(editForm.sshPort, 10) : 22,
          sshUser: editForm.sshUser.trim() || null,
          sshPrivateKey: editForm.sshPrivateKey.trim() || null,
        }),
      });
      setEditing(null);
      await refetch();
    } catch (e) {
      console.error(e);
    } finally {
      setSavingEdit(false);
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    try {
      await api(`/admin/nodes/${id}/active`, {
        method: 'PUT',
        body: JSON.stringify({ isActive }),
      });
      setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, isActive } : n)));
    } catch (e) {
      console.error(e);
    }
  }

  async function deleteNode(node: Node) {
    const count = node._count?.activeSubscriptions ?? 0;
    if (count > 0) {
      window.alert(`Невозможно удалить: на ноде ${count} активных подписок. Сначала мигрируйте пользователей.`);
      return;
    }
    if (!window.confirm(`Удалить ноду «${node.name}» (${node.ip})? Это действие необратимо.`)) return;
    setDeletingId(node.id);
    try {
      await api(`/admin/nodes/${node.id}`, { method: 'DELETE' });
      await refetch();
    } catch (e) {
      let msg = 'Не удалось удалить';
      if (e instanceof Error && e.message) {
        try {
          const parsed = JSON.parse(e.message) as { message?: string };
          if (parsed.message) msg = parsed.message;
        } catch {
          msg = e.message;
        }
      }
      window.alert('Ошибка: ' + msg);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen p-6">
      <nav className="flex gap-4 mb-8 border-b border-slate-700 pb-4">
        <Link href="/" className="text-slate-400 hover:text-white">Dashboard</Link>
        <Link href="/users" className="text-slate-400 hover:text-white">Пользователи</Link>
        <Link href="/nodes" className="text-indigo-400 font-medium">Ноды</Link>
        <Link href="/broadcast" className="text-slate-400 hover:text-white">Рассылка</Link>
        <Link href="/bot-texts" className="text-slate-400 hover:text-white">Тексты бота</Link>
        <Link href="/settings" className="text-slate-400 hover:text-white">Настройки</Link>
      </nav>
      <h1 className="text-2xl font-bold mb-6">VPN Ноды</h1>
      <form onSubmit={handleAdd} className="mb-6 p-4 rounded-lg bg-slate-800 border border-slate-700 max-w-2xl">
        <h2 className="font-semibold mb-3">Добавить ноду</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-slate-400 text-sm mb-1">Название</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Node NL"
              className="px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white w-40"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1">Лимит пользователей</label>
            <input
              type="number"
              min={2}
              max={300}
              value={maxUsers}
              onChange={(e) => setMaxUsers(e.target.value)}
              className="w-32 px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1">Страна</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white w-48"
            >
              {VPN_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1">IP</label>
            <input
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="1.2.3.4"
              className="px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white w-40 font-mono"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3 mt-3 pt-3 border-t border-slate-600">
          <span className="text-slate-400 text-sm mr-2">SSH:</span>
          <div>
            <label className="block text-slate-400 text-sm mb-1">Порт</label>
            <input
              type="number"
              min={1}
              max={65535}
              value={sshPort}
              onChange={(e) => setSshPort(e.target.value)}
              placeholder="22"
              className="px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white w-20"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-sm mb-1">Пользователь</label>
            <input
              type="text"
              value={sshUser}
              onChange={(e) => setSshUser(e.target.value)}
              placeholder="root"
              className="px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white w-32"
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-slate-400 text-sm mb-1">Приватный ключ (PEM)</label>
            <textarea
              value={sshPrivateKey}
              onChange={(e) => setSshPrivateKey(e.target.value)}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
              rows={2}
              className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white font-mono text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
          >
            {adding ? '…' : 'Добавить'}
          </button>
        </div>
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </form>
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        <table className="w-full text-left">
          <thead className="bg-slate-800">
            <tr>
              <th className="px-4 py-2">Название</th>
              <th className="px-4 py-2">Страна</th>
              <th className="px-4 py-2">IP</th>
              <th className="px-4 py-2">Пользователей</th>
              <th className="px-4 py-2">Лимит</th>
              <th className="px-4 py-2">SSH</th>
              <th className="px-4 py-2">Статус</th>
              <th className="px-4 py-2">Действия</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => (
              <tr key={n.id} className="border-t border-slate-700 hover:bg-slate-800/50">
                <td className="px-4 py-2">{n.name}</td>
                <td className="px-4 py-2">{getCountryName(n.country)}</td>
                <td className="px-4 py-2 font-mono">{n.ip}</td>
                <td className="px-4 py-2">{n._count?.activeSubscriptions ?? 0}</td>
                <td className="px-4 py-2">{n.maxUsers}</td>
                <td className="px-4 py-2 text-slate-400 text-sm">
                  {n.sshUser ? `${n.sshUser}@${n.ip}:${n.sshPort ?? 22}` : '—'}
                </td>
                <td className="px-4 py-2">
                  <span className={n.isActive ? 'text-green-400' : 'text-red-400'}>
                    {n.isActive ? 'Вкл' : 'Выкл'}
                  </span>
                </td>
                <td className="px-4 py-2 flex flex-wrap gap-1">
                  <button
                    onClick={() => openEdit(n)}
                    className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm"
                  >
                    Изменить
                  </button>
                  <button
                    onClick={() => testSsh(n)}
                    disabled={testingSshId !== null || !n.sshUser}
                    className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm disabled:opacity-50"
                    title="Проверить подключение по SSH"
                  >
                    {testingSshId === n.id ? '…' : 'Проверить SSH'}
                  </button>
                  <button
                    onClick={() => doReboot(n)}
                    disabled={rebootingId !== null || !n.sshUser}
                    className="px-3 py-1 rounded bg-amber-700 hover:bg-amber-600 text-sm disabled:opacity-50"
                    title="Перезагрузить сервер по SSH"
                  >
                    {rebootingId === n.id ? '…' : 'Перезапустить'}
                  </button>
                  <button
                    onClick={() => createTestUser(n)}
                    disabled={creatingUserId !== null || !n.sshUser}
                    className="px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-sm disabled:opacity-50"
                    title="Создать тестового пользователя (add_user.sh)"
                  >
                    {creatingUserId === n.id ? '…' : 'Тестовый пользователь'}
                  </button>
                  <button
                    onClick={() => openRemoveUser(n)}
                    disabled={!n.sshUser}
                    className="px-3 py-1 rounded bg-red-800 hover:bg-red-700 text-sm disabled:opacity-50"
                    title="Удалить пользователя по IP (remove_user.sh)"
                  >
                    Удалить по IP
                  </button>
                  <button
                    onClick={() => openMigrate(n)}
                    disabled={!n.sshUser || (n._count?.activeSubscriptions ?? 0) === 0}
                    className="px-3 py-1 rounded bg-blue-800 hover:bg-blue-700 text-sm disabled:opacity-50"
                    title="Мигрировать пользователей на другую ноду"
                  >
                    Мигрировать
                  </button>
                  <button
                    onClick={() => toggleActive(n.id, !n.isActive)}
                    className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-sm"
                  >
                    {n.isActive ? 'Выключить' : 'Включить'}
                  </button>
                  <button
                    onClick={() => deleteNode(n)}
                    disabled={
                      deletingId !== null ||
                      (n._count?.activeSubscriptions ?? 0) > 0
                    }
                    className="px-3 py-1 rounded bg-red-900 hover:bg-red-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title={
                      (n._count?.activeSubscriptions ?? 0) > 0
                        ? 'Сначала мигрируйте или удалите подписки'
                        : 'Удалить ноду (только если нет пользователей)'
                    }
                  >
                    {deletingId === n.id ? '…' : 'Удалить'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {testUserConfig && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setTestUserConfig(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-2xl w-full shadow-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2">Тестовый пользователь на ноде {testUserConfig.nodeName}</h2>
            {testUserConfig.filename && (
              <p className="text-slate-400 text-sm mb-2">Файл: {testUserConfig.filename}</p>
            )}
            <textarea
              readOnly
              value={testUserConfig.config}
              rows={16}
              className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-600 text-white font-mono text-sm mb-3 flex-1 min-h-0"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(testUserConfig.config).then(() => window.alert('Скопировано')).catch(() => {});
                }}
                className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
              >
                Скопировать конфиг
              </button>
              <button
                type="button"
                onClick={() => setTestUserConfig(null)}
                className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {migrateSourceNode && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => !migrating && setMigrateSourceNode(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2">Мигрировать пользователей</h2>
            <p className="text-slate-400 text-sm mb-3">
              С ноды «{migrateSourceNode.name}» ({migrateSourceNode._count?.activeSubscriptions ?? 0} подписок) на другую ноду. Пользователи получат уведомление в Telegram.
            </p>
            <form onSubmit={submitMigrate}>
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={migrateSkipRemove}
                  onChange={(e) => setMigrateSkipRemove(e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600"
                />
                <span className="text-slate-300 text-sm">
                  VPS не отвечает — только создать на новом, не удалять со старого (сам удалю позже)
                </span>
              </label>
              <label className="block text-slate-400 text-sm mb-1">Целевая нода</label>
              <select
                value={migrateTargetNodeId}
                onChange={(e) => setMigrateTargetNodeId(e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white mb-4"
                required
              >
                <option value="">— Выбрать —</option>
                {nodes
                  .filter((n) => n.id !== migrateSourceNode.id && n.sshUser)
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({getCountryName(n.country)}) — {n._count?.activeSubscriptions ?? 0}/{n.maxUsers}
                    </option>
                  ))}
              </select>
              {migrateResult && (
                <div className="mb-4 p-2 rounded bg-slate-700 text-sm">
                  <p>Мигрировано: {migrateResult.migrated}</p>
                  {migrateResult.failed.length > 0 && (
                    <p className="text-amber-400 mt-1">Ошибок: {migrateResult.failed.length}</p>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={migrating || !migrateTargetNodeId.trim()}
                  className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm disabled:opacity-50"
                >
                  {migrating ? 'Миграция…' : 'Запустить миграцию'}
                </button>
                <button
                  type="button"
                  onClick={() => !migrating && setMigrateSourceNode(null)}
                  disabled={migrating}
                  className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm disabled:opacity-50"
                >
                  {migrateResult ? 'Закрыть' : 'Отмена'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {removeUserNode && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setRemoveUserNode(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2">Удалить пользователя по IP</h2>
            <p className="text-slate-400 text-sm mb-3">Нода: {removeUserNode.name}. Будет выполнено: /home/admin/remove_user.sh &lt;IP&gt;</p>
            <form onSubmit={submitRemoveUser}>
              <label className="block text-slate-400 text-sm mb-1">IP клиента (например 10.8.1.15)</label>
              <input
                type="text"
                value={removeUserIp}
                onChange={(e) => setRemoveUserIp(e.target.value)}
                placeholder="10.8.1.15"
                className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white font-mono mb-4"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={removingUserId !== null || !removeUserIp.trim()}
                  className="px-4 py-2 rounded bg-red-600 hover:bg-red-500 text-white text-sm disabled:opacity-50"
                >
                  {removingUserId === removeUserNode.id ? '…' : 'Удалить'}
                </button>
                <button
                  type="button"
                  onClick={() => setRemoveUserNode(null)}
                  className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 max-w-lg w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Редактировать ноду: {editing.name}</h2>
            <form onSubmit={saveEdit} className="space-y-3">
              <div>
                <label className="block text-slate-400 text-sm mb-1">Название</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Страна</label>
                  <select
                    value={editForm.country}
                    onChange={(e) => setEditForm((f) => ({ ...f, country: e.target.value }))}
                    className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white"
                  >
                    {VPN_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Лимит пользователей</label>
                  <input
                    type="number"
                    min={2}
                    max={300}
                    value={editForm.maxUsers}
                    onChange={(e) => setEditForm((f) => ({ ...f, maxUsers: e.target.value }))}
                    className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-1">IP</label>
                  <input
                    type="text"
                    value={editForm.ip}
                    onChange={(e) => setEditForm((f) => ({ ...f, ip: e.target.value }))}
                    className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white font-mono"
                  />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-600">
                <p className="text-slate-400 text-sm mb-2">SSH</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">Порт</label>
                    <input
                      type="number"
                      min={1}
                      max={65535}
                      value={editForm.sshPort}
                      onChange={(e) => setEditForm((f) => ({ ...f, sshPort: e.target.value }))}
                      className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">Пользователь</label>
                    <input
                      type="text"
                      value={editForm.sshUser}
                      onChange={(e) => setEditForm((f) => ({ ...f, sshUser: e.target.value }))}
                      placeholder="root"
                      className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white"
                    />
                  </div>
                </div>
                <div className="mt-2">
                  <label className="block text-slate-400 text-xs mb-1">Приватный ключ (PEM)</label>
                  <textarea
                    value={editForm.sshPrivateKey}
                    onChange={(e) => setEditForm((f) => ({ ...f, sshPrivateKey: e.target.value }))}
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
                    rows={3}
                    className="w-full px-3 py-2 rounded bg-slate-700 border border-slate-600 text-white font-mono text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                >
                  {savingEdit ? '…' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white"
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
