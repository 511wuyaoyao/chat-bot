/**
 * Debug Config 页面。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { debugApi } from "../../api";
import type {
  ConfigDraft,
  ConfigDraftValue,
  ConfigMessage,
  DebugConfigField,
  DebugConfigState,
  QQUserAccountDraft,
  QQUserDraft,
} from "../../types";
import { JsonBlock } from "../../components/common";
import {
  cloneConfigValue,
  configGroupId,
  parseUsers,
  sameAccount,
  sameValue,
  syncPrimaryAccount,
} from "../../utils/config";

const DEFAULT_CONFIG_GROUP = "access";

export function ConfigPage({ active }: { active: boolean }) {
  const [state, setState] = useState<DebugConfigState | null>(null);
  const [draft, setDraft] = useState<ConfigDraft>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedGroup, setSelectedGroup] = useState(DEFAULT_CONFIG_GROUP);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<ConfigMessage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const dirtyKeys = useMemo(() => {
    if (!state) return [];
    return state.fields
      .filter((field) => field.editable && !sameValue(draft[field.key], field.value))
      .map((field) => field.key);
  }, [draft, state]);

  const mergeState = useCallback((nextState: DebugConfigState) => {
    setState((previousState) => {
      setDraft((previousDraft) => {
        const previousDirty = previousState
          ? previousState.fields
              .filter((field) => field.editable && !sameValue(previousDraft[field.key], field.value))
              .map((field) => field.key)
          : [];
        return Object.fromEntries(
          nextState.fields.map((field) => [
            field.key,
            previousState && previousDirty.includes(field.key) && field.editable
              ? previousDraft[field.key]
              : cloneConfigValue(field.value),
          ])
        );
      });
      return nextState;
    });
    setErrors(nextState.errors || {});
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      mergeState(await debugApi.config());
    } catch (error) {
      setLoadError(String(error));
    }
  }, [mergeState]);

  useEffect(() => {
    if (!active) return;
    void loadData();
    const timer = window.setInterval(() => void loadData(), 3000);
    return () => window.clearInterval(timer);
  }, [active, loadData]);

  const updateDraft = (key: string, value: ConfigDraftValue | null) => {
    setDraft((currentDraft) => ({ ...currentDraft, [key]: value }));
    setErrors((currentErrors) => {
      const next = { ...currentErrors };
      delete next[key];
      return next;
    });
  };

  const saveConfig = async () => {
    if (!state || saving || !dirtyKeys.length) return;
    const values = Object.fromEntries(dirtyKeys.map((key) => [key, draft[key]]));
    setSaving(true);
    setMessage(null);
    try {
      const nextState = await debugApi.patchConfig(values);
      mergeState(nextState);
      setMessage({ kind: "ok", text: "Saved and hot reloaded." });
    } catch (error) {
      const body = (error as Error & { body?: { errors?: Record<string, string>; error?: string } }).body;
      setErrors(body?.errors || {});
      setMessage({ kind: "error", text: body?.error || "Save failed." });
    } finally {
      setSaving(false);
      window.setTimeout(() => setMessage(null), 3000);
    }
  };

  const revertConfig = () => {
    if (!state) return;
    setDraft(Object.fromEntries(state.fields.map((field) => [field.key, cloneConfigValue(field.value)])));
    setErrors({});
  };

  if (!state) {
    return (
      <>
        <div className="toolbar">
          <button onClick={() => void loadData()}>Refresh</button>
          <div className="spacer" />
        </div>
        {loadError && <div className="inline-error">{loadError}</div>}
        <div className="content single"><section className="empty">No config.</section></div>
      </>
    );
  }

  const firstGroup = state.groups[0] ? configGroupId(state.groups[0]) : DEFAULT_CONFIG_GROUP;
  const currentGroup = state.groups.some((group) => configGroupId(group) === selectedGroup)
    ? selectedGroup
    : firstGroup;
  const fields = state.fields.filter((field) => field.group === currentGroup);
  return (
    <>
      <div className="toolbar">
        <button disabled={saving} onClick={() => void loadData()}>Refresh</button>
        <div className="spacer" />
        <span className="muted">Unsaved {dirtyKeys.length}</span>
      </div>
      {loadError && <div className="inline-error">{loadError}</div>}
      <div className="content single">
        <section className="config-panel">
          <div className="config-header">
            <div>
              <h2>Config</h2>
              <div className="muted">Unsaved {dirtyKeys.length}</div>
            </div>
            <div className="config-actions">
              <button disabled={!dirtyKeys.length || saving} onClick={revertConfig}>Revert</button>
              <button className="primary" disabled={!dirtyKeys.length || saving} onClick={() => void saveConfig()}>
                {saving ? "Saving..." : "Save and hot reload"}
              </button>
            </div>
          </div>
          {message && <div className={`config-message ${message.kind}`}>{message.text}</div>}
          <div className="config-body">
            <nav className="config-groups">
              {state.groups.map((group) => {
                const groupId = configGroupId(group);
                const count = state.fields.filter((field) => field.group === groupId && dirtyKeys.includes(field.key)).length;
                return (
                  <button key={groupId} className={currentGroup === groupId ? "active" : ""} onClick={() => setSelectedGroup(groupId)}>
                    <span>{group.label}</span>
                    {count > 0 && <b>{count}</b>}
                  </button>
                );
              })}
            </nav>
            <div className="config-fields">
              {fields.map((field) => (
                <ConfigField
                  key={field.key}
                  field={field}
                  value={draft[field.key]}
                  dirty={dirtyKeys.includes(field.key)}
                  error={errors[field.key]}
                  saving={saving}
                  platformValue={String(draft.PLATFORM_ADAPTER || "")}
                  onChange={(value) => updateDraft(field.key, value)}
                />
              ))}
              {currentGroup === "status" && <JsonBlock value={state.readOnlyStatus} />}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function ConfigField(props: {
  field: DebugConfigField;
  value: ConfigDraftValue | null | undefined;
  dirty: boolean;
  error?: string;
  saving: boolean;
  platformValue: string;
  onChange: (value: ConfigDraftValue | null) => void;
}) {
  const disabled = !props.field.editable || props.saving;
  return (
    <div className={`config-field ${props.dirty ? "dirty" : ""}`}>
      <div className="config-field-head">
        <div>
          <label>{props.field.label}</label>
          <code>{props.field.key}</code>
        </div>
        {!props.field.editable && <span className="readonly-pill">Readonly</span>}
      </div>
      {props.field.description && <p>{props.field.description}</p>}
      {props.field.key === "QQ_USERS_JSON" ? (
        <UsersEditor rawValue={String(props.value || "[]")} disabled={disabled} platformValue={props.platformValue} onChange={(users) => props.onChange(JSON.stringify(users))} />
      ) : (
        <GenericConfigInput field={props.field} value={props.value} disabled={disabled} onChange={props.onChange} />
      )}
      {props.field.type === "stringList" && props.field.editable && <small>Comma or newline separated. Values are normalized on save.</small>}
      {props.error && <div className="field-error">{props.error}</div>}
    </div>
  );
}

function GenericConfigInput(props: {
  field: DebugConfigField;
  value: ConfigDraftValue | null | undefined;
  disabled: boolean;
  onChange: (value: ConfigDraftValue | null) => void;
}) {
  if (props.field.sensitive && !props.field.editable) {
    return <div className={`sensitive-state ${props.field.configured ? "ok" : "missing"}`}>{props.field.configured ? "configured" : "missing"}</div>;
  }
  if (props.field.type === "boolean") {
    return <label className="checkbox-line"><input type="checkbox" checked={Boolean(props.value)} disabled={props.disabled} onChange={(event) => props.onChange(event.target.checked)} />Enabled</label>;
  }
  if (props.field.type === "number") {
    return <input type="number" value={props.value == null ? "" : String(props.value)} min={props.field.min} max={props.field.max} disabled={props.disabled} onChange={(event) => props.onChange(event.target.value === "" ? null : Number(event.target.value))} />;
  }
  if (props.field.type === "stringList") {
    return <textarea rows={3} value={Array.isArray(props.value) ? props.value.join("\n") : String(props.value || "")} disabled={props.disabled} onChange={(event) => props.onChange(event.target.value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean))} />;
  }
  if (props.field.options?.length) {
    return <select value={String(props.value || "")} disabled={props.disabled} onChange={(event) => props.onChange(event.target.value)}>{props.field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>;
  }
  if (props.field.type === "json") {
    return <textarea rows={8} value={String(props.value || "")} disabled={props.disabled} onChange={(event) => props.onChange(event.target.value)} />;
  }
  return <input type="text" value={String(props.value || "")} disabled={props.disabled} onChange={(event) => props.onChange(event.target.value)} />;
}

function UsersEditor(props: {
  rawValue: string;
  disabled: boolean;
  platformValue: string;
  onChange: (users: QQUserDraft[]) => void;
}) {
  const users = parseUsers(props.rawValue);
  const defaultPlatform = props.platformValue === "napcat" ? "napcat" : "qqbot-official";
  const updateUsers = (nextUsers: QQUserDraft[]) => props.onChange(nextUsers);
  return (
    <div className="user-editor">
      <div className="user-editor-toolbar">
        <div>
          <b>Users</b>
          <div className="muted">Manage people and platform accounts. Saved as QQ_USERS_JSON.</div>
        </div>
        <button disabled={props.disabled} onClick={() => {
          const account: QQUserAccountDraft = { platform: defaultPlatform, id: "", label: "" };
          updateUsers([...users, { id: `user_${Date.now().toString(36)}`, name: "", accounts: [account], primaryAccount: { ...account }, fields: {} }]);
        }}>Add person</button>
      </div>
      {users.length === 0 && <div className="empty-user-editor">No users. Click Add person to start.</div>}
      {users.map((user, userIndex) => (
        <UserCard
          key={userIndex}
          user={user}
          userIndex={userIndex}
          disabled={props.disabled}
          defaultPlatform={defaultPlatform}
          onChange={(nextUser) => updateUsers(users.map((item, index) => index === userIndex ? nextUser : item))}
          onDelete={() => updateUsers(users.filter((_, index) => index !== userIndex))}
        />
      ))}
    </div>
  );
}

function UserCard(props: {
  user: QQUserDraft;
  userIndex: number;
  disabled: boolean;
  defaultPlatform: "napcat" | "qqbot-official";
  onChange: (user: QQUserDraft) => void;
  onDelete: () => void;
}) {
  const fieldCount = props.user.fields && typeof props.user.fields === "object" ? Object.keys(props.user.fields).length : 0;
  const primaryIndex = Math.max(0, props.user.accounts.findIndex((account) => sameAccount(account, props.user.primaryAccount)));
  const updateAccount = (accountIndex: number, account: QQUserAccountDraft) => {
    const accounts = props.user.accounts.map((item, index) => index === accountIndex ? account : item);
    const primaryAccount = accountIndex === primaryIndex ? { ...account } : syncPrimaryAccount(props.user.primaryAccount, accounts);
    props.onChange({ ...props.user, accounts, primaryAccount });
  };
  return (
    <article className="user-card">
      <div className="user-card-header">
        <div className="user-card-title">Person #{props.userIndex + 1}</div>
        <button className="danger-btn" disabled={props.disabled} onClick={props.onDelete}>Delete person</button>
      </div>
      <div className="user-grid">
        <label>Person ID<input value={props.user.id} disabled={props.disabled} onChange={(event) => props.onChange({ ...props.user, id: event.target.value })} /></label>
        <label>Name<input value={props.user.name || ""} disabled={props.disabled} onChange={(event) => props.onChange({ ...props.user, name: event.target.value })} /></label>
        <label>Primary Account<select value={String(primaryIndex)} disabled={props.disabled || !props.user.accounts.length} onChange={(event) => props.onChange({ ...props.user, primaryAccount: { ...props.user.accounts[Number(event.target.value)] } })}>
          {props.user.accounts.map((account, index) => <option key={index} value={index}>{account.platform} / {account.id || "missing ID"}{account.label ? ` / ${account.label}` : ""}</option>)}
        </select></label>
      </div>
      {fieldCount > 0 && <div className="readonly-note">Extra fields exist: {fieldCount}. Preserved readonly.</div>}
      <div className="account-list">
        <div className="account-list-header">
          <b>Accounts</b>
          <button disabled={props.disabled} onClick={() => {
            const account: QQUserAccountDraft = { platform: props.defaultPlatform, id: "", label: "" };
            const accounts = [...props.user.accounts, account];
            props.onChange({ ...props.user, accounts, primaryAccount: syncPrimaryAccount(props.user.primaryAccount, accounts) });
          }}>Add account</button>
        </div>
        {props.user.accounts.map((account, accountIndex) => (
          <div className="account-row" key={accountIndex}>
            <select value={account.platform} disabled={props.disabled} onChange={(event) => updateAccount(accountIndex, { ...account, platform: event.target.value === "napcat" ? "napcat" : "qqbot-official" })}>
              <option value="qqbot-official">qqbot-official</option>
              <option value="napcat">napcat</option>
            </select>
            <input placeholder="account ID / openid" value={account.id} disabled={props.disabled} onChange={(event) => updateAccount(accountIndex, { ...account, id: event.target.value })} />
            <input placeholder="label" value={account.label || ""} disabled={props.disabled} onChange={(event) => updateAccount(accountIndex, { ...account, label: event.target.value })} />
            <button className="danger-btn" disabled={props.disabled} onClick={() => {
              const accounts = props.user.accounts.filter((_, index) => index !== accountIndex);
              props.onChange({ ...props.user, accounts, primaryAccount: syncPrimaryAccount(props.user.primaryAccount, accounts) });
            }}>Delete</button>
          </div>
        ))}
      </div>
    </article>
  );
}
