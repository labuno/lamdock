import { useState } from 'react';
import type {
  ProfileProviderBindingViewV2,
  ProviderProfileViewV2,
  UpstreamAuthV2,
} from '../lib/types';
import { UIButton } from './ui-button';
import { IconLogo, IconProviders, IconSliders } from './icons';

type Provider = ProviderProfileViewV2;
type Binding = ProfileProviderBindingViewV2;
type Props = {
  providers: Provider[];
  bindings: Binding[];
  onEdit: (provider: Provider) => void;
  onAttach: (provider: Provider) => void;
  onDetach: (binding: Binding) => void;
  onDelete: (provider: Provider) => void;
  onTest: (provider: Provider) => void;
};

function credentialLabel(auth: UpstreamAuthV2): string {
  if (auth.kind === 'none') return 'None';
  const value = auth.credential;
  switch (value.kind) {
    case 'env':
      return `Env · ${value.envKey}`;
    case 'keychain':
      return `Keychain · v${value.version}`;
    case 'auth_command':
      return `Auth command · ${value.approvalId}`;
    case 'codex_profile':
      return `Codex login · ${value.profileId}`;
    default:
      return 'Missing credential';
  }
}

function protocolLabel(provider: Provider) {
  return provider.protocol === 'responses' ? 'Responses' : 'Chat Completions';
}
function usesGateway(provider: Provider) {
  return provider.protocol === 'chat_completions' || provider.codex.routeViaGateway === true;
}
function ready(provider: Provider) {
  return provider.readiness?.ready ?? provider.readinessBlockers.length === 0;
}
function testLabel(provider: Provider) {
  return provider.lastHealth
    ? provider.lastHealth.ok
      ? 'Test passed'
      : 'Test failed'
    : 'Untested';
}
function latency(provider: Provider) {
  const ms = provider.lastHealth?.latencyMs;
  return ms == null ? '—' : `${ms}ms`;
}

function ProviderSummary({ providers, bindings }: Pick<Props, 'providers' | 'bindings'>) {
  const configured = providers.filter(ready).length;
  const tested = providers.filter((provider) => provider.lastHealth).length;
  return (
    <section className="providerFabricSummary" aria-label="Provider configuration summary">
      <div className="providerFabricScore">
        <IconLogo size={36} />
        <div>
          <strong>
            {configured}/{providers.length}
          </strong>
          <span>Configuration ready</span>
        </div>
      </div>
      <div className="providerFabricCounts">
        <span>
          <i className="providerDot good" />
          {configured} Ready
        </span>
        <span>
          <i className="providerDot warn" />
          {providers.length - configured} Needs setup
        </span>
        <span>{tested} Tested</span>
      </div>
      <div className="providerRouteModes">
        <span>CONNECTION ROUTES</span>
        <div>
          <b>Responses · Direct</b>
          <b>Chat · Gateway</b>
        </div>
      </div>
      <div className="providerFabricTotals">
        <div>
          <span>PROVIDERS</span>
          <strong>{providers.length}</strong>
        </div>
        <div>
          <span>BINDINGS</span>
          <strong>{bindings.length}</strong>
        </div>
        <div>
          <span>MODELS</span>
          <strong>
            {providers.reduce((count, provider) => count + provider.models.length, 0)}
          </strong>
        </div>
      </div>
    </section>
  );
}

function ProviderRow({
  provider,
  bindings,
  selected,
  select,
}: {
  provider: Provider;
  bindings: Binding[];
  selected: boolean;
  select: () => void;
}) {
  return (
    <button
      type="button"
      className={`providerConnectionRow ${selected ? 'isSelected' : ''}`}
      aria-label={`Inspect ${provider.name}`}
      aria-pressed={selected}
      onClick={select}
    >
      <span className="providerRowIdentity">
        <span className="providerRowIcon">
          <IconProviders size={18} />
        </span>
        <span>
          <strong>{provider.name}</strong>
          <small>{provider.baseUrl}</small>
          <em>{protocolLabel(provider)}</em>
        </span>
      </span>
      <span className="providerRowModels">
        {provider.models.slice(0, 3).map((model) => (
          <span key={model.id}>{model.label}</span>
        ))}
        {provider.models.length > 3 ? <span>+{provider.models.length - 3}</span> : null}
      </span>
      <span
        className={`providerRowHealth ${provider.lastHealth ? (provider.lastHealth.ok ? 'good' : 'bad') : ''}`}
      >
        <strong>
          <i
            className={`providerDot ${provider.lastHealth ? (provider.lastHealth.ok ? 'good' : 'bad') : ''}`}
          />
          {latency(provider)}
        </strong>
        <small>{testLabel(provider)}</small>
      </span>
      <span className="providerRowRoute">
        <strong>{usesGateway(provider) ? 'Gateway' : 'Direct'}</strong>
        <small>
          {bindings.length} {bindings.length === 1 ? 'account' : 'accounts'}
        </small>
        <span aria-hidden>›</span>
      </span>
    </button>
  );
}

