'use client'

import { NAV_ITEMS, type TabId } from '@/lib/constants'
import { useRouter } from 'next/navigation'

interface Props {
  tab: TabId
  setTab: (t: TabId) => void
  newOrders: number
  mobileOpen: boolean
  setMobileOpen: (v: boolean) => void
}

export function Sidebar({ tab, setTab, newOrders, mobileOpen, setMobileOpen }: Props) {
  const router = useRouter()

  const handleLogout = async () => {
    if (confirm('Сигурни ли сте, че искате да излезете?')) {
      await fetch('/api/admin/auth', { method: 'DELETE' })
      router.push('/admin/login')
      router.refresh()
    }
  }

  return (
    <>
      <style>{css}</style>

      {/* Бутон за мобилно меню */}
      <button 
        className={`mobile-toggle ${mobileOpen ? 'is-active' : ''}`} 
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Menu"
      >
        <div className="hamburger"></div>
      </button>

      {/* Overlay за затваряне */}
      {mobileOpen && <div className="sidebar-overlay" onClick={() => setMobileOpen(false)} />}

      <aside className={`admin-sidebar ${mobileOpen ? 'is-open' : ''}`}>
        {/* Лого секция */}
        <div className="sidebar-brand">
          <div className="brand-icon">🍅</div>
          <div className="brand-text">
            <span className="name">Denny Angelow</span>
            <span className="status">Admin Panel</span>
          </div>
        </div>

        {/* Навигация */}
        <nav className="sidebar-links">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-link ${tab === item.id ? 'is-active' : ''}`}
              onClick={() => { setTab(item.id as TabId); setMobileOpen(false) }}
            >
              <span className="link-icon">{item.icon}</span>
              <span className="link-label">{item.label}</span>
              {item.id === 'orders' && newOrders > 0 && (
                <span className="order-badge">{newOrders}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Футър с Изход */}
        <div className="sidebar-actions">
          <a href="/" target="_blank" className="action-link">
            <span>↗</span> Виж сайта
          </a>
          <button onClick={handleLogout} className="logout-btn">
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}

const css = `
  .admin-sidebar {
    width: 240px; background: #0a1a11; color: #fff;
    display: flex; flex-direction: column;
    position: fixed; top: 0; bottom: 0; left: 0; z-index: 100;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border-right: 1px solid rgba(255,255,255,0.05);
  }

  .sidebar-brand {
    padding: 30px 24px; display: flex; align-items: center; gap: 12px;
  }
  .brand-icon { font-size: 28px; }
  .brand-text .name { display: block; font-weight: 700; font-size: 15px; }
  .brand-text .status { font-size: 11px; opacity: 0.4; text-transform: uppercase; letter-spacing: 1px; }

  .sidebar-links { flex: 1; padding: 0 12px; display: flex; flex-direction: column; gap: 4px; }
  
  .nav-link {
    display: flex; align-items: center; gap: 12px; padding: 12px 16px;
    background: transparent; border: none; border-radius: 12px;
    color: rgba(255,255,255,0.5); cursor: pointer; transition: 0.2s;
    font-family: inherit; font-size: 14px; font-weight: 500; width: 100%; text-align: left;
  }

  .nav-link:hover { color: #fff; background: rgba(255,255,255,0.05); }
  .nav-link.is-active { color: #4ade80; background: rgba(74, 222, 128, 0.1); }

  .order-badge {
    margin-left: auto; background: #ef4444; color: white;
    font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 20px;
    box-shadow: 0 0 15px rgba(239, 68, 68, 0.4);
  }

  .sidebar-actions { padding: 20px; border-top: 1px solid rgba(255,255,255,0.05); }
  .action-link, .logout-btn {
    display: block; width: 100%; padding: 10px; font-size: 13px; color: rgba(255,255,255,0.4);
    text-decoration: none; border: none; background: none; cursor: pointer; text-align: left;
  }
  .logout-btn:hover { color: #ef4444; }

  /* Mobile Logic */
  @media (max-width: 768px) {
    .admin-sidebar { transform: translateX(-100%); }
    .admin-sidebar.is-open { transform: translateX(0); }
    .mobile-toggle { 
      position: fixed; top: 15px; left: 15px; z-index: 101; 
      width: 40px; height: 40px; background: #0a1a11; border-radius: 10px; border: none;
      display: flex; align-items: center; justify-content: center; color: white;
    }
  }
`