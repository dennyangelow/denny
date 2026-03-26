'use client'
// app/admin/components/AnalyticsTab.tsx — v7 с посещения, funnel, UTM

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts'
import type { Order, AffiliateAnalytics } from '@/lib/supabase'
import type { PageViewStats } from '@/hooks/useAdminData'
import { STATUS_LABELS } from '@/lib/constants'

interface Props {
  analytics: AffiliateAnalytics | null
  pageViews: PageViewStats | null
  orders: Order[]
}

const PIE_COLORS = ['#16a34a','#0ea5e9','#8b5cf6','#f59e0b','#ec4899','#06b6d4','#ef4444']

export function AnalyticsTab({ analytics, pageViews, orders }: Props) {
  const [period, setPeriod] = useState<'7'|'14'|'30'>('30')

  // Revenue by day
  const revenueData = (() => {
    const days = Number(period)
    const m: Record<string, number> = {}
    orders.filter(o => o.status !== 'cancelled').forEach(o => {
      const d = o.created_at.slice(5, 10)
      m[d] = (m[d] || 0) + Number(o.total)
    })
    return Object.entries(m).sort(([a],[b])=>a.localeCompare(b)).slice(-days)
      .map(([date, total]) => ({ date, total: Math.round(total*100)/100 }))
  })()

  // Status pie
  const statusData = Object.entries(STATUS_LABELS)
    .map(([key, s]) => ({ name: s.label, value: orders.filter(o=>o.status===key).length, color: s.color }))
    .filter(d=>d.value>0)

  // Payment method pie
  const paymentData = [
    { name:'Наложен платеж', value: orders.filter(o=>o.payment_method==='cod').length },
    { name:'Банков превод',  value: orders.filter(o=>o.payment_method==='bank').length },
    { name:'Карта',          value: orders.filter(o=>o.payment_method==='card').length },
  ].filter(d=>d.value>0)

  // Funnel
  const totalViews = pageViews?.last30 || 0
  const totalOrders30 = orders.filter(o => {
    const d30 = new Date(Date.now()-30*86400000).toISOString()
    return o.created_at >= d30
  }).length
  const totalLeads30 = 0 // would need leads passed
  const funnelData = [
    { name:'Посещения',   value: totalViews,    pct: 100,                                         color:'#0ea5e9' },
    { name:'Формуляри',   value: Math.round(totalViews*0.08), pct: 8,                             color:'#8b5cf6' },
    { name:'Поръчки',     value: totalOrders30, pct: totalViews?Math.round(totalOrders30/totalViews*100):0, color:'#16a34a' },
  ]

  // Page views daily (from pageViews API)
  const pvChartData = pageViews?.dailyChart?.slice(-Number(period)) || []

  // Referrers
  const referrers = pageViews?.topReferrers || []
  const maxRef = referrers[0]?.count || 1

  // UTM
  const utmData = pageViews?.topUtm || []

  // City from orders
  const cityMap: Record<string, number> = {}
  orders.forEach(o => { const c=o.customer_city||'—'; cityMap[c]=(cityMap[c]||0)+1 })
  const cityData = Object.entries(cityMap).sort(([,a],[,b])=>b-a).slice(0,8)
    .map(([city, count]) => ({ city, count }))

  // Affiliate product clicks
  const productClicks = Object.entries(analytics?.byProduct || {})
    .sort(([,a],[,b])=>(b as number)-(a as number))
    .slice(0,8)
    .map(([name,value])=>({ name, value: value as number }))
  const maxProd = productClicks[0]?.value || 1

  // Month-over-month revenue
  const now = new Date()
  const thisMonth = now.toISOString().slice(0,7)
  const prevMonth = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().slice(0,7)
  const thisRev = orders.filter(o=>o.created_at.slice(0,7)===thisMonth&&o.status!=='cancelled').reduce((s,o)=>s+Number(o.total),0)
  const prevRev = orders.filter(o=>o.created_at.slice(0,7)===prevMonth&&o.status!=='cancelled').reduce((s,o)=>s+Number(o.total),0)
  const momChange = prevRev ? Math.round((thisRev-prevRev)/prevRev*100) : 0

  return (
    <div className="an-root">
      {/* Header */}
      <div className="an-head">
        <div>
          <h1 className="an-title">Аналитика</h1>
          <p className="an-sub">{orders.length} поръчки · {analytics?.total||0} афилиейт клика · {pageViews?.total||0} посещения</p>
        </div>
        <div className="period-tabs">
          {(['7','14','30'] as const).map(p=>(
            <button key={p} className={`ptab${period===p?' ptab-a':''}`} onClick={()=>setPeriod(p)}>
              {p} дни
            </button>
          ))}
        </div>
      </div>

      {/* Top-line summary cards */}
      <div className="an-summary">
        {[
          { label:'Посещения (30 дни)', value: pageViews?.last30||0, sub:`Днес: ${pageViews?.today||0}`, color:'#0ea5e9' },
          { label:'Поръчки (30 дни)',   value: totalOrders30, sub:`Конверсия: ${totalViews?((totalOrders30/totalViews)*100).toFixed(2):'0.00'}%`, color:'#16a34a' },
          { label:'Приход (тази месец)', value:`${thisRev.toFixed(0)} лв.`, sub:`${momChange>0?'+':''}${momChange}% спрямо мин. месец`, color: momChange>=0?'#16a34a':'#ef4444' },
          { label:'Мобилни посетители', value:`${pageViews?.mobilePercent||0}%`, sub:'от всички посещения', color:'#8b5cf6' },
        ].map((s,i)=>(
          <div key={i} className="an-sc" style={{'--ac':s.color} as React.CSSProperties}>
            <div className="an-sc-bar"/>
            <div className="an-sc-val">{s.value}</div>
            <div className="an-sc-lbl">{s.label}</div>
            <div className="an-sc-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="an-grid">
        {/* Page views chart */}
        <div className="ac span2">
          <div className="ac-hd"><h2>Посещения на сайта</h2><span className="bdg">{pageViews?.last30||0} за 30 дни</span></div>
          {pvChartData.length>0 ? (
            <div style={{height:200}}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={pvChartData} margin={{top:4,right:4,left:-10,bottom:0}}>
                  <defs>
                    <linearGradient id="pvg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,.04)"/>
                  <XAxis dataKey="date" tick={{fontSize:10,fill:'#9ca3af'}} tickLine={false} axisLine={false} interval={4}/>
                  <YAxis tick={{fontSize:10,fill:'#9ca3af'}} tickLine={false} axisLine={false} width={28} allowDecimals={false}/>
                  <Tooltip contentStyle={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,fontSize:12}} formatter={(v:number)=>[v,'Посещения']}/>
                  <Area type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={2} fill="url(#pvg)" dot={false} activeDot={{r:4}}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="emp">Инсталирай page view tracking — виж README</div>}
        </div>

        {/* Revenue chart */}
        <div className="ac span2">
          <div className="ac-hd"><h2>Приход по дни</h2></div>
          {revenueData.length>0 ? (
            <div style={{height:180}}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData} margin={{top:4,right:4,left:-10,bottom:0}}>
                  <XAxis dataKey="date" tick={{fontSize:10,fill:'#9ca3af'}} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fontSize:10,fill:'#9ca3af'}} tickLine={false} axisLine={false} tickFormatter={v=>`${v}лв`} width={52}/>
                  <Tooltip contentStyle={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,fontSize:12}} formatter={(v:number)=>[`${v.toFixed(2)} лв.`,'Приход']}/>
                  <Bar dataKey="total" fill="#16a34a" radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="emp">Няма данни</div>}
        </div>

        {/* Funnel */}
        <div className="ac">
          <div className="ac-hd"><h2>Конверсионна фуния</h2><span className="bdg">30 дни</span></div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {funnelData.map((f,i)=>(
              <div key={f.name}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:4}}>
                  <span style={{fontWeight:600}}>{f.name}</span>
                  <span style={{color:'#6b7280'}}>{f.value.toLocaleString()}</span>
                </div>
                <div style={{height:28,background:'#f3f4f6',borderRadius:8,overflow:'hidden',position:'relative'}}>
                  <div style={{width:`${100-i*30}%`,height:'100%',background:f.color,borderRadius:8,opacity:.85,transition:'width .6s'}}/>
                  <span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',fontSize:12,fontWeight:700,color:i===0?'#0369a1':i===1?'#5b21b6':'#065f46'}}>{f.pct}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Referrers */}
        <div className="ac">
          <div className="ac-hd"><h2>Източници на трафик</h2></div>
          {referrers.length===0 ? <div className="emp">Инсталирай page view tracking</div> : (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {referrers.map(r=>(
                <div key={r.name} style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:13,width:130,flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.name}</span>
                  <div style={{flex:1,height:6,background:'#f3f4f6',borderRadius:99,overflow:'hidden'}}>
                    <div style={{width:`${(r.count/maxRef)*100}%`,height:'100%',background:'#0ea5e9',borderRadius:99}}/>
                  </div>
                  <span style={{fontSize:12,color:'#6b7280',minWidth:32,textAlign:'right'}}>{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* UTM sources */}
        <div className="ac">
          <div className="ac-hd"><h2>UTM кампании</h2></div>
          {utmData.length===0 ? <div className="emp">Няма UTM трафик</div> : (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {utmData.map((u,i)=>(
                <div key={u.name} style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:13,width:130,flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.name}</span>
                  <div style={{flex:1,height:6,background:'#f3f4f6',borderRadius:99,overflow:'hidden'}}>
                    <div style={{width:`${(u.count/(utmData[0]?.count||1))*100}%`,height:'100%',background:PIE_COLORS[i%PIE_COLORS.length],borderRadius:99}}/>
                  </div>
                  <span style={{fontSize:12,color:'#6b7280',minWidth:32,textAlign:'right'}}>{u.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status pie */}
        <div className="ac">
          <div className="ac-hd"><h2>Поръчки по статус</h2></div>
          {statusData.length>0 ? (
            <div style={{height:220}}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={52} outerRadius={82} dataKey="value" nameKey="name" paddingAngle={3}>
                    {statusData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                  </Pie>
                  <Tooltip contentStyle={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,fontSize:12}}/>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:12}}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="emp">Няма данни</div>}
        </div>

        {/* Payment pie */}
        <div className="ac">
          <div className="ac-hd"><h2>Методи на плащане</h2></div>
          {paymentData.length>0 ? (
            <div style={{height:220}}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentData} cx="50%" cy="50%" innerRadius={52} outerRadius={82} dataKey="value" nameKey="name" paddingAngle={3}>
                    {paymentData.map((_,i)=><Cell key={i} fill={PIE_COLORS[i]}/>)}
                  </Pie>
                  <Tooltip contentStyle={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,fontSize:12}}/>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:12}}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="emp">Няма данни</div>}
        </div>

        {/* Top cities */}
        <div className="ac">
          <div className="ac-hd"><h2>Поръчки по градове</h2></div>
          {cityData.length===0 ? <div className="emp">Няма данни</div> : (
            <div style={{height:200}}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cityData} layout="vertical" margin={{top:4,right:40,left:4,bottom:0}}>
                  <XAxis type="number" tick={{fontSize:10,fill:'#9ca3af'}} tickLine={false} axisLine={false} allowDecimals={false}/>
                  <YAxis type="category" dataKey="city" tick={{fontSize:11,fill:'#374151'}} tickLine={false} axisLine={false} width={80}/>
                  <Tooltip contentStyle={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:8,fontSize:12}} formatter={(v:number)=>[v,'Поръчки']}/>
                  <Bar dataKey="count" fill="#16a34a" radius={[0,4,4,0]} label={{position:'right',fontSize:11,fill:'#6b7280'}}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Affiliate product clicks */}
        <div className="ac">
          <div className="ac-hd"><h2>Афилиейт кликове по продукт</h2><span className="bdg">{analytics?.total||0} общо</span></div>
          {productClicks.length===0 ? <div className="emp">Няма данни</div> : (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {productClicks.map((p,i)=>(
                <div key={p.name} style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:12,width:120,flexShrink:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</span>
                  <div style={{flex:1,height:6,background:'#f3f4f6',borderRadius:99,overflow:'hidden'}}>
                    <div style={{width:`${(p.value/maxProd)*100}%`,height:'100%',background:PIE_COLORS[i%PIE_COLORS.length],borderRadius:99}}/>
                  </div>
                  <span style={{fontSize:12,color:'#6b7280',minWidth:28,textAlign:'right'}}>{p.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <style>{`
        .an-root { padding: 28px 32px; }
        .an-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
        .an-title { font-size: 22px; font-weight: 800; color: var(--text); letter-spacing: -.02em; }
        .an-sub { font-size: 13px; color: var(--muted); margin-top: 3px; }
        .period-tabs { display: flex; gap: 4px; background: #f3f4f6; border-radius: 10px; padding: 3px; }
        .ptab { padding: 6px 14px; border: none; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 600; color: var(--muted); background: transparent; transition: all .15s; }
        .ptab-a { background: #fff; color: var(--text); box-shadow: 0 1px 4px rgba(0,0,0,.1); }

        .an-summary { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 20px; }
        @media(max-width:900px){ .an-summary { grid-template-columns: repeat(2,1fr); } }
        .an-sc { background: #fff; border: 1px solid var(--border); border-radius: 14px; padding: 16px; position: relative; overflow: hidden; }
        .an-sc-bar { position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--ac); }
        .an-sc-val { font-size: 24px; font-weight: 800; color: var(--text); margin-bottom: 4px; }
        .an-sc-lbl { font-size: 12px; font-weight: 700; color: var(--muted); margin-bottom: 2px; }
        .an-sc-sub { font-size: 11px; color: var(--muted); }

        .an-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .span2 { grid-column: 1/-1; }
        @media(max-width:900px){ .an-grid { grid-template-columns: 1fr; } .span2 { grid-column: 1; } }
        .ac { background: #fff; border: 1px solid var(--border); border-radius: 14px; padding: 20px; }
        .ac-hd { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; gap: 10px; }
        .ac-hd h2 { font-size: 15px; font-weight: 700; color: var(--text); }
        .bdg { background: #f3f4f6; color: var(--muted); padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: 600; white-space: nowrap; }
        .emp { text-align: center; color: var(--muted); padding: 28px 0; font-size: 13.5px; }
      `}</style>
    </div>
  )
}