function ProviderInspector({
  provider,
  bindings,
  actions,
}: {
  provider: Provider;
  bindings: Binding[];
  actions: Props;
}) {
  return (
    <aside className="providerInspector" aria-label="Connection details">
      <div className="providerInspectorHeading">
        <code>#{provider.id}</code>
        <span className={`providerTestBadge ${provider.lastHealth?.ok ? 'good' : ''}`}>
          {testLabel(provider)}
        </span>
      </div>
      <span className="providerEyebrow">PROVIDER INSPECTOR</span>
      <h3>{provider.name}</h3>
      <p className="providerInspectorSubtitle">
        {protocolLabel(provider)} ·{' '}
        <span>
          {bindings.length} {bindings.length === 1 ? 'binding' : 'bindings'}
        </span>
      </p>
      <section className="providerInspectorSection">
        <h4>Gateway configuration</h4>
        <dl>
          <dt>Target Base URL</dt>
          <dd>{provider.baseUrl}</dd>
          <dt>Provider ID</dt>
          <dd>{provider.id}</dd>
          <dt>Route</dt>
          <dd>{usesGateway(provider) ? 'Gateway adapter' : 'Native direct'}</dd>
          <dt>Credential</dt>
          <dd>{credentialLabel(provider.upstreamAuth)}</dd>
          <dt>Default model</dt>
          <dd>{provider.defaultModel}</dd>
        </dl>
      </section>
      <section className="providerInspectorSection">
        <h4>Connection &amp; readiness</h4>
        <div className="providerReadiness">
          <i className={`providerDot ${ready(provider) ? 'good' : 'warn'}`} />
          {ready(provider) ? 'Configuration ready' : 'Configuration needs attention'}
        </div>
        {provider.readinessBlockers.length ? (
          <div className="notice providerBlockers" role="status">
            {provider.readinessBlockers.map((blocker) => (
              <span key={blocker}>{blocker}</span>
            ))}
          </div>
        ) : null}
        {provider.protocol === 'chat_completions' && ready(provider) ? (
          <p className="statusHint">Gateway adapter route ready</p>
        ) : null}
        <dl>
          <dt>Last upstream test</dt>
          <dd>{testLabel(provider)}</dd>
          <dt>Observed latency</dt>
          <dd>{latency(provider)}</dd>
          <dt>Observed at</dt>
          <dd>
            {provider.lastHealth?.observedAt
              ? new Date(provider.lastHealth.observedAt).toLocaleString()
              : 'Not tested'}
          </dd>
        </dl>
        {provider.lastHealth?.errorCode ? (
          <p className="providerTestError">{provider.lastHealth.errorCode}</p>
        ) : null}
      </section>
      <section className="providerInspectorSection">
        <h4>Model mapping &amp; constraints</h4>
        <div className="providerInspectorModels">
          {provider.models.map((model) => (
            <div key={model.id}>
              <strong>{model.label}</strong>
              <span>
                {model.contextWindow
                  ? `${model.contextWindow.toLocaleString()} context`
                  : 'Context not specified'}
              </span>
              <small>{model.id}</small>
              {model.id === provider.defaultModel ? <b>Default</b> : null}
            </div>
          ))}
        </div>
      </section>
      <div className="providerInspectorActions">
        {provider.protocol === 'responses' ? (
          <UIButton variant="primary" onClick={() => actions.onTest(provider)}>
            Test upstream
          </UIButton>
        ) : null}
        <div>
          <UIButton onClick={() => actions.onEdit(provider)}>Edit</UIButton>
          <UIButton disabled={!ready(provider)} onClick={() => actions.onAttach(provider)}>
            Attach
          </UIButton>
        </div>
        {bindings.map((binding) => (
          <UIButton
            key={binding.profileId}
            variant="danger"
            onClick={() => actions.onDetach(binding)}
          >
            Detach {binding.profileId}
          </UIButton>
        ))}
        <UIButton
          variant="danger"
          disabled={bindings.length > 0}
          title={bindings.length ? 'Detach all accounts before deleting' : undefined}
          onClick={() => actions.onDelete(provider)}
        >
          Delete Provider
        </UIButton>
      </div>
    </aside>
  );
}

export function ProviderCards(props: Props) {
  const { providers, bindings } = props;
  const [query, setQuery] = useState('');
  const [protocol, setProtocol] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visible = providers.filter(
    (provider) =>
      (protocol === 'all' || provider.protocol === protocol) &&
      [
        provider.name,
        provider.baseUrl,
        provider.protocol,
        ...provider.models.flatMap((model) => [model.id, model.label]),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const selected = visible.find((provider) => provider.id === selectedId) ?? visible[0];
  if (!providers.length)
    return (
      <div className="emptyState">
        <strong>No API connections yet</strong>
        <p>Add an External API account to create its connection automatically.</p>
      </div>
    );
  return (
    <div className="providerWorkspace">
      <ProviderSummary providers={providers} bindings={bindings} />
      <div className="providerFabricToolbar">
        <div className="providerProtocolFilters" aria-label="Provider protocols">
          {[
            ['all', 'All'],
            ['responses', 'Responses'],
            ['chat_completions', 'Chat Completions'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={protocol === value}
              onClick={() => setProtocol(value)}
            >
              {label} (
              {
                providers.filter((provider) => value === 'all' || provider.protocol === value)
                  .length
              }
              )
            </button>
          ))}
        </div>
        <label className="providerSearch">
          <IconSliders size={15} />
          <input
            type="search"
            aria-label="Filter connections"
            placeholder="Filter providers, models, or endpoint URLs…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      {!selected ? (
        <div className="emptyBox">No connections match your search.</div>
      ) : (
        <div className="providerSplitView">
          <div className="providerConnectionList" aria-label="Provider connections">
            <div className="providerListColumns" aria-hidden="true">
              <span>PROVIDER &amp; PROTOCOL</span>
              <span>CONFIGURED MODELS</span>
              <span>LAST UPSTREAM TEST</span>
              <span>ROUTING &amp; ACCOUNTS</span>
            </div>
            {visible.map((provider) => (
              <ProviderRow
                key={provider.id}
                provider={provider}
                bindings={bindings.filter((binding) => binding.providerId === provider.id)}
                selected={provider.id === selected.id}
                select={() => setSelectedId(provider.id)}
              />
            ))}
          </div>
          <ProviderInspector
            provider={selected}
            bindings={bindings.filter((binding) => binding.providerId === selected.id)}
            actions={props}
          />
        </div>
      )}
    </div>
  );
}
