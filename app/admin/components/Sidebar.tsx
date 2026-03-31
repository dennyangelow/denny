'use client'
// app/admin/components/Sidebar.tsx — с добавен 📣 Маркетинг таб

import { NAV_ITEMS, type TabId } from '@/lib/constants'

// ──────────────────────────────────────────────────────────────────────────────
// Забележка: Добави 'marketing' към NAV_ITEMS в lib/constants.ts:
//
//   { id: 'marketing', label: 'Маркетинг', icon: '📣' },
//
// И добави 'marketing' към type TabId в същия файл.
// ──────────────────────────────────────────────────────────────────────────────

interface Props {
  tab: TabId
  setTab: (t: TabId) => void
  newOrders: number
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
}

export function Sidebar({ tab, setTab, newOrders, mobileOpen, setMobileOpen }: Props) {
  const handleLogout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' })
    window.location.href = '/admin/login'
  }

  return (
    <>
      <style>{`
        .sidebar{width:220px;background:#0f1f16;display:flex;flex-direction:column;position:fixed;top:0;bottom:0;left:0;z-index:50;transition:transform .3s cubic-bezier(.4,0,.2,1)}
        .sidebar-logo{padding:22px 18px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,.06)}
        .sidebar-logo-mark{width:34px;height:34px;background:#2d6a4f;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
        .sidebar-logo strong{display:block;color:#fff;font-size:14px;font-weight:600;letter-spacing:-.01em}
        .sidebar-logo small{color:rgba(255,255,255,.35);font-size:11px;letter-spacing:.04em;text-transform:uppercase}
        .sidebar-nav{flex:1;padding:14px 10px;display:flex;flex-direction:column;gap:2px;overflow-y:auto}
        .nav-item{width:100%;display:flex;align-items:center;gap:10px;padding:9px 10px;border:none;background:none;color:rgba(255,255,255,.45);font-family:'DM Sans',sans-serif;font-size:13.5px;border-radius:7px;cursor:pointer;transition:all .15s;text-align:left;position:relative}
        .nav-item:hover{background:rgba(255,255,255,.06);color:rgba(255,255,255,.8)}
        .nav-item--active{background:rgba(45,106,79,.35);color:#4ade80}
        .nav-item--active::before{content:'';position:absolute;left:0;top:50%;transform:translateY(-50%);width:3px;height:18px;background:#4ade80;border-radius:0 3px 3px 0}
        .nav-icon{font-size:14px;width:18px;text-align:center;flex-shrink:0;opacity:.7}
        .nav-item--active .nav-icon{opacity:1}
        .nav-badge{background:#ef4444;color:#fff;border-radius:99px;font-size:10px;padding:2px 6px;font-weight:700;margin-left:auto;animation:pulse-badge 2s infinite}
        .nav-badge--green{background:#16a34a;animation:none}
        @keyframes pulse-badge{0%,100%{opacity:1}50%{opacity:.7}}
        .sidebar-footer{padding:14px 10px;border-top:1px solid rgba(255,255,255,.06);display:flex;flex-direction:column;gap:4px}
        .sidebar-footer-btn{display:flex;align-items:center;gap:8px;color:rgba(255,255,255,.35);font-size:12px;text-decoration:none;background:none;border:none;cursor:pointer;font-family:inherit;padding:8px 10px;border-radius:6px;width:100%;transition:all .2s;text-align:left}
        .sidebar-footer-btn:hover{color:rgba(255,255,255,.7);background:rgba(255,255,255,.05)}
        .mobile-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:49;backdrop-filter:blur(2px)}
        .mobile-menu-btn{display:none;position:fixed;top:12px;left:12px;z-index:60;width:36px;height:36px;background:#0f1f16;border:none;border-radius:8px;cursor:pointer;align-items:center;justify-content:center;color:#fff;font-size:16px;box-shadow:0 2px 12px rgba(0,0,0,.3)}
        @media(max-width:768px){
          .sidebar{transform:translateX(-220px)}
          .sidebar.open{transform:translateX(0);box-shadow:4px 0 30px rgba(0,0,0,.4)}
          .mobile-overlay{display:block}
          .mobile-menu-btn{display:flex}
        }
      `}</style>

      <button className="mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)}>
        {mobileOpen ? '✕' : '☰'}
      </button>

      {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}

      <aside className={`sidebar${mobileOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">🍅</div>
          <div>
            <strong>Denny Angelow</strong>
            <small>Admin Panel</small>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-item${tab === item.id ? ' nav-item--active' : ''}`}
              onClick={() => { setTab(item.id as TabId); setMobileOpen(false) }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'orders' && newOrders > 0 && (
                <span className="nav-badge">{newOrders}</span>
              )}
              {/* Маркетинг таб — показва брой активни оферти */}
              {item.id === 'marketing' && (
                <span className="nav-badge nav-badge--green" style={{ fontSize: 9 }}>NEW</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <a href="/" target="_blank" rel="noreferrer" className="sidebar-footer-btn">
            <span>↗</span><span>Виж сайта</span>
          </a>
          <button onClick={handleLogout} className="sidebar-footer-btn" style={{ color: 'rgba(239,68,68,.6)' }}>
            <span>⏻</span><span>Изход</span>
          </button>
        </div>
      </aside>
    </>
  )
}
