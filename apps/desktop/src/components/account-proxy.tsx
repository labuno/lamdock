import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import type { AccountProxySettings, CodexAccount, UpdateAccountProxyRequest } from '../lib/types';
import { formatError } from '../lib/format';
import { IconSliders } from './icons';
import { Modal } from './shell';
import { UIButton } from './ui-button';

type SaveProxy = (request: UpdateAccountProxyRequest) => Promise<void>;

export function AccountProxyBadge({ proxy }: { proxy?: AccountProxySettings | null }) {
  if (!proxy?.enabled) return null;
  return (
    <span
      className="badge badge--auth"
      title={proxy.url}
      tabIndex={0}
      aria-label={`Independent proxy configured: ${proxy.url}`}
    >
      PROXY
    </span>
  );
}

export function AccountProxyActions({
  account,
  onSave,
  onMenuClose = () => {},
  expanded = false,
}: {
  account: CodexAccount;
  onSave: SaveProxy;
  onMenuClose?: () => void;
  expanded?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const enabled = account.proxy?.enabled === true;
  const buttonClass = expanded ? 'uiBtn uiBtn--default uiBtn--sm' : 'cardMenuDropdownItem';

  function openEditor() {
    setUrl(account.proxy?.url ?? '');
    setError('');
    setEditing(true);
    onMenuClose();
  }

  async function save(nextEnabled: boolean) {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      await onSave({
        profileId: account.id,
        enabled: nextEnabled,
        url: nextEnabled ? url.trim() : (account.proxy?.url ?? ''),
      });
      setEditing(false);
      onMenuClose();
    } catch (error) {
      setError(formatError(error));
    } finally {
      setSaving(false);
    }
  }

  const close = () => {
    if (!saving) setEditing(false);
  };
  return (
    <>
      <button type="button" className={buttonClass} onClick={openEditor} disabled={saving}>
        <IconSliders size={13} /> <span>{enabled ? 'Edit Proxy' : 'Enable Proxy'}</span>
      </button>
      {enabled ? (
        <button
          type="button"
          className={buttonClass}
          disabled={saving}
          onClick={() => void save(false)}
        >
          <IconSliders size={13} />{' '}
          <span>{saving && !editing ? 'Disabling...' : 'Disable Proxy'}</span>
        </button>
      ) : null}
      {!editing && error ? <p role="alert">{error}</p> : null}
      {editing ? (
        <AccountProxyEditor
          name={account.displayName}
          url={url}
          saving={saving}
          error={error}
          onChange={setUrl}
          onSave={() => void save(true)}
          onClose={close}
        />
      ) : null}
    </>
  );
}

function AccountProxyEditor({
  name,
  url,
  saving,
  error,
  onChange,
  onSave,
  onClose,
}: {
  name: string;
  url: string;
  saving: boolean;
  error: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const formId = useId();
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Proxy settings · ${name}`}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <Modal
        title={`Proxy · ${name}`}
        close={onClose}
        footer={
          <div className="modalFootPrimary">
            <UIButton type="button" onClick={onClose} disabled={saving}>
              Cancel
            </UIButton>
            <UIButton type="submit" variant="primary" form={formId} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </UIButton>
          </div>
        }
      >
        <form
          id={formId}
          className="formGrid"
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <label>
            Proxy address
            <input
              autoFocus
              value={url}
              disabled={saving}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="http://127.0.0.1:17891"
              onChange={(event) => onChange(event.target.value)}
            />
          </label>
          <p>
            HTTP/HTTPS proxy. Applies to new processes; restart existing Codex processes to use
            changes.
          </p>
          {error ? <p role="alert">{error}</p> : null}
        </form>
      </Modal>
    </div>,
    document.body,
  );
}
