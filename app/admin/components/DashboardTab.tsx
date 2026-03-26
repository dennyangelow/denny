'use client'
// app/admin/components/DashboardTab.tsx — v7

import { useMemo, useState, useEffect } from 'react'
import {
  ResponsiveContainer, CartesianGrid, BarChart, Bar, XAxis, YAxis, Tooltip,
  ComposedChart, Area, Line,
} from 'recharts'
import type { Order, Lead, AffiliateAnalytics } from '@/lib/supabase'
import type { AdminStats, PageViewStats } from '@/hooks/useAdminData'
import { STATUS_LABELS } from '@/lib/constants'

interface Props {
  stats: AdminStats
  orders: Order[]
  leads: Lead[]
  analytics: AffiliateAnalytics | null
  pageViews: PageViewStats | null
  onRefresh: () => void
  onViewOrder: (o: Order) => void
}

function buildChart(orders: Order[], pvData: PageViewStats | null) {
  const rvMap: Record<string, number> = {}
  const orMap: Record<string, number> = {}
  orders.filter(o => o.status !== 'cancelled').forEach(o => {
    const d = o.created_at.slice(0, 10)
    rvMap[d] = (rvMap[d] || 0) + Number(o.total)
    orMap[d] = (orMap[d] || 0) + 1
  })
  const pvMap: Record<string, number> = {}
  pvData?.dailyChart?.forEach(d => { pvMap[d.date] = d.count })
  const result = []
  for (let i = 29; i >= 0; i--) {
    const date  = new Date(Date.now() - i * 86400000)
    const key   = date.toISOString().slice(0, 10)
    const label = `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}`
    result.push({ date: label, revenue: Math.round((rvMap[key]||0)*100)/100, orders: orMap[key]||0, views: pvMap[label]||0 })
  }
  return result
}

function topCities(orders: Order[]) {
  const m: Record<string, {count:number; revenue:number}> = {}
  orders.forEach(o => {
    const c = o.customer_city?.trim() || 'Неизвестен'
    if (!m[c]) m[c] = {count:0, revenue:0}
    m[c].count++; m[c].revenue += Number(o.total)
  })
  return Object.entries(m).sort((a,b)=>b[1].count-a[1].count).slice(0,7).map(([city,d])=>({city,...d}))
}

function topProducts(orders: Order[]) {
  const m: Record<string, {qty:number; revenue:number}> = {}
  orders.forEach(o => {
    (o.order_items||[]).forEach((item:any)=>{
      if (!m[item.product_name]) m[item.product_name] = {qty:0,revenue:0}
      m[item.product_name].qty += item.quantity
      m[item.product_name].revenue += Number(item.total_price)
    })
  })
  return Object.entries(m).sort((a,b)=>b[1].revenue-a[1].revenue).slice(0,5).map(([name,d])=>({name,...d}))
}

function leadsGrowth(leads: Lead[]) {
  const m: Record<string, number> = {}
  leads.forEach(l => { const d=l.created_at.slice(0,10); m[d]=(m[d]||0)+1 })
  const result = []
  for (let i=29; i>=0; i--) {
    const date  = new Date(Date.now() - i*86400000)
    const key   = date.toISOString().slice(0,10)
    const label = `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}`
    result.push({ date: label, count: m[key]||0 })
  }
  return result
}

