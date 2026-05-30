// frontend/components/admin/AdminPanel.tsx
//
// Admin panel (PH15, D-10): list accounts with quotas + usage, create accounts,
// edit limits, and inspect a user's request/token audit. Visible only to admins
// (gated by the caller). All data flows through services/adminApi.

"use client";

import { useCallback, useEffect, useState } from "react";

import { IconClose } from "@/components/icons/Icons";
import * as adminApi from "@/services/adminApi";
import { useAdminView } from "@/store/AdminViewContext";
import { useI18n } from "@/store/LanguageContext";
import type { AdminUserSummary, AdminUserUsage } from "@/types/api";

// "" → null (unlimited); a number string → that number.
function parseLimit(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function limitText(value: number | null, unlimited: string): string {
  return value == null ? unlimited : String(value);
}

export default function AdminPanel() {
  const { t } = useI18n();
  const { close } = useAdminView();

  const [users, setUsers] = useState<AdminUserSummary[] | null>(null);
  const [error, setError] = useState(false);

  // Reusable refresh for create/update handlers (setState only after await).
  const reload = useCallback(async () => {
    try {
      setUsers(await adminApi.listUsers());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  // Initial load: state is set inside the async callback, never synchronously.
  useEffect(() => {
    let active = true;
    adminApi
      .listUsers()
      .then((list) => {
        if (!active) return;
        setUsers(list);
        setError(false);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="admin" aria-label={t("admin.title")}>
      <div className="admin-head">
        <h1 className="admin-title">{t("admin.title")}</h1>
        <button className="admin-back" type="button" onClick={close}>
          <IconClose size={15} />
          {t("admin.back")}
        </button>
      </div>

      <CreateUserForm onCreated={reload} />

      <h2 className="admin-subtitle">{t("admin.usersTitle")}</h2>

      {error && (
        <div className="admin-state admin-state--error" role="alert">
          {t("admin.error")}
        </div>
      )}
      {!error && users === null && (
        <div className="admin-state" role="status">
          {t("admin.loading")}
        </div>
      )}
      {!error && users !== null && users.length === 0 && (
        <div className="admin-state" role="status">
          {t("admin.empty")}
        </div>
      )}

      {!error && users !== null && users.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t("admin.colUser")}</th>
                <th>{t("admin.colRole")}</th>
                <th>{t("admin.colPerMinute")}</th>
                <th>{t("admin.colPerDay")}</th>
                <th>{t("admin.colUsedToday")}</th>
                <th>{t("admin.colRemaining")}</th>
                <th aria-label={t("admin.colActions")} />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow key={u.id} user={u} onChanged={reload} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CreateUserForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [perMinute, setPerMinute] = useState("");
  const [perDay, setPerDay] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await adminApi.createUser({
        username,
        password,
        is_admin: isAdmin,
        max_requests_per_minute: parseLimit(perMinute),
        max_requests_per_day: parseLimit(perDay),
      });
      setUsername("");
      setPassword("");
      setPerMinute("");
      setPerDay("");
      setIsAdmin(false);
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.createError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-create" onSubmit={submit}>
      <h2 className="admin-subtitle">{t("admin.createTitle")}</h2>
      {error && (
        <div className="admin-state admin-state--error" role="alert">
          {error}
        </div>
      )}
      <div className="admin-create-grid">
        <label className="admin-field">
          <span className="admin-label">{t("auth.username")}</span>
          <input
            className="admin-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
            required
          />
        </label>
        <label className="admin-field">
          <span className="admin-label">{t("auth.password")}</span>
          <input
            className="admin-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <label className="admin-field">
          <span className="admin-label">{t("admin.fPerMinute")}</span>
          <input
            className="admin-input"
            type="number"
            min={0}
            value={perMinute}
            onChange={(e) => setPerMinute(e.target.value)}
            placeholder={t("admin.limitHint")}
            disabled={isAdmin}
          />
        </label>
        <label className="admin-field">
          <span className="admin-label">{t("admin.fPerDay")}</span>
          <input
            className="admin-input"
            type="number"
            min={0}
            value={perDay}
            onChange={(e) => setPerDay(e.target.value)}
            placeholder={t("admin.limitHint")}
            disabled={isAdmin}
          />
        </label>
        <label className="admin-check">
          <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
          <span>{t("admin.fIsAdmin")}</span>
        </label>
        <button className="admin-btn admin-btn--primary" type="submit" disabled={busy}>
          {busy ? t("admin.creating") : t("admin.create")}
        </button>
      </div>
    </form>
  );
}

function UserRow({ user, onChanged }: { user: AdminUserSummary; onChanged: () => Promise<void> }) {
  const { t } = useI18n();
  const unlimited = t("admin.unlimited");

  const [editing, setEditing] = useState(false);
  const [perMinute, setPerMinute] = useState("");
  const [perDay, setPerDay] = useState("");
  const [saving, setSaving] = useState(false);
  const [rowError, setRowError] = useState(false);

  const [usage, setUsage] = useState<AdminUserUsage | null>(null);
  const [usageOpen, setUsageOpen] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);

  function startEdit() {
    setPerMinute(user.max_requests_per_minute == null ? "" : String(user.max_requests_per_minute));
    setPerDay(user.max_requests_per_day == null ? "" : String(user.max_requests_per_day));
    setRowError(false);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setRowError(false);
    try {
      await adminApi.updateUser(user.id, {
        max_requests_per_minute: parseLimit(perMinute),
        max_requests_per_day: parseLimit(perDay),
      });
      setEditing(false);
      await onChanged();
    } catch {
      setRowError(true);
    } finally {
      setSaving(false);
    }
  }

  async function toggleUsage() {
    if (usageOpen) {
      setUsageOpen(false);
      return;
    }
    setUsageOpen(true);
    if (usage === null) {
      setUsageLoading(true);
      try {
        setUsage(await adminApi.getUserUsage(user.id));
      } catch {
        setRowError(true);
      } finally {
        setUsageLoading(false);
      }
    }
  }

  return (
    <>
      <tr>
        <td className="admin-cell-user">{user.username}</td>
        <td>
          {user.is_admin ? (
            <span className="admin-badge">{t("admin.roleAdmin")}</span>
          ) : (
            t("admin.roleUser")
          )}
        </td>
        <td>
          {editing ? (
            <input
              className="admin-input admin-input--sm"
              type="number"
              min={0}
              value={perMinute}
              onChange={(e) => setPerMinute(e.target.value)}
              placeholder={unlimited}
              aria-label={t("admin.fPerMinute")}
            />
          ) : (
            limitText(user.max_requests_per_minute, unlimited)
          )}
        </td>
        <td>
          {editing ? (
            <input
              className="admin-input admin-input--sm"
              type="number"
              min={0}
              value={perDay}
              onChange={(e) => setPerDay(e.target.value)}
              placeholder={unlimited}
              aria-label={t("admin.fPerDay")}
            />
          ) : (
            limitText(user.max_requests_per_day, unlimited)
          )}
        </td>
        <td>{user.used_today}</td>
        <td>{user.remaining_today == null ? unlimited : user.remaining_today}</td>
        <td className="admin-cell-actions">
          {editing ? (
            <>
              <button
                className="admin-btn admin-btn--primary"
                type="button"
                onClick={save}
                disabled={saving}
              >
                {saving ? t("admin.saving") : t("admin.save")}
              </button>
              <button
                className="admin-btn"
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                {t("admin.cancel")}
              </button>
            </>
          ) : (
            <>
              <button className="admin-btn" type="button" onClick={startEdit}>
                {t("admin.edit")}
              </button>
              <button
                className="admin-btn"
                type="button"
                onClick={toggleUsage}
                aria-expanded={usageOpen}
              >
                {usageOpen ? t("admin.hideUsage") : t("admin.viewUsage")}
              </button>
            </>
          )}
        </td>
      </tr>

      {rowError && (
        <tr>
          <td colSpan={7} className="admin-state admin-state--error" role="alert">
            {t("admin.updateError")}
          </td>
        </tr>
      )}

      {usageOpen && (
        <tr>
          <td colSpan={7} className="admin-usage-cell">
            <UsageDetail loading={usageLoading} usage={usage} />
          </td>
        </tr>
      )}
    </>
  );
}

function UsageDetail({ loading, usage }: { loading: boolean; usage: AdminUserUsage | null }) {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="admin-state" role="status">
        {t("admin.loading")}
      </div>
    );
  }
  if (!usage) {
    return null;
  }

  return (
    <div className="admin-usage">
      <div className="admin-usage-totals">
        <span>
          {t("admin.totalRequests")}: <b>{usage.total_requests}</b>
        </span>
        <span>
          {t("admin.totalTokens")}: <b>{usage.total_tokens}</b>
        </span>
      </div>

      {usage.events.length === 0 ? (
        <div className="admin-state" role="status">
          {t("admin.eventsEmpty")}
        </div>
      ) : (
        <table className="admin-table admin-table--events">
          <thead>
            <tr>
              <th>{t("admin.evMode")}</th>
              <th>{t("admin.evMessage")}</th>
              <th>{t("admin.evModel")}</th>
              <th>{t("admin.evTokens")}</th>
              <th>{t("admin.evStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {usage.events.map((ev) => (
              <tr key={ev.id}>
                <td>{ev.mode}</td>
                <td className="admin-cell-msg">{ev.message}</td>
                <td>{ev.selected_model ?? "—"}</td>
                <td>{ev.total_tokens ?? "—"}</td>
                <td>{ev.success ? t("admin.ok") : t("admin.failed")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
