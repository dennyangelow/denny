'use client'

import { useState, useEffect } from 'react'

type Tab = 'dashboard' | 'orders' | 'leads' | 'analytics' | 'settings'
type OrderStatus = 'new' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'all'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: 'Нова', color: '#f59e0b' },
  confirmed: { label: 'Потвърдена', color: '#3b82f6' },
  shipped: { label: 'Изпратена', color: '#8b5cf6' },
  delivered: { label: 'Доставена', color: '#10b981' },
  cancelled: { label: 'Отказана', color: '#ef4444' },
}

const PAYMENT_LABELS: Record<string, string> = {
  cod: 'Наложен платеж',
  bank: 'Банков превод',
  card: 'Карта',
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [orders, setOrders] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [analytics, setAnalytics] = useState<any>(null)
  const [stats, setStats] = useState({ orders: 0, revenue: 0, leads: 0, newOrders: 0 })
  const [orderFilter, setOrderFilter] = useState<OrderStatus>('all')
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [ordRes, leadRes, affRes] = await Promise.all([
      fetch('/api/orders?limit=200').then(r => r.json()),
      fetch('/api/leads').then(r => r.json()),
      fetch('/api/analytics/affiliate-click').then(r => r.json()),
    ])
    const orderList = ordRes.orders || []
    const leadList = leadRes.leads || []
    setOrders(orderList)
    setLeads(leadList)
    setAnalytics(affRes)
    setStats({
      orders: orderList.length,
      revenue: orderList.filter((o: any) => o.status !== 'cancelled').reduce((s: number, o: any) => s + o.total, 0),
      leads: leadList.length,
      newOrders: orderList.filter((o: any) => o.status === 'new').length,
    })
    setLoading(false)
  }

  const updateOrderStatus = async (orderId: string, status: string) => {
    await fetch(`/api/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o))
    if (selectedOrder?.id === orderId) setSelectedOrder((o: any) => ({ ...o, status }))
  }

  const filteredOrders = orders
    .filter(o => orderFilter === 'all' || o.status === orderFilter)
    .filter(o => !search || o.order_number?.includes(search) || o.customer_name?.toLowerCase().includes(search.toLowerCase()) || o.customer_phone?.includes(search))

  return (
    <div className="admin-root">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>🍅</span>
          <div>
            <strong>Denny Angelow</strong>
            <small>Админ панел</small>
          </div>
        </div>

        <nav className="sidebar-nav">
          {([
            { id: 'dashboard', icon: '📊', label: 'Дашборд' },
            { id: 'orders', icon: '🛒', label: 'Поръчки', badge: stats.newOrders || undefined },
            { id: 'leads', icon: '📧', label: 'Email листа' },
            { id: 'analytics', icon: '📈', label: 'Аналитика' },
            { id: 'settings', icon: '⚙️', label: 'Настройки' },
          ] as any[]).map(item => (
            <button
              key={item.id}
              className={`nav-item ${tab === item.id ? 'nav-item--active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <a href="/" className="sidebar-link" target="_blank">← Виж сайта</a>
        </div>
      </aside>

      {/* MAIN */}
      <main className="admin-main">
        {loading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>Зарежда...</p>
          </div>
        ) : (
          <>
            {/* ── DASHBOARD ── */}
            {tab === 'dashboard' && (
              <div className="admin-content">
                <div className="content-header">
                  <h1>Дашборд</h1>
                  <button className="btn-refresh" onClick={fetchAll}>↻ Обнови</button>
                </div>

                <div className="stats-grid">
                  {[
                    { icon: '🛒', label: 'Общо поръчки', value: stats.orders, sub: `${stats.newOrders} нови`, color: '#3b82f6' },
                    { icon: '💰', label: 'Приход', value: `${stats.revenue.toFixed(2)} лв.`, sub: 'без отказани', color: '#10b981' },
                    { icon: '📧', label: 'Email абонати', value: stats.leads, sub: 'от наръчника', color: '#8b5cf6' },
                    { icon: '👆', label: 'Афилиейт кликове', value: analytics?.total || 0, sub: `${analytics?.last30days || 0} за 30 дни`, color: '#f59e0b' },
                  ].map((s, i) => (
                    <div key={i} className="stat-card">
                      <div className="stat-icon" style={{ background: s.color + '20', color: s.color }}>{s.icon}</div>
                      <div className="stat-info">
                        <span className="stat-label">{s.label}</span>
                        <span className="stat-value">{s.value}</span>
                        <span className="stat-sub">{s.sub}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recent orders */}
                <div className="section-card">
                  <div className="card-header">
                    <h2>Последни поръчки</h2>
                    <button className="btn-text" onClick={() => setTab('orders')}>Виж всички →</button>
                  </div>
                  <OrdersTable
                    orders={orders.slice(0, 8)}
                    onSelect={setSelectedOrder}
                    onStatusChange={updateOrderStatus}
                    compact
                  />
                </div>

                {/* Partner clicks */}
                <div className="section-card">
                  <div className="card-header"><h2>Афилиейт кликове по партньор</h2></div>
                  <div className="partner-grid">
                    {Object.entries(analytics?.byPartner || {}).map(([partner, count]: any) => (
                      <div key={partner} className="partner-bar">
                        <div className="partner-info">
                          <span className="partner-name">{partner}</span>
                          <span className="partner-count">{count} клика</span>
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{ width: `${Math.min(100, (count / (analytics?.total || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── ORDERS ── */}
            {tab === 'orders' && (
              <div className="admin-content">
                <div className="content-header">
                  <h1>Поръчки</h1>
                  <div className="header-actions">
                    <input
                      className="search-input"
                      placeholder="Търси по номер, клиент, телефон..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                    <button className="btn-refresh" onClick={fetchAll}>↻</button>
                  </div>
                </div>

                <div className="filter-tabs">
                  {(['all', 'new', 'confirmed', 'shipped', 'delivered', 'cancelled'] as OrderStatus[]).map(s => (
                    <button
                      key={s}
                      className={`filter-tab ${orderFilter === s ? 'filter-tab--active' : ''}`}
                      onClick={() => setOrderFilter(s)}
                    >
                      {s === 'all' ? 'Всички' : STATUS_LABELS[s]?.label}
                      <span className="filter-count">
                        {s === 'all' ? orders.length : orders.filter(o => o.status === s).length}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="table-card">
                  <OrdersTable
                    orders={filteredOrders}
                    onSelect={setSelectedOrder}
                    onStatusChange={updateOrderStatus}
                  />
                </div>
              </div>
            )}

            {/* ── LEADS ── */}
            {tab === 'leads' && (
              <div className="admin-content">
                <div className="content-header">
                  <h1>Email листа — {leads.length} абоната</h1>
                  <button className="btn-export" onClick={() => exportLeadsCSV(leads)}>
                    ⬇ Изтегли CSV
                  </button>
                </div>

                <div className="table-card">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Имейл</th>
                        <th>Имe</th>
                        <th>Источник</th>
                        <th>Дата</th>
                        <th>Статус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map(lead => (
                        <tr key={lead.id}>
                          <td><strong>{lead.email}</strong></td>
                          <td>{lead.name || '—'}</td>
                          <td><span className="source-badge">{lead.source}</span></td>
                          <td>{formatDate(lead.created_at)}</td>
                          <td>
                            <span className={`status-pill ${lead.subscribed ? 'status-pill--green' : 'status-pill--gray'}`}>
                              {lead.subscribed ? 'Абониран' : 'Отписан'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── ANALYTICS ── */}
            {tab === 'analytics' && (
              <div className="admin-content">
                <div className="content-header"><h1>Аналитика</h1></div>

                <div className="analytics-grid">
                  <div className="section-card">
                    <div className="card-header"><h2>Кликове по партньор</h2></div>
                    {Object.entries(analytics?.byPartner || {}).map(([p, c]: any) => (
                      <div key={p} className="analytics-row">
                        <span className="analytics-label">{p}</span>
                        <span className="analytics-bar-wrap">
                          <span className="analytics-bar" style={{ width: `${(c / analytics.total) * 100}%` }} />
                        </span>
                        <span className="analytics-value">{c}</span>
                      </div>
                    ))}
                  </div>

                  <div className="section-card">
                    <div className="card-header"><h2>Топ продукти (кликове)</h2></div>
                    {Object.entries(analytics?.byProduct || {})
                      .sort(([, a]: any, [, b]: any) => b - a)
                      .slice(0, 10)
                      .map(([slug, count]: any) => (
                        <div key={slug} className="analytics-row">
                          <span className="analytics-label">{slug}</span>
                          <span className="analytics-bar-wrap">
                            <span className="analytics-bar" style={{ width: `${(count / (analytics?.total || 1)) * 100}%` }} />
                          </span>
                          <span className="analytics-value">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="section-card">
                  <div className="card-header"><h2>Поръчки по статус</h2></div>
                  <div className="status-overview">
                    {Object.entries(STATUS_LABELS).map(([status, { label, color }]) => {
                      const count = orders.filter(o => o.status === status).length
                      return (
                        <div key={status} className="status-stat">
                          <span className="status-dot" style={{ background: color }} />
                          <span>{label}</span>
                          <strong>{count}</strong>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── SETTINGS ── */}
            {tab === 'settings' && (
              <div className="admin-content">
                <div className="content-header"><h1>Настройки</h1></div>
                <div className="section-card">
                  <h2>Системна информация</h2>
                  <div className="settings-grid">
                    {[
                      { label: 'Имейл за поръчки', value: 'support@dennyangelow.com' },
                      { label: 'Цена доставка', value: '5.99 лв.' },
                      { label: 'Безплатна доставка над', value: '60.00 лв.' },
                      { label: 'База данни', value: 'Supabase (активна)' },
                      { label: 'Email система', value: 'Resend' },
                      { label: 'Framework', value: 'Next.js 14' },
                    ].map((s, i) => (
                      <div key={i} className="setting-row">
                        <span className="setting-label">{s.label}</span>
                        <span className="setting-value">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ORDER DETAIL MODAL */}
      {selectedOrder && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setSelectedOrder(null)}>
          <div className="order-modal">
            <div className="order-modal-header">
              <div>
                <h2>{selectedOrder.order_number}</h2>
                <span>{formatDate(selectedOrder.created_at)}</span>
              </div>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}>✕</button>
            </div>
            <div className="order-modal-body">
              <div className="order-detail-grid">
                <div>
                  <h3>Клиент</h3>
                  <p><strong>{selectedOrder.customer_name}</strong></p>
                  <p>📞 {selectedOrder.customer_phone}</p>
                  {selectedOrder.customer_email && <p>📧 {selectedOrder.customer_email}</p>}
                  <p>📍 {selectedOrder.customer_address}, {selectedOrder.customer_city}</p>
                  {selectedOrder.customer_notes && <p>💬 {selectedOrder.customer_notes}</p>}
                </div>
                <div>
                  <h3>Поръчка</h3>
                  <p>Плащане: {PAYMENT_LABELS[selectedOrder.payment_method]}</p>
                  <p>Продукти: {selectedOrder.subtotal?.toFixed(2)} лв.</p>
                  <p>Доставка: {selectedOrder.shipping?.toFixed(2)} лв.</p>
                  <p><strong>Общо: {selectedOrder.total?.toFixed(2)} лв.</strong></p>
                </div>
              </div>

              <div className="status-update-section">
                <h3>Промени статус</h3>
                <div className="status-buttons">
                  {Object.entries(STATUS_LABELS).map(([status, { label, color }]) => (
                    <button
                      key={status}
                      className={`status-btn ${selectedOrder.status === status ? 'status-btn--active' : ''}`}
                      style={selectedOrder.status === status ? { background: color, color: '#fff', borderColor: color } : { borderColor: color, color: color }}
                      onClick={() => updateOrderStatus(selectedOrder.id, status)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{adminStyles}</style>
    </div>
  )
}

function OrdersTable({ orders, onSelect, onStatusChange, compact }: any) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Номер</th>
          <th>Клиент</th>
          <th>Телефон</th>
          {!compact && <th>Град</th>}
          <th>Сума</th>
          <th>Плащане</th>
          <th>Статус</th>
          <th>Дата</th>
          {!compact && <th>Действие</th>}
        </tr>
      </thead>
      <tbody>
        {orders.length === 0 ? (
          <tr><td colSpan={9} className="empty-row">Няма поръчки</td></tr>
        ) : orders.map((order: any) => (
          <tr key={order.id} className="table-row" onClick={() => onSelect(order)}>
            <td><strong className="order-num">{order.order_number}</strong></td>
            <td>{order.customer_name}</td>
            <td>{order.customer_phone}</td>
            {!compact && <td>{order.customer_city}</td>}
            <td><strong>{order.total?.toFixed(2)} лв.</strong></td>
            <td><span className="source-badge">{PAYMENT_LABELS[order.payment_method] || order.payment_method}</span></td>
            <td>
              <span
                className="status-pill"
                style={{ background: (STATUS_LABELS[order.status]?.color || '#666') + '20', color: STATUS_LABELS[order.status]?.color || '#666' }}
              >
                {STATUS_LABELS[order.status]?.label || order.status}
              </span>
            </td>
            <td>{formatDate(order.created_at)}</td>
            {!compact && (
              <td onClick={e => e.stopPropagation()}>
                <select
                  className="status-select"
                  value={order.status}
                  onChange={e => onStatusChange(order.id, e.target.value)}
                >
                  {Object.entries(STATUS_LABELS).map(([s, { label }]) => (
                    <option key={s} value={s}>{label}</option>
                  ))}
                </select>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function exportLeadsCSV(leads: any[]) {
  const rows = [
    ['Email', 'Имe', 'Источник', 'Дата'],
    ...leads.map(l => [l.email, l.name || '', l.source, formatDate(l.created_at)]),
  ]
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const PAYMENT_LABELS_ADMIN: Record<string, string> = {
  cod: 'Наложен платеж',
  bank: 'Банков превод',
  card: 'Карта',
}

const adminStyles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --green: #2d6a4f;
    --green-light: #d8f3dc;
    --sidebar-bg: #1a2e22;
    --text: #1a1a1a;
    --text-muted: #6b7280;
    --border: #e5e7eb;
    --bg: #f8fafc;
    --card-bg: #fff;
    --font: 'DM Sans', system-ui, sans-serif;
  }

  .admin-root { display: flex; min-height: 100vh; font-family: var(--font); background: var(--bg); }

  /* SIDEBAR */
  .sidebar { width: 240px; background: var(--sidebar-bg); display: flex; flex-direction: column; position: fixed; top: 0; bottom: 0; left: 0; z-index: 50; }
  .sidebar-logo { padding: 24px 20px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid rgba(255,255,255,.08); }
  .sidebar-logo span { font-size: 28px; }
  .sidebar-logo strong { display: block; color: #fff; font-size: 15px; }
  .sidebar-logo small { color: rgba(255,255,255,.4); font-size: 12px; }
  .sidebar-nav { flex: 1; padding: 16px 12px; display: flex; flex-direction: column; gap: 4px; }
  .nav-item { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: none; background: none; color: rgba(255,255,255,.6); font-family: var(--font); font-size: 14px; border-radius: 8px; cursor: pointer; transition: all .15s; text-align: left; }
  .nav-item:hover { background: rgba(255,255,255,.06); color: #fff; }
  .nav-item--active { background: rgba(255,255,255,.1); color: #fff; }
  .nav-icon { font-size: 16px; width: 20px; text-align: center; }
  .nav-badge { background: #ef4444; color: #fff; border-radius: 99px; font-size: 11px; padding: 2px 7px; font-weight: 700; margin-left: auto; }
  .sidebar-footer { padding: 16px 20px; border-top: 1px solid rgba(255,255,255,.08); }
  .sidebar-link { color: rgba(255,255,255,.4); font-size: 13px; text-decoration: none; transition: color .2s; }
  .sidebar-link:hover { color: rgba(255,255,255,.8); }

  /* MAIN */
  .admin-main { flex: 1; margin-left: 240px; min-height: 100vh; }
  .admin-content { padding: 32px; }
  .content-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; flex-wrap: wrap; gap: 12px; }
  .content-header h1 { font-size: 24px; font-weight: 600; color: var(--text); }
  .btn-refresh { background: #fff; border: 1px solid var(--border); border-radius: 8px; padding: 8px 14px; cursor: pointer; font-size: 14px; color: var(--text-muted); transition: all .2s; }
  .btn-refresh:hover { border-color: var(--green); color: var(--green); }
  .btn-export { background: var(--green); color: #fff; border: none; border-radius: 8px; padding: 8px 16px; cursor: pointer; font-size: 14px; font-family: var(--font); }
  .btn-text { background: none; border: none; color: var(--green); cursor: pointer; font-size: 14px; font-weight: 500; }
  .header-actions { display: flex; gap: 8px; align-items: center; }
  .search-input { padding: 8px 14px; border: 1px solid var(--border); border-radius: 8px; font-family: var(--font); font-size: 14px; width: 280px; }
  .search-input:focus { outline: none; border-color: var(--green); }

  /* STATS */
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .stat-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px; }
  .stat-icon { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
  .stat-info { display: flex; flex-direction: column; }
  .stat-label { font-size: 13px; color: var(--text-muted); }
  .stat-value { font-size: 22px; font-weight: 700; color: var(--text); }
  .stat-sub { font-size: 12px; color: var(--text-muted); }

  /* SECTION CARD */
  .section-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 24px; margin-bottom: 20px; }
  .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .card-header h2 { font-size: 16px; font-weight: 600; }
  .table-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-bottom: 20px; }

  /* TABLE */
  .data-table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .data-table th { padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid var(--border); background: #f9fafb; }
  .data-table td { padding: 12px 16px; border-bottom: 1px solid #f3f4f6; color: var(--text); vertical-align: middle; }
  .table-row { cursor: pointer; transition: background .15s; }
  .table-row:hover { background: #f8fafc; }
  .empty-row { text-align: center; color: var(--text-muted); padding: 48px !important; }
  .order-num { font-family: monospace; font-size: 13px; }

  /* PILLS & BADGES */
  .status-pill { padding: 4px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; }
  .status-pill--green { background: #d1fae5; color: #065f46; }
  .status-pill--gray { background: #f3f4f6; color: #6b7280; }
  .source-badge { background: #ede9fe; color: #5b21b6; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 500; }

  /* FILTER TABS */
  .filter-tabs { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
  .filter-tab { padding: 6px 14px; border: 1px solid var(--border); border-radius: 99px; background: #fff; cursor: pointer; font-family: var(--font); font-size: 13px; display: flex; align-items: center; gap: 6px; transition: all .15s; }
  .filter-tab:hover { border-color: var(--green); color: var(--green); }
  .filter-tab--active { background: var(--green); color: #fff; border-color: var(--green); }
  .filter-count { background: rgba(0,0,0,.1); border-radius: 99px; padding: 1px 7px; font-size: 11px; }
  .filter-tab--active .filter-count { background: rgba(255,255,255,.2); }

  /* STATUS SELECT */
  .status-select { font-family: var(--font); font-size: 13px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 6px; background: #fff; cursor: pointer; }

  /* PARTNER BARS */
  .partner-grid { display: flex; flex-direction: column; gap: 12px; }
  .partner-bar { display: flex; flex-direction: column; gap: 6px; }
  .partner-info { display: flex; justify-content: space-between; }
  .partner-name { font-size: 14px; font-weight: 500; }
  .partner-count { font-size: 13px; color: var(--text-muted); }
  .bar-track { height: 6px; background: #f3f4f6; border-radius: 99px; overflow: hidden; }
  .bar-fill { height: 100%; background: var(--green); border-radius: 99px; transition: width .5s; }

  /* ANALYTICS */
  .analytics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  .analytics-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
  .analytics-label { font-size: 13px; width: 140px; flex-shrink: 0; }
  .analytics-bar-wrap { flex: 1; height: 6px; background: #f3f4f6; border-radius: 99px; overflow: hidden; }
  .analytics-bar { display: block; height: 100%; background: var(--green); border-radius: 99px; }
  .analytics-value { font-size: 13px; font-weight: 600; width: 40px; text-align: right; }

  .status-overview { display: flex; flex-wrap: wrap; gap: 20px; }
  .status-stat { display: flex; align-items: center; gap: 8px; }
  .status-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .status-stat strong { margin-left: 4px; font-size: 18px; }

  /* SETTINGS */
  .settings-grid { display: flex; flex-direction: column; }
  .setting-row { display: flex; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
  .setting-label { color: var(--text-muted); }
  .setting-value { font-weight: 500; }

  /* ORDER MODAL */
  .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .order-modal { background: #fff; border-radius: 16px; max-width: 640px; width: 100%; max-height: 90vh; overflow-y: auto; }
  .order-modal-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 24px; border-bottom: 1px solid var(--border); }
  .order-modal-header h2 { font-size: 22px; font-weight: 700; }
  .order-modal-header span { font-size: 13px; color: var(--text-muted); }
  .modal-close { background: #f3f4f6; border: none; border-radius: 50%; width: 32px; height: 32px; cursor: pointer; font-size: 16px; }
  .order-modal-body { padding: 24px; }
  .order-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
  .order-detail-grid h3 { font-size: 13px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 12px; }
  .order-detail-grid p { margin: 4px 0; font-size: 14px; }
  .status-update-section h3 { font-size: 13px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 12px; }
  .status-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
  .status-btn { padding: 6px 16px; border: 1.5px solid; border-radius: 99px; cursor: pointer; font-family: var(--font); font-size: 13px; font-weight: 500; background: #fff; transition: all .15s; }

  /* LOADING */
  .loading-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 50vh; gap: 16px; color: var(--text-muted); }
  .spinner { width: 32px; height: 32px; border: 3px solid #e5e7eb; border-top-color: var(--green); border-radius: 50%; animation: spin .8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`
