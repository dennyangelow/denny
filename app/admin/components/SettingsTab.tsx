'use client'
// app/admin/components/SettingsTab.tsx

interface Props {
  ordersCount: number
  leadsCount: number
}

export function SettingsTab({ ordersCount, leadsCount }: Props) {
  const envVars = [
    { key: 'NEXT_PUBLIC_SUPABASE_URL',    label: 'Supabase URL',     status: 'set' },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', label: 'Supabase Anon Key', status: 'set' },
    { key: 'SUPABASE_SERVICE_ROLE_KEY',   label: 'Service Role Key', status: 'set' },
    { key: 'RESEND_API_KEY',              label: 'Resend API Key',   status: 'check' },
    { key: 'ADMIN_EMAIL',                 label: 'Admin Email',      status: 'check' },
    { key: 'NEXT_PUBLIC_SITE_URL',        label: 'Site URL',         status: 'set' },
  ]

  const links = [
    { label: 'Supabase Dashboard', url: 'https://app.supabase.com', icon: '⬡' },
    { label: 'Resend Dashboard',   url: 'https://resend.com/emails', icon: '◉' },
    { label: 'Vercel Dashboard',   url: 'https://vercel.com/dashboard', icon: '▲' },
    { label: 'Главна страница',    url: '/', icon: '◫' },
  ]

  return (
    <div className="settings-root">
      <div className="settings-header">
        <h1 className="page-title">Настройки</h1>
        <p className="page-sub">Системна информация</p>
      </div>

      <div className="settings-grid">
        {/* System info */}
        <div className="section-card">
          <div className="card-hd"><h2>Системна информация</h2></div>
          <div className="info-list">
            {[
              { label: 'Общо поръчки',    value: ordersCount },
              { label: 'Email абоната',   value: leadsCount },
              { label: 'Framework',        value: 'Next.js 14 App Router' },
              { label: 'База данни',       value: 'Supabase (PostgreSQL)' },
              { label: 'Email provider',   value: 'Resend' },
              { label: 'Hosting',          value: 'Vercel' },
            ].map(row => (
              <div key={row.label} className="info-row">
                <span className="info-label">{row.label}</span>
                <span className="info-value">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Env status */}
        <div className="section-card">
          <div className="card-hd"><h2>Environment Variables</h2></div>
          <div className="env-list">
            {envVars.map(e => (
              <div key={e.key} className="env-row">
                <span className="env-key">{e.key}</span>
                <div className="env-right">
                  <span className="env-label">{e.label}</span>
                  <span className={`env-status ${e.status}`}>
                    {e.status === 'set' ? '✓ Настроена' : '? Провери'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="env-note">
            ⚠ Стойностите не се показват от съображения за сигурност.
            Управлявай ги в Vercel Dashboard → Settings → Environment Variables.
          </p>
        </div>

        {/* Quick links */}
        <div className="section-card span-2">
          <div className="card-hd"><h2>Бързи линкове</h2></div>
          <div className="links-grid">
            {links.map(l => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="quick-link">
                <span className="link-icon">{l.icon}</span>
                <span>{l.label}</span>
                <span className="link-arrow">↗</span>
              </a>
            ))}
          </div>
        </div>

        {/* Security reminder */}
        <div className="section-card warn-card span-2">
          <div className="card-hd"><h2>⚠ Сигурност</h2></div>
          <div className="warn-list">
            <div className="warn-item">
              <strong>Защити /admin</strong> — добави middleware с парола или NextAuth.js
              преди да пуснеш сайта в продукция. В момента /admin е достъпна без парола!
            </div>
            <div className="warn-item">
              <strong>RLS в Supabase</strong> — Row Level Security е активирана.
              Само authenticated потребители могат да четат поръчки и leads.
            </div>
            <div className="warn-item">
              <strong>Service Role Key</strong> — никога не я излагай в client-side код.
              Използвай я само в API routes (server-side).
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .settings-root { padding: 28px 32px; }
        .settings-header { margin-bottom: 22px; }
        .page-title { font-size: 22px; font-weight: 700; color: var(--text); letter-spacing: -.02em; }
        .page-sub { font-size: 13px; color: var(--muted); margin-top: 2px; }

        .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .span-2 { grid-column: 1 / -1; }
        @media(max-width:900px) { .settings-grid { grid-template-columns: 1fr; } .span-2 { grid-column: 1; } }

        .section-card { background: #fff; border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
        .card-hd { display: flex; align-items: center; margin-bottom: 16px; }
        .card-hd h2 { font-size: 15px; font-weight: 600; color: var(--text); }

        .info-list { display: flex; flex-direction: column; }
        .info-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f5f5f5; font-size: 13.5px; }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: var(--muted); }
        .info-value { font-weight: 500; color: var(--text); }

        .env-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
        .env-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .env-key { font-family: monospace; font-size: 11px; color: var(--muted); flex: 1; overflow: hidden; text-overflow: ellipsis; }
        .env-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .env-label { font-size: 12px; color: var(--text); }
        .env-status { font-size: 11px; padding: 2px 8px; border-radius: 99px; font-weight: 600; }
        .env-status.set { background: #d1fae5; color: #065f46; }
        .env-status.check { background: #fef3c7; color: #92400e; }
        .env-note { font-size: 12px; color: var(--muted); background: #f9fafb; border-radius: 8px; padding: 10px 12px; }

        .links-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
        .quick-link {
          display: flex; align-items: center; gap: 10px; padding: 12px 14px;
          background: #f8fafc; border: 1px solid var(--border); border-radius: 10px;
          text-decoration: none; color: var(--text); font-size: 14px; transition: all .15s;
        }
        .quick-link:hover { border-color: var(--green); background: #f0fdf4; }
        .link-icon { font-size: 16px; color: var(--green); }
        .link-arrow { margin-left: auto; color: var(--muted); font-size: 12px; }

        .warn-card { border-color: #fde68a; background: #fffbeb; }
        .warn-card .card-hd h2 { color: #92400e; }
        .warn-list { display: flex; flex-direction: column; gap: 10px; }
        .warn-item { font-size: 13.5px; color: #78350f; line-height: 1.6; }
        .warn-item strong { color: #92400e; }
      `}</style>
    </div>
  )
}