export function DashboardTab({ stats, orders, leads, analytics, pageViews, onRefresh, onViewOrder }: Props) {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t) }, [])

  const chartData    = useMemo(() => buildChart(orders, pageViews), [orders, pageViews])
  const cities       = useMemo(() => topCities(orders), [orders])
  const products     = useMemo(() => topProducts(orders), [orders])
  const leadsData    = useMemo(() => leadsGrowth(leads), [leads])
  const recentOrders = useMemo(() => [...orders].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,8), [orders])
  const maxCity      = cities[0]?.count || 1
  const maxProd      = products[0]?.revenue || 1

  const kpis = [
    { label:'Общ приход',        value:`${stats.revenue.toFixed(2)} лв.`,     sub:`Тази седмица: ${stats.weekRevenue.toFixed(2)} лв.`, color:'#16a34a', bg:'#f0fdf4', icon:'💰' },
    { label:'Днешен приход',     value:`${stats.todayRevenue.toFixed(2)} лв.`, sub:'само днес',                                         color:'#0ea5e9', bg:'#f0f9ff', icon:'☀️' },
    { label:'Поръчки общо',      value:String(stats.totalOrders),              sub:`${stats.newOrders} нови чакат`,                     color:'#8b5cf6', bg:'#faf5ff', icon:'🛒' },
    { label:'Средна поръчка',    value:`${stats.avgOrderValue.toFixed(2)} лв.`,sub:'на активна поръчка',                               color:'#f59e0b', bg:'#fffbeb', icon:'📊' },
    { label:'Email абонати',     value:String(stats.leads),                    sub:'от наръчника',                                      color:'#ec4899', bg:'#fdf2f8', icon:'📧' },
    { label:'Посещения 30 дни',  value:pageViews?.last30 ? (pageViews.last30>=1000?`${(pageViews.last30/1000).toFixed(1)}K`:String(pageViews.last30)) : '—', sub:`Днес: ${pageViews?.today||0}`, color:'#06b6d4', bg:'#ecfeff', icon:'👁️' },
    { label:'Чакат плащане',     value:String(stats.pendingPayments),          sub:'наложен платеж',                                    color:'#ef4444', bg:'#fff1f2', icon:'⏳' },
    { label:'Конверсия',         value:`${stats.conversionRate.toFixed(2)}%`,  sub:'посещения → поръчка',                               color:'#10b981', bg:'#f0fdf4', icon:'🎯' },
  ]

  const greeting = now.getHours() < 12 ? '☀️ Добро утро' : now.getHours() < 18 ? '🌤️ Добър ден' : '🌙 Добър вечер'

  return (
    <div className="da-root">
      {/* Header */}
      <div className="da-head">
        <div>
          <div className="da-greeting">{greeting}, Дени!</div>
          <h1 className="da-title">Дашборд</h1>
          <div className="da-date">{now.toLocaleDateString('bg-BG',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <div className="live-pill"><span className="live-dot2"/>LIVE</div>
          <button className="btn-rf" onClick={onRefresh}>↻ Обнови</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-g">
        {kpis.map((k,i)=>(
          <div key={i} className="kpi" style={{'--kc':k.color,'--kb':k.bg} as React.CSSProperties}>
            <div className="kpi-bar2"/>
            <div className="kpi-ic">{k.icon}</div>
            <div>
              <div className="kpi-lbl">{k.label}</div>
              <div className="kpi-val">{k.value}</div>
              <div className="kpi-s">{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue + Views combined */}
      <div className="c span2">
        <div className="c-hd">
          <div><h2>Приход &amp; Посещения — 30 дни</h2><p className="c-note">🟢 Приход (лв.) &nbsp; 🔵 Посещения &nbsp; 📦 Поръчки</p></div>
        </div>
        <div style={{height:220}}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{top:4,right:4,left:-10,bottom:0}}>
              <defs>
                <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.22}/>
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02}/>
                </linearGradient>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.18}/>
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.04)"/>
              <XAxis dataKey="date" tick={{fontSize:10,fill:'#9ca3af'}} tickLine={false} axisLine={false} interval={4}/>
              <YAxis yAxisId="r" tick={{fontSize:10,fill:'#9ca3af'}} tickLine={false} axisLine={false} tickFormatter={v=>`${v}лв`} width={52}/>
              <YAxis yAxisId="p" orientation="right" tick={{fontSize:10,fill:'#9ca3af'}} tickLine={false} axisLine={false} width={32}/>
              <Tooltip contentStyle={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:10,fontSize:12}}
                formatter={(v:number,name:string)=>[
                  name==='revenue'?`${v.toFixed(2)} лв.`:name==='views'?`${v} посещения`:`${v} бр.`,
                  name==='revenue'?'Приход':name==='views'?'Посещения':'Поръчки',
                ]}
              />
              <Bar yAxisId="r" dataKey="revenue" fill="#16a34a" opacity={0.12} radius={[2,2,0,0]}/>
              <Area yAxisId="r" type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2.5} fill="url(#rg)" dot={false} activeDot={{r:4}}/>
              <Line yAxisId="p" type="monotone" dataKey="views" stroke="#0ea5e9" strokeWidth={1.5} dot={false} activeDot={{r:3}}/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Leads growth */}
      <div className="c">
        <div className="c-hd">
          <h2>Нови абонати (30 дни)</h2>
          <span className="bdg">{leads.filter(l=>l.created_at>=new Date(Date.now()-30*86400000).toISOString()).length} тази месец</span>
        </div>
        <div style={{height:150}}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={leadsData} margin={{top:4,right:4,left:-10,bottom:0}}>
              <XAxis dataKey="date" tick={{fontSize:10,fill:'#9ca3af'}} tickLine={false} axisLine={false} interval={6}/>
              <YAxis tick={{fontSize:10,fill:'#9ca3af'}} tickLine={false} axisLine={false} width={22} allowDecimals={false}/>
              <Tooltip contentStyle={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,fontSize:12}} formatter={(v:number)=>[v,'Абонати']}/>
              <Bar dataKey="count" fill="#ec4899" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top cities */}
      <div className="c">
        <div className="c-hd"><h2>Топ градове</h2><span className="bdg">{cities.length} града</span></div>
        {cities.length===0 ? <div className="emp">Няма данни</div> : (
          <div className="rl">
            {cities.map((c,i)=>(
              <div key={c.city} className="rr">
                <span className="rn">{i+1}</span>
                <span className="rnm">{c.city}</span>
                <div className="rbt"><div className="rbf" style={{width:`${(c.count/maxCity)*100}%`}}/></div>
                <span className="rv">{c.count} бр.</span>
                <span className="rr2">{c.revenue.toFixed(0)} лв.</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top products */}
      <div className="c">
        <div className="c-hd"><h2>Топ продукти</h2><span className="bdg">по приход</span></div>
        {products.length===0 ? <div className="emp">Няма данни</div> : (
          <div className="rl">
            {products.map((p,i)=>(
              <div key={p.name} className="rr">
                <span className="rn">{i+1}</span>
                <span className="rnm" style={{flex:1}}>{p.name}</span>
                <div className="rbt" style={{width:80}}><div className="rbf" style={{width:`${(p.revenue/maxProd)*100}%`,background:'#8b5cf6'}}/></div>
                <span className="rv">{p.qty} бр.</span>
                <span className="rr2">{p.revenue.toFixed(0)} лв.</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Affiliate */}
      <div className="c">
        <div className="c-hd"><h2>Афилиейт кликове</h2><span className="bdg">{analytics?.total||0} общо · {analytics?.last30days||0} за 30 дни</span></div>
        {!analytics||Object.keys(analytics.byPartner||{}).length===0 ? <div className="emp">Няма данни</div> : (
          <div className="rl">
            {Object.entries(analytics.byPartner).sort(([,a],[,b])=>(b as number)-(a as number)).map(([name,cnt])=>(
              <div key={name} className="rr">
                <span className="rnm">{name}</span>
                <div className="rbt"><div className="rbf" style={{width:`${((cnt as number)/(analytics.total||1))*100}%`,background:'#f59e0b'}}/></div>
                <span className="rv">{cnt as number}</span>
                <span className="rr2">{Math.round(((cnt as number)/(analytics.total||1))*100)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status grid */}
      <div className="c">
        <div className="c-hd"><h2>Статуси на поръчките</h2></div>
        <div className="sg">
          {Object.entries(STATUS_LABELS).map(([key,s])=>{
            const count = orders.filter(o=>o.status===key).length
            const pct   = orders.length ? Math.round(count/orders.length*100) : 0
            return (
              <div key={key} className="si" style={{'--sc':s.color,'--sb':s.bg} as React.CSSProperties}>
                <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:8}}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:s.color,flexShrink:0}}/>
                  <span style={{fontSize:12,color:'#6b7280'}}>{s.label}</span>
                </div>
                <div style={{fontSize:26,fontWeight:800,color:'var(--text)',marginBottom:8}}>{count}</div>
                <div style={{height:4,background:'#e5e7eb',borderRadius:99,overflow:'hidden',marginBottom:4}}>
                  <div style={{width:`${pct}%`,height:'100%',background:s.color,borderRadius:99}}/>
                </div>
                <div style={{fontSize:11,color:'#9ca3af'}}>{pct}%</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent orders table */}
      <div className="c span2">
        <div className="c-hd"><h2>Последни поръчки</h2><span className="bdg">Кликни за детайли</span></div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13.5px'}}>
            <thead>
              <tr>
                {['Номер','Клиент','Град','Статус','Плащане','Сума','Дата'].map(h=>(
                  <th key={h} style={{padding:'9px 12px',textAlign:h==='Сума'||h==='Дата'?'right':'left',fontSize:11,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'.04em',borderBottom:'2px solid var(--border)',background:'#fafafa'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentOrders.map(o=>{
                const s=STATUS_LABELS[o.status]
                return (
                  <tr key={o.id} onClick={()=>onViewOrder(o)} style={{cursor:'pointer',transition:'background .1s'}}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='#f0fdf4'}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=''}}
                  >
                    <td style={{padding:'11px 12px',borderBottom:'1px solid #f5f5f5'}}><span style={{fontFamily:'monospace',fontSize:12,color:'#6b7280'}}>{o.order_number}</span></td>
                    <td style={{padding:'11px 12px',borderBottom:'1px solid #f5f5f5',fontWeight:600}}>{o.customer_name}</td>
                    <td style={{padding:'11px 12px',borderBottom:'1px solid #f5f5f5',color:'#6b7280',fontSize:13}}>{o.customer_city}</td>
                    <td style={{padding:'11px 12px',borderBottom:'1px solid #f5f5f5'}}><span style={{background:s.bg,color:s.color,padding:'3px 9px',borderRadius:99,fontSize:11,fontWeight:700}}>{s.label}</span></td>
                    <td style={{padding:'11px 12px',borderBottom:'1px solid #f5f5f5',fontSize:12,color:'#6b7280'}}>{o.payment_method==='cod'?'Наложен':'Банков'}</td>
                    <td style={{padding:'11px 12px',borderBottom:'1px solid #f5f5f5',textAlign:'right',fontWeight:700,color:'#16a34a'}}>{Number(o.total).toFixed(2)} лв.</td>
                    <td style={{padding:'11px 12px',borderBottom:'1px solid #f5f5f5',textAlign:'right',fontSize:12,color:'#9ca3af',whiteSpace:'nowrap'}}>
                      {new Date(o.created_at).toLocaleDateString('bg-BG',{day:'2-digit',month:'short'})}
                    </td>
                  </tr>
                )
              })}
              {recentOrders.length===0&&<tr><td colSpan={7} style={{textAlign:'center',padding:40,color:'#9ca3af',fontSize:14}}>Няма поръчки</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .da-root { padding: 24px 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }
        @media(max-width:900px){ .da-root { grid-template-columns: 1fr; } }
        .da-head { grid-column:1/-1; display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
        .da-greeting { font-size:13px; color:var(--muted); margin-bottom:4px; }
        .da-title { font-size:24px; font-weight:800; color:var(--text); letter-spacing:-.03em; }
        .da-date { font-size:13px; color:var(--muted); margin-top:3px; text-transform:capitalize; }
        .btn-rf { background:#fff; border:1px solid var(--border); border-radius:9px; padding:8px 16px; cursor:pointer; font-size:13px; color:var(--muted); font-family:inherit; transition:all .2s; }
        .btn-rf:hover { border-color:#16a34a; color:#16a34a; }
        .live-pill { display:flex; align-items:center; gap:6px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:99px; padding:6px 12px; font-size:11px; font-weight:800; color:#16a34a; letter-spacing:.06em; }
        .live-dot2 { width:7px; height:7px; background:#16a34a; border-radius:50%; animation:plv 2s infinite; flex-shrink:0; }
        @keyframes plv { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }

        .kpi-g { grid-column:1/-1; display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
        @media(max-width:960px){ .kpi-g { grid-template-columns:repeat(2,1fr); } }
        @media(max-width:500px){ .kpi-g { grid-template-columns:1fr 1fr; } }
        .kpi { background:#fff; border:1px solid var(--border); border-radius:14px; padding:16px; display:flex; align-items:flex-start; gap:12px; position:relative; overflow:hidden; transition:all .2s; }
        .kpi:hover { box-shadow:0 4px 20px rgba(0,0,0,.07); transform:translateY(-1px); }
        .kpi-bar2 { position:absolute; top:0; left:0; right:0; height:3px; background:var(--kc); }
        .kpi-ic { width:40px; height:40px; border-radius:11px; background:var(--kb); display:flex; align-items:center; justify-content:center; font-size:19px; flex-shrink:0; }
        .kpi-lbl { font-size:11px; color:var(--muted); margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .kpi-val { font-size:21px; font-weight:800; color:var(--text); line-height:1.1; }
        .kpi-s { font-size:11px; color:var(--muted); margin-top:2px; }

        .c { background:#fff; border:1px solid var(--border); border-radius:14px; padding:20px; }
        .span2 { grid-column:1/-1; }
        .c-hd { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:16px; gap:12px; }
        .c-hd h2 { font-size:15px; font-weight:700; color:var(--text); }
        .c-note { font-size:12px; color:var(--muted); margin-top:2px; }
        .bdg { background:#f3f4f6; color:var(--muted); padding:3px 10px; border-radius:99px; font-size:12px; font-weight:600; white-space:nowrap; flex-shrink:0; }
        .emp { text-align:center; color:var(--muted); padding:24px 0; font-size:14px; }

        .rl { display:flex; flex-direction:column; gap:8px; }
        .rr { display:flex; align-items:center; gap:10px; }
        .rn { font-size:12px; font-weight:800; color:var(--muted); width:18px; flex-shrink:0; }
        .rnm { font-size:13px; color:var(--text); width:120px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex-shrink:0; }
        .rbt { flex:1; height:6px; background:#f3f4f6; border-radius:99px; overflow:hidden; }
        .rbf { height:100%; background:#16a34a; border-radius:99px; transition:width .6s; }
        .rv { font-size:12px; color:var(--muted); min-width:42px; text-align:right; }
        .rr2 { font-size:12px; font-weight:700; color:var(--text); min-width:60px; text-align:right; }

        .sg { display:grid; grid-template-columns:repeat(5,1fr); gap:10px; }
        @media(max-width:900px){ .sg { grid-template-columns:repeat(3,1fr); } }
        .si { background:var(--sb,#f9fafb); border:1px solid var(--border); border-radius:12px; padding:14px; }
      `}</style>
    </div>
  )
}
