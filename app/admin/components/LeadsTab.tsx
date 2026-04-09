'use client'
// app/admin/components/LeadsTab.tsx — v6
// ✅ Systeme.io статус колона (synced / не е синхронизиран)
// ✅ Бутон "Sync всички → Systeme.io" (bulk)
// ✅ Бутон за sync по отделно на всеки lead
// ✅ Красив десктоп + мобилен изглед (карти)
// ✅ Филтър по Systeme.io статус
// ✅ Оптимистичен UI update след sync

import { useState, useMemo, useCallback, useEffect } from 'react'
import type { Lead } from '@/lib/supabase'
import { toast } from '@/components/ui/Toast'

const PAGE_SIZE = 25

const SLUG_EMOJI: Record<string, string> = {
  'super-domati':             '🍅',
  'krastavici-visoki-dobivy': '🥒',
  'chushki':                  '🫑',
}
const slugEmoji = (slug: string) => SLUG_EMOJI[slug] || '📗'
const slugLabel = (slug: string) => {
  if (slug.includes('domat'))     return 'Домати'
  if (slug.includes('krastavic')) return 'Краставици'
  if (slug.includes('chushk'))    return 'Чушки'
  return slug
}

interface Props { leads: Lead[] }
type SortKey    = 'created_at' | 'email' | 'name' | 'naruchnik_slug'
type SortDir    = 'asc' | 'desc'
type SyncFilter = 'all' | 'synced' | 'unsynced'

// ── Handbook bar ─────────────────────────────────────────────────────────────
function HandbookBar({ slug, count, max, total }: { slug: string; count: number; max: number; total: number }) {
  const pct   = max > 0 ? Math.round((count / max) * 100) : 0
  const share = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{slugEmoji(slug)} {slugLabel(slug)}</span>
        <span style={{ fontSize: 12, color: '#6b7280' }}><strong style={{ color: '#111' }}>{count}</strong> · {share}%</span>
      </div>
      <div style={{ height: 8, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#16a34a,#4ade80)', borderRadius: 99, transition: 'width .6s ease' }} />
      </div>
    </div>
  )
}

// ── Systeme.io dot ────────────────────────────────────────────────────────────
function SyncDot({ synced }: { synced: boolean }) {
  return (
    <span title={synced ? 'Синхронизиран в Systeme.io ✅' : 'Не е синхронизиран ⚠️'} style={{
      display: 'inline-block', width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
      background: synced ? '#22c55e' : '#f59e0b',
      boxShadow: synced ? '0 0 0 2px #dcfce7' : '0 0 0 2px #fef3c7',
    }} />
  )
}

export function LeadsTab({ leads }: Props) {
  const [search,        setSearch]        = useState('')
  const [filter,        setFilter]        = useState<'all' | 'subscribed' | 'unsubscribed'>('all')
  const [syncFilter,    setSyncFilter]    = useState<SyncFilter>('all')
  const [slugFilter,    setSlugFilter]    = useState('')
  const [multiFilter,   setMultiFilter]   = useState(false)
  const [selectedTag,   setSelectedTag]   = useState('')
  const [page,          setPage]          = useState(1)
  const [sortKey,       setSortKey]       = useState<SortKey>('created_at')
  const [sortDir,       setSortDir]       = useState<SortDir>('desc')
  const [expandedId,    setExpandedId]    = useState<string | null>(null)
  const [section,       setSection]       = useState<'list' | 'analytics'>('list')
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [bSubject,      setBSubject]      = useState('')
  const [bBody,         setBBody]         = useState('')
  const [bSending,      setBSending]      = useState(false)
  const [syncingId,     setSyncingId]     = useState<string | null>(null)
  const [bulkSyncing,   setBulkSyncing]   = useState(false)
  const [isMobile,      setIsMobile]      = useState(false)
  // Локален state за synced статуси (оптимистичен UI)
  const [syncedIds,     setSyncedIds]     = useState<Set<string>>(new Set())

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Инициализираме syncedIds от leads (ако има systemeio_synced поле)
  useEffect(() => {
    const ids = new Set<string>()
    leads.forEach(l => { if ((l as any).systemeio_synced) ids.add(l.id) })
    setSyncedIds(ids)
  }, [leads])

  // ── emailToSlugs ─────────────────────────────────────────────────────────
  const emailToSlugs = useMemo(() => {
    const map = new Map<string, Set<string>>()
    leads.forEach(l => {
      const slugs = new Set<string>()
      const arr = (l as any).naruchnici as string[] | null
      if (arr && arr.length > 0) arr.forEach((s: string) => slugs.add(s))
      else if (l.naruchnik_slug) slugs.add(l.naruchnik_slug)
      if (slugs.size > 0) map.set(l.email, slugs)
    })
    return map
  }, [leads])

  // ── Unique leads ──────────────────────────────────────────────────────────
  const uniqueLeads = useMemo(() => {
    const seen = new Map<string, Lead>()
    ;[...leads].reverse().forEach(l => seen.set(l.email, l))
    return Array.from(seen.values()).reverse()
  }, [leads])

  const allTags  = useMemo(() => { const s = new Set<string>(); uniqueLeads.forEach(l => (l.tags||[]).forEach(t => s.add(t))); return Array.from(s).sort() }, [uniqueLeads])
  const allSlugs = useMemo(() => { const s = new Set<string>(); leads.forEach(l => { const arr = (l as any).naruchnici as string[]|null; if (arr?.length) arr.forEach((sl:string)=>s.add(sl)); else if(l.naruchnik_slug) s.add(l.naruchnik_slug) }); return Array.from(s).sort() }, [leads])

  const slugCounts = useMemo(() => {
    const m: Record<string, number> = {}
    leads.forEach(l => {
      const arr = (l as any).naruchnici as string[]|null
      const slugs = (arr?.length) ? arr : (l.naruchnik_slug ? [l.naruchnik_slug] : [])
      slugs.forEach((s:string) => { m[s] = (m[s]||0)+1 })
    })
    return m
  }, [leads])

  const totalDownloads = Object.values(slugCounts).reduce((a,b)=>a+b,0)
  const maxSlugCount   = Math.max(...Object.values(slugCounts),1)

  const multiEmails = useMemo(() =>
    new Set(Array.from(emailToSlugs.entries()).filter(([,s])=>s.size>1).map(([e])=>e)),
    [emailToSlugs])

  const growthData = useMemo(() => {
    const counts = Array(30).fill(0)
    const now = Date.now()
    leads.forEach(l => {
      const ts = (l as any).downloaded_at || l.created_at
      const d = Math.floor((now - new Date(ts).getTime()) / 86400000)
      if (d >= 0 && d < 30) {
        const arr = (l as any).naruchnici as string[]|null
        counts[29-d] += (arr?.length || 1)
      }
    })
    return counts
  }, [leads])

  const todayCount = growthData[29]
  const weekCount  = growthData.slice(23).reduce((a,b)=>a+b,0)

  const utmData = useMemo(() => {
    const m: Record<string,number> = {}
    leads.forEach(l => { const src = l.utm_source||'organic'; m[src]=(m[src]||0)+1 })
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,6)
  }, [leads])

  const subscribed = useMemo(() => uniqueLeads.filter(l=>l.subscribed), [uniqueLeads])

  // Брой несинхронизирани
  const unsyncedCount = useMemo(() =>
    uniqueLeads.filter(l => !syncedIds.has(l.id) && !(l as any).systemeio_synced).length,
    [uniqueLeads, syncedIds])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return uniqueLeads
      .filter(l => filter==='all' ? true : filter==='subscribed' ? l.subscribed : !l.subscribed)
      .filter(l => {
        if (syncFilter === 'synced')   return syncedIds.has(l.id) || !!(l as any).systemeio_synced
        if (syncFilter === 'unsynced') return !syncedIds.has(l.id) && !(l as any).systemeio_synced
        return true
      })
      .filter(l => !selectedTag || (l.tags||[]).includes(selectedTag))
      .filter(l => !slugFilter  || (emailToSlugs.get(l.email)?.has(slugFilter)??false))
      .filter(l => !multiFilter || multiEmails.has(l.email))
      .filter(l => !q || l.email.toLowerCase().includes(q) || (l.name||'').toLowerCase().includes(q) || (l.phone||'').includes(q))
      .sort((a,b) => {
        const av=String(a[sortKey]??''), bv=String(b[sortKey]??'')
        return sortDir==='asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      })
  }, [uniqueLeads, filter, syncFilter, selectedTag, slugFilter, multiFilter, search, sortKey, sortDir, multiEmails, emailToSlugs, syncedIds])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE)

  const handleSort = (k: SortKey) => {
    if (sortKey===k) setSortDir(d=>d==='asc'?'desc':'asc')
    else { setSortKey(k); setSortDir('desc') }
    setPage(1)
  }

  const exportCSV = () => {
    const rows = [
      ['Имейл','Имена','Телефон','Наръчници','Статус','Systeme.io','Тагове','UTM Source','Дата'],
      ...filtered.map(l => [
        l.email, l.name||'', l.phone||'',
        Array.from(emailToSlugs.get(l.email)||[]).join(';'),
        l.subscribed?'Активен':'Отписан',
        syncedIds.has(l.id)||(l as any).systemeio_synced ? 'Синхронизиран' : 'Не',
        (l.tags||[]).join(';'), l.utm_source||'',
        new Date(l.created_at).toLocaleDateString('bg-BG'),
      ]),
    ]
    const csv  = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'})
    const a    = document.createElement('a')
    a.href=URL.createObjectURL(blob); a.download=`leads-${new Date().toISOString().slice(0,10)}.csv`; a.click()
    toast.success(`Изтеглени ${filtered.length} контакта`)
  }

  const copyEmails = () => {
    navigator.clipboard.writeText(subscribed.map(l=>l.email).join(', '))
    toast.success(`${subscribed.length} имейла копирани`)
  }

  const sendBroadcast = useCallback(async () => {
    if (!bSubject.trim()||!bBody.trim()) { toast.error('Попълни темата и съдържанието'); return }
    setBSending(true)
    try {
      const res  = await fetch('/api/leads/broadcast',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({subject:bSubject,body:bBody,tags:selectedTag?[selectedTag]:undefined})})
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`✓ Изпратено до ${data.sent} абоната`)
      setBroadcastOpen(false); setBSubject(''); setBBody('')
    } catch(e:any) { toast.error(e.message) }
    finally { setBSending(false) }
  }, [bSubject, bBody, selectedTag])

  const handleUnsubscribe = useCallback(async (id: string, email: string) => {
    if (!confirm(`Отпиши ${email}?`)) return
    try {
      const res = await fetch(`/api/leads/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscribed:false})})
      if (!res.ok) throw new Error('Грешка')
      toast.success(`${email} е отписан`)
    } catch { toast.error('Грешка при отписване') }
  }, [])

  // ── Sync един lead ────────────────────────────────────────────────────────
  // Използва /api/leads/sync (POST с ?id) — НЕ /api/leads, за да не тригерва
  // публичния rate limiter (5 req/10min)
  const handleSyncOne = useCallback(async (lead: Lead) => {
    if (syncedIds.has(lead.id) || (lead as any).systemeio_synced) return
    setSyncingId(lead.id)
    try {
      const res  = await fetch(`/api/leads/sync?id=${lead.id}`, { method: 'POST' })
      const data = await res.json()
      if (data.synced === 1 || data.success) {
        setSyncedIds(prev => new Set([...prev, lead.id]))
        toast.success(`✅ ${lead.email} → Systeme.io`)
      } else {
        toast.error(`❌ ${data.errors?.[0] || data.error || 'Грешка'}`)
      }
    } catch { toast.error('Мрежова грешка') }
    finally { setSyncingId(null) }
  }, [syncedIds])

  // ── Bulk sync ─────────────────────────────────────────────────────────────
  // Праща по 3 ID-та на сервъра — batch route обработва sequential с 1s пауза
  // = ~5-10 сек/chunk, безопасно под Vercel 30s timeout
  const handleBulkSync = useCallback(async (forceAll = false) => {
    const toSync = forceAll
      ? uniqueLeads.filter(l => l.subscribed)
      : uniqueLeads.filter(l => !syncedIds.has(l.id) && !(l as any).systemeio_synced && l.subscribed)

    if (toSync.length === 0) { toast.success('Всички са синхронизирани! ✅'); return }

    setBulkSyncing(true)
    let totalSynced = 0
    let totalFailed = 0

    try {
      const CHUNK = 3
      for (let i = 0; i < toSync.length; i += CHUNK) {
        const chunk = toSync.slice(i, i + CHUNK)
        try {
          const res  = await fetch('/api/leads/sync/batch', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ ids: chunk.map(l => l.id) }),
          })
          const data = await res.json()
          totalSynced += data.synced || 0
          totalFailed += data.failed || 0
          // Маркираме само реално синхронизираните като synced
          if (data.synced > 0) {
            setSyncedIds(prev => {
              const next = new Set(prev)
              // Маркираме само chunk-а — сървърът е обновил Supabase
              chunk.slice(0, data.synced).forEach(l => next.add(l.id))
              return next
            })
          }
        } catch { totalFailed += chunk.length }
        if (i + CHUNK < toSync.length) await new Promise(r => setTimeout(r, 2000))
      }
      // Показваме резултат и рефрешваме страницата за свежи данни
      if (totalFailed === 0) {
        toast.success(`✅ Синхронизирани ${totalSynced} контакта в Systeme.io!`)
      } else {
        toast.success(`✅ ${totalSynced} OK · ⚠️ ${totalFailed} грешки`)
      }
      // Рефрешваме за да вземем актуалните systemeio_synced стойности от DB
      if (totalSynced > 0) window.location.reload()
    } catch { toast.error('Мрежова грешка') }
    finally { setBulkSyncing(false) }
  }, [uniqueLeads, syncedIds])

  const inp: React.CSSProperties = { padding:'8px 13px', border:'1px solid var(--border)', borderRadius:9, fontFamily:'inherit', fontSize:13, outline:'none', background:'#fff' }
  const SortArrow = ({ k }: { k: SortKey }) => (
    <span style={{ marginLeft:3, fontSize:9, opacity:sortKey===k?1:.25 }}>{sortKey===k&&sortDir==='asc'?'▲':'▼'}</span>
  )

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: isMobile ? '16px' : '24px 28px' }}>
      <style>{`
        .lead-row { cursor:pointer; transition:background .1s }
        .lead-row:hover td { background:#f9fafb !important }
        .sync-btn { transition:all .15s; cursor:pointer; font-family:inherit; border:none }
        .sync-btn:hover { filter:brightness(.93) }
        .sync-btn:disabled { opacity:.5; cursor:not-allowed }
        @media(max-width:767px) { .desktop-only{display:none!important} }
        @media(min-width:768px) { .mobile-only{display:none!important} }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:18, gap:12, flexWrap:'wrap' }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:900, letterSpacing:'-.03em', margin:0, color:'var(--text)' }}>Email листа</h1>
          <p style={{ fontSize:13, color:'var(--muted)', marginTop:3 }}>
            {subscribed.length} активни · {uniqueLeads.length} уникални · {totalDownloads} изтегляния · {multiEmails.size} multi-DL
          </p>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={copyEmails} style={{ ...inp, cursor:'pointer' }}>📋 Копирай</button>
          <button onClick={exportCSV}  style={{ ...inp, cursor:'pointer' }}>↓ CSV</button>
          <button onClick={()=>setBroadcastOpen(true)}
            style={{ background:'#1b4332', color:'#fff', border:'none', borderRadius:9, padding:'8px 16px', cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:700 }}>
            ✉️ Broadcast
          </button>
        </div>
      </div>

      {/* ── Systeme.io sync banner ── */}
      {unsyncedCount > 0 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10,
          background:'linear-gradient(135deg,#fff7ed,#fef3c7)', border:'1px solid #fde68a', borderRadius:12,
          padding:'14px 18px', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:20 }}>🟠</span>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:'#92400e' }}>
                {unsyncedCount} контакта не са синхронизирани в Systeme.io
              </div>
              <div style={{ fontSize:12, color:'#b45309', marginTop:2 }}>
                Натисни бутона за да ги добавиш всички наведнъж
              </div>
            </div>
          </div>
          <button onClick={() => handleBulkSync()} disabled={bulkSyncing}
            style={{ background:bulkSyncing?'#d97706':'linear-gradient(135deg,#ea580c,#c2410c)',
              color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', cursor:bulkSyncing?'default':'pointer',
              fontFamily:'inherit', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:7,
              opacity:bulkSyncing?.7:1, boxShadow:'0 2px 8px rgba(194,65,12,.3)', whiteSpace:'nowrap' as const }}>
            {bulkSyncing
              ? <><span style={{ display:'inline-block', animation:'spin 1s linear infinite' }}>⏳</span> Синхронизира се...</>
              : <>🟠 Sync {unsyncedCount} → Systeme.io</>}
          </button>
        </div>
      )}

      {unsyncedCount === 0 && uniqueLeads.length > 0 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10,
          background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'10px 16px', marginBottom:16, fontSize:13, color:'#065f46' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span>✅</span>
            <span><strong>Всички контакти</strong> са синхронизирани в Systeme.io</span>
          </div>
          <button onClick={()=>handleBulkSync(true)} disabled={bulkSyncing}
            style={{ fontSize:12, padding:'5px 12px', borderRadius:7, border:'1px solid #86efac',
              background:'#fff', color:'#15803d', fontWeight:700, cursor:'pointer', fontFamily:'inherit',
              opacity:bulkSyncing?0.6:1 }}>
            {bulkSyncing ? '⏳ Ре-sync...' : '🔄 Ре-sync всички'}
          </button>
        </div>
      )}

      {/* ── Section tabs ── */}
      <div style={{ display:'flex', gap:6, marginBottom:20 }}>
        {(['list','analytics'] as const).map(s => (
          <button key={s} onClick={()=>setSection(s)}
            style={{ padding:'7px 18px', borderRadius:9, border:`1px solid ${section===s?'#2d6a4f':'var(--border)'}`,
              background:section===s?'#2d6a4f':'#fff', color:section===s?'#fff':'var(--muted)',
              cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600, transition:'all .15s' }}>
            {s==='list'?'📋 Листа':'📊 Аналитики'}
          </button>
        ))}
      </div>

      {/* ══════════════ ANALYTICS ══════════════ */}
      {section==='analytics' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:16 }}>
          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, padding:'20px 22px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:18 }}>📗 Изтегляния по наръчник</div>
            {Object.entries(slugCounts).sort((a,b)=>b[1]-a[1]).map(([slug,count])=>(
              <HandbookBar key={slug} slug={slug} count={count} max={maxSlugCount} total={totalDownloads} />
            ))}
            {!Object.keys(slugCounts).length&&<p style={{color:'#9ca3af',fontSize:13}}>Няма данни</p>}
            <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid #f3f4f6', display:'flex', justifyContent:'space-between', fontSize:12, color:'#9ca3af' }}>
              <span>Общо изтегляния</span><strong style={{color:'#111'}}>{totalDownloads}</strong>
            </div>
          </div>

          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, padding:'20px 22px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>📈 Нови абонати (30 дни)</div>
            <div style={{ display:'flex', gap:20, marginBottom:16 }}>
              <div><div style={{fontSize:28,fontWeight:900,color:'#111',letterSpacing:'-.03em'}}>{weekCount}</div><div style={{fontSize:11,color:'#6b7280'}}>тази седмица</div></div>
              <div><div style={{fontSize:28,fontWeight:900,color:'#16a34a',letterSpacing:'-.03em'}}>{todayCount}</div><div style={{fontSize:11,color:'#6b7280'}}>днес</div></div>
            </div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:2, height:64 }}>
              {growthData.map((v,i)=>{
                const maxV=Math.max(...growthData,1), h=Math.max(2,Math.round((v/maxV)*60)), today=i===29
                return <div key={i} title={`${v} lead${v!==1?'s':''}`}
                  style={{flex:1,height:h,background:today?'#16a34a':v>0?'#86efac':'#f3f4f6',borderRadius:'3px 3px 0 0',alignSelf:'flex-end'}} />
              })}
            </div>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'#d1d5db',marginTop:4}}><span>30 дни назад</span><span>Днес</span></div>
          </div>

          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, padding:'20px 22px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:12 }}>🔥 Изтеглили повече от 1 наръчник</div>
            <div style={{ fontSize:42, fontWeight:900, color:'#f59e0b', letterSpacing:'-.03em', marginBottom:4 }}>{multiEmails.size}</div>
            <div style={{ fontSize:13, color:'#6b7280', marginBottom:16 }}>от {uniqueLeads.length} уникални ({uniqueLeads.length?Math.round(multiEmails.size/uniqueLeads.length*100):0}%)</div>
            <button onClick={()=>{setMultiFilter(true);setSection('list');setPage(1)}}
              style={{fontSize:12,padding:'7px 14px',background:'#fef3c7',color:'#92400e',border:'1px solid #fde68a',borderRadius:8,cursor:'pointer',fontFamily:'inherit',fontWeight:700}}>
              Виж тези контакти →
            </button>
          </div>

          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, padding:'20px 22px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:14 }}>🔗 Трафик източници</div>
            {utmData.map(([src,count])=>{
              const pct=leads.length?Math.round(count/leads.length*100):0
              return (
                <div key={src} style={{marginBottom:10}}>
                  <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
                    <span style={{fontWeight:600,color:'#374151'}}>{src}</span>
                    <span style={{color:'#6b7280'}}>{count} · {pct}%</span>
                  </div>
                  <div style={{height:6,background:'#f3f4f6',borderRadius:99}}>
                    <div style={{height:'100%',width:`${pct}%`,background:'#818cf8',borderRadius:99}} />
                  </div>
                </div>
              )
            })}
            {!utmData.length&&<p style={{color:'#9ca3af',fontSize:13}}>Няма UTM данни</p>}
          </div>
        </div>
      )}

      {/* ══════════════ LIST ══════════════ */}
      {section==='list' && (
        <>
          {/* Stat cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:10, marginBottom:16 }}>
            {[
              { label:'Уникални',    v:uniqueLeads.length,                          col:'#374151', bg:'#f9fafb' },
              { label:'Активни',     v:subscribed.length,                            col:'#16a34a', bg:'#f0fdf4' },
              { label:'Отписани',    v:uniqueLeads.filter(l=>!l.subscribed).length,  col:'#ef4444', bg:'#fef2f2' },
              { label:'🟠 Unsynced', v:unsyncedCount,                                col:'#ea580c', bg:'#fff7ed', click:()=>{setSyncFilter('unsynced');setPage(1)} },
              { label:'🔥 Multi-DL', v:multiEmails.size,                             col:'#8b5cf6', bg:'#faf5ff', click:()=>{setMultiFilter(!multiFilter);setPage(1)} },
              { label:'Днес',        v:todayCount,                                   col:'#0ea5e9', bg:'#f0f9ff' },
            ].map(c=>(
              <div key={c.label} onClick={(c as any).click} style={{ background:c.bg, border:`1px solid ${c.col}22`, borderRadius:12, padding:'13px 15px', cursor:(c as any).click?'pointer':'default' }}>
                <div style={{ fontSize:24, fontWeight:900, color:c.col, letterSpacing:'-.03em' }}>{c.v}</div>
                <div style={{ fontSize:11, color:'#6b7280', fontWeight:600, marginTop:2 }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap', alignItems:'center' }}>
            <input placeholder="🔍 Имейл, имена, телефон..." value={search}
              onChange={e=>{setSearch(e.target.value);setPage(1)}}
              style={{ ...inp, width: isMobile ? '100%' : 240 }}
              onFocus={e=>e.target.style.borderColor='#2d6a4f'}
              onBlur={e=>e.target.style.borderColor='var(--border)'} />

            {/* Subscribed filter */}
            {(['all','subscribed','unsubscribed'] as const).map(f=>(
              <button key={f} onClick={()=>{setFilter(f);setPage(1)}}
                style={{ padding:'6px 13px', borderRadius:99, border:`1px solid ${filter===f?'#2d6a4f':'var(--border)'}`,
                  background:filter===f?'#2d6a4f':'#fff', color:filter===f?'#fff':'var(--muted)',
                  cursor:'pointer', fontFamily:'inherit', fontSize:12, fontWeight:600 }}>
                {f==='all'?'Всички':f==='subscribed'?'✓ Активни':'✗ Отписани'}
              </button>
            ))}

            {/* Systeme.io sync filter */}
            <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:99, overflow:'hidden' }}>
              {([['all','Всички'],['synced','✅ Sync'],['unsynced','🟠 Unsync']] as [SyncFilter,string][]).map(([f,label])=>(
                <button key={f} onClick={()=>{setSyncFilter(f);setPage(1)}}
                  style={{ padding:'6px 11px', border:'none', background:syncFilter===f?'#ea580c':'transparent',
                    color:syncFilter===f?'#fff':'var(--muted)', cursor:'pointer', fontFamily:'inherit', fontSize:11, fontWeight:700 }}>
                  {label}
                </button>
              ))}
            </div>

            {allSlugs.length>1 && (
              <select value={slugFilter} onChange={e=>{setSlugFilter(e.target.value);setPage(1)}} style={{...inp,cursor:'pointer'}}>
                <option value="">Всички наръчници</option>
                {allSlugs.map(s=><option key={s} value={s}>{slugEmoji(s)} {slugLabel(s)}</option>)}
              </select>
            )}
            {allTags.length>0 && (
              <select value={selectedTag} onChange={e=>{setSelectedTag(e.target.value);setPage(1)}} style={{...inp,cursor:'pointer'}}>
                <option value="">Всички тагове</option>
                {allTags.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {multiFilter && (
              <button onClick={()=>{setMultiFilter(false);setPage(1)}}
                style={{padding:'6px 12px',borderRadius:99,border:'1px solid #f59e0b',background:'#fef3c7',color:'#92400e',cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:700}}>
                🔥 Multi-DL ✕
              </button>
            )}
            {(search||filter!=='all'||syncFilter!=='all'||slugFilter||selectedTag||multiFilter) && (
              <button onClick={()=>{setSearch('');setFilter('all');setSyncFilter('all');setSlugFilter('');setSelectedTag('');setMultiFilter(false);setPage(1)}}
                style={{fontSize:12,color:'#2d6a4f',background:'none',border:'none',cursor:'pointer',fontWeight:700,textDecoration:'underline',padding:0}}>
                Изчисти
              </button>
            )}
          </div>
          <div style={{ fontSize:12, color:'#9ca3af', marginBottom:10 }}>Показани: {filtered.length} контакта</div>

          {/* ══ MOBILE CARDS ══ */}
          <div className="mobile-only">
            {paginated.length===0 && (
              <div style={{textAlign:'center',color:'var(--muted)',padding:48,fontSize:14}}>
                <div style={{fontSize:32,marginBottom:8}}>🔍</div>Няма резултати
              </div>
            )}
            {paginated.map(l=>{
              const slugs   = Array.from(emailToSlugs.get(l.email)||(l.naruchnik_slug?[l.naruchnik_slug]:[]))
              const isMulti = slugs.length>1
              const isSynced = syncedIds.has(l.id)||(l as any).systemeio_synced
              const syncing  = syncingId===l.id
              return (
                <div key={l.id} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:14, padding:'14px 16px', marginBottom:10, boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
                  {/* Row 1: email + sync dot */}
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
                      <div style={{ width:34, height:34, borderRadius:'50%', background:isMulti?'linear-gradient(135deg,#f59e0b,#ef4444)':'#dcfce7',
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:900,
                        color:isMulti?'#fff':'#15803d', flexShrink:0 }}>
                        {(l.name||l.email)[0].toUpperCase()}
                      </div>
                      <div style={{ minWidth:0 }}>
                        <a href={`mailto:${l.email}`} style={{ color:'#2d6a4f', fontWeight:700, textDecoration:'none', fontSize:13, display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.email}</a>
                        {l.name && <div style={{fontSize:11,color:'#6b7280'}}>{l.name}</div>}
                      </div>
                    </div>
                    <SyncDot synced={isSynced} />
                  </div>

                  {/* Row 2: slugs + status */}
                  <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:10, alignItems:'center' }}>
                    {slugs.map(s=>(
                      <span key={s} style={{fontSize:10,padding:'2px 8px',background:'#f0fdf4',color:'#15803d',border:'1px solid #bbf7d0',borderRadius:99,fontWeight:700}}>
                        {slugEmoji(s)} {slugLabel(s)}
                      </span>
                    ))}
                    {isMulti && <span style={{fontSize:10,padding:'2px 7px',background:'#fef3c7',color:'#92400e',border:'1px solid #fde68a',borderRadius:99,fontWeight:800}}>🔥 Multi</span>}
                    <span style={{fontSize:10,padding:'2px 8px',borderRadius:99,fontWeight:700,background:l.subscribed?'#d1fae5':'#fee2e2',color:l.subscribed?'#065f46':'#991b1b'}}>
                      {l.subscribed?'✓ Активен':'✗ Отписан'}
                    </span>
                    <span style={{fontSize:10,padding:'2px 8px',borderRadius:99,fontWeight:700,background:isSynced?'#dcfce7':'#fff7ed',color:isSynced?'#15803d':'#ea580c',border:`1px solid ${isSynced?'#86efac':'#fed7aa'}`}}>
                      {isSynced?'✅ Synced':'🟠 Unsynced'}
                    </span>
                  </div>

                  {/* Row 3: actions */}
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                    <button onClick={()=>handleSyncOne(l)} disabled={syncing||isSynced}
                      className="sync-btn"
                      style={{ fontSize:11, padding:'5px 11px', background:isSynced?'#f0fdf4':'#fff7ed', color:isSynced?'#15803d':'#ea580c',
                        border:`1px solid ${isSynced?'#86efac':'#fed7aa'}`, borderRadius:7, opacity:(syncing||isSynced)?.5:1 }}>
                      {syncing?'⏳...':isSynced?'✅ Synced':'🟠 Sync'}
                    </button>
                    <a href={`mailto:${l.email}`}
                      style={{fontSize:11,padding:'5px 11px',background:'#f0fdf4',color:'#2d6a4f',border:'1px solid #bbf7d0',borderRadius:7,textDecoration:'none',fontWeight:600}}>
                      ✉️ Пиши
                    </a>
                    {l.phone && <a href={`tel:${l.phone}`} style={{fontSize:11,padding:'5px 11px',background:'#f0f9ff',color:'#0369a1',border:'1px solid #bae6fd',borderRadius:7,textDecoration:'none',fontWeight:600}}>📞</a>}
                    <span style={{fontSize:10,color:'#9ca3af',padding:'5px 0',alignSelf:'center'}}>{new Date(l.created_at).toLocaleDateString('bg-BG',{day:'2-digit',month:'short'})}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ══ DESKTOP TABLE ══ */}
          <div className="desktop-only" style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:700 }}>
                <thead>
                  <tr style={{ background:'#f9fafb' }}>
                    {([
                      { label:'Имейл / Имена',  key:'email'          as SortKey },
                      { label:'Наръчници',       key:'naruchnik_slug' as SortKey },
                      { label:'Статус',           key:null },
                      { label:'Systeme.io',       key:null },
                      { label:'Дата',             key:'created_at'    as SortKey },
                      { label:'',                 key:null },
                    ] as {label:string;key:SortKey|null}[]).map(({label,key})=>(
                      <th key={label} onClick={()=>key&&handleSort(key)}
                        style={{ padding:'11px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'var(--muted)',
                          textTransform:'uppercase', letterSpacing:'.05em', borderBottom:'1px solid var(--border)',
                          whiteSpace:'nowrap', cursor:key?'pointer':'default', userSelect:'none',
                          background:'#f9fafb' }}>
                        {label}{key&&<SortArrow k={key} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length===0 && (
                    <tr><td colSpan={6} style={{textAlign:'center',color:'var(--muted)',padding:48}}>
                      <div style={{fontSize:32,marginBottom:8}}>🔍</div>Няма резултати
                    </td></tr>
                  )}
                  {paginated.map(l=>{
                    const slugs    = Array.from(emailToSlugs.get(l.email)||(l.naruchnik_slug?[l.naruchnik_slug]:[]))
                    const isMulti  = slugs.length>1
                    const expanded = expandedId===l.id
                    const isSynced = syncedIds.has(l.id)||(l as any).systemeio_synced
                    const syncing  = syncingId===l.id

                    return (
                      <>
                        <tr key={l.id} className="lead-row"
                          onClick={()=>setExpandedId(expanded?null:l.id)}
                          style={{ background:expanded?'#f0fdf4':'' }}>

                          {/* Email + name */}
                          <td style={{ padding:'11px 14px', borderBottom:'1px solid #f5f5f5' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                              <div style={{ width:32, height:32, borderRadius:'50%', background:isMulti?'linear-gradient(135deg,#f59e0b,#ef4444)':'#dcfce7',
                                display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:900,
                                color:isMulti?'#fff':'#15803d', flexShrink:0 }}>
                                {(l.name||l.email)[0].toUpperCase()}
                              </div>
                              <div>
                                <a href={`mailto:${l.email}`} onClick={e=>e.stopPropagation()} style={{color:'#2d6a4f',fontWeight:700,textDecoration:'none',fontSize:13}}>{l.email}</a>
                                {l.name  && <div style={{fontSize:11,color:'#6b7280',marginTop:1}}>{l.name}</div>}
                                {l.phone && <div style={{fontSize:11,color:'#9ca3af'}}>📞 {l.phone}</div>}
                              </div>
                            </div>
                          </td>

                          {/* Slugs */}
                          <td style={{ padding:'11px 14px', borderBottom:'1px solid #f5f5f5' }}>
                            <div style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center' }}>
                              {slugs.map(slug=>(
                                <span key={slug} style={{fontSize:11,padding:'3px 9px',background:'#f0fdf4',color:'#15803d',border:'1px solid #bbf7d0',borderRadius:99,fontWeight:700,whiteSpace:'nowrap'}}>
                                  {slugEmoji(slug)} {slugLabel(slug)}
                                </span>
                              ))}
                              {isMulti && <span style={{fontSize:10,padding:'2px 7px',background:'#fef3c7',color:'#92400e',border:'1px solid #fde68a',borderRadius:99,fontWeight:800}}>🔥 Multi</span>}
                            </div>
                          </td>

                          {/* Status */}
                          <td style={{ padding:'11px 14px', borderBottom:'1px solid #f5f5f5' }}>
                            <span style={{fontSize:11,padding:'3px 9px',borderRadius:99,fontWeight:700,background:l.subscribed?'#d1fae5':'#fee2e2',color:l.subscribed?'#065f46':'#991b1b'}}>
                              {l.subscribed?'✓ Активен':'✗ Отписан'}
                            </span>
                          </td>

                          {/* Systeme.io status */}
                          <td style={{ padding:'11px 14px', borderBottom:'1px solid #f5f5f5', textAlign:'center' }} onClick={e=>e.stopPropagation()}>
                            <button onClick={()=>handleSyncOne(l)} disabled={syncing||isSynced}
                              className="sync-btn"
                              title={isSynced?'Синхронизиран ✅':'Натисни за sync'}
                              style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, padding:'4px 10px',
                                borderRadius:7, fontWeight:700,
                                background:isSynced?'#f0fdf4':'#fff7ed',
                                color:isSynced?'#15803d':'#ea580c',
                                border:`1px solid ${isSynced?'#86efac':'#fed7aa'}`,
                                opacity:(syncing||isSynced)&&!syncing?.7:1,
                                cursor:isSynced?'default':'pointer' }}>
                              <SyncDot synced={isSynced} />
                              {syncing?'⏳...':isSynced?'Synced':'Sync →'}
                            </button>
                          </td>

                          {/* Date */}
                          <td style={{ padding:'11px 14px', borderBottom:'1px solid #f5f5f5', fontSize:12, color:'#9ca3af', whiteSpace:'nowrap' }}>
                            {new Date(l.created_at).toLocaleDateString('bg-BG',{day:'2-digit',month:'short',year:'2-digit'})}
                            {l.utm_source&&<div style={{fontSize:10,marginTop:2,color:'#c4b5fd'}}>via {l.utm_source}</div>}
                          </td>

                          {/* Expand arrow */}
                          <td style={{ padding:'11px 10px', borderBottom:'1px solid #f5f5f5', color:'#d1d5db', fontSize:11 }}>
                            {expanded?'▲':'▼'}
                          </td>
                        </tr>

                        {/* Expanded row */}
                        {expanded && (
                          <tr key={`${l.id}-exp`}>
                            <td colSpan={6} style={{ padding:'10px 14px 14px 56px', background:'#f0fdf4', borderBottom:'1px solid #bbf7d0' }}>
                              <div style={{ display:'flex', gap:16, fontSize:12, color:'#374151', flexWrap:'wrap', alignItems:'center' }}>
                                <span><span style={{color:'#9ca3af',fontWeight:600}}>ID: </span><code style={{fontSize:11}}>{l.id}</code></span>
                                {l.source        && <span><span style={{color:'#9ca3af',fontWeight:600}}>Източник: </span>{l.source}</span>}
                                {l.utm_source    && <span><span style={{color:'#9ca3af',fontWeight:600}}>UTM: </span>{l.utm_source}{l.utm_campaign?` / ${l.utm_campaign}`:''}</span>}
                                {l.downloaded_at && <span><span style={{color:'#9ca3af',fontWeight:600}}>Изтеглено: </span>{new Date(l.downloaded_at).toLocaleString('bg-BG')}</span>}
                                {l.last_email_sent_at && <span><span style={{color:'#9ca3af',fontWeight:600}}>Посл. имейл: </span>{new Date(l.last_email_sent_at).toLocaleString('bg-BG')}</span>}
                                {(l.tags||[]).length>0 && (
                                  <div style={{display:'flex',gap:3}}>
                                    {(l.tags||[]).map(tag=>(
                                      <span key={tag} style={{fontSize:10,padding:'1px 6px',background:'#ede9fe',color:'#5b21b6',borderRadius:99,fontWeight:700}}>{tag}</span>
                                    ))}
                                  </div>
                                )}
                                <a href={`mailto:${l.email}`} onClick={e=>e.stopPropagation()}
                                  style={{fontSize:12,color:'#2d6a4f',fontWeight:700,textDecoration:'none',padding:'4px 12px',background:'#fff',border:'1px solid #bbf7d0',borderRadius:7}}>
                                  ✉️ Пиши
                                </a>
                                {!isSynced && (
                                  <button onClick={e=>{e.stopPropagation();handleSyncOne(l)}} disabled={syncing}
                                    style={{fontSize:12,color:'#c2410c',fontWeight:700,padding:'4px 12px',background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:7,cursor:'pointer',fontFamily:'inherit',opacity:syncing?.5:1}}>
                                    {syncing?'⏳ Syncing...':'🟠 Sync → Systeme.io'}
                                  </button>
                                )}
                                {l.subscribed && (
                                  <button onClick={e=>{e.stopPropagation();handleUnsubscribe(l.id,l.email)}}
                                    style={{fontSize:12,color:'#b91c1c',fontWeight:700,padding:'4px 12px',background:'#fff1f2',border:'1px solid #fca5a5',borderRadius:7,cursor:'pointer',fontFamily:'inherit'}}>
                                    ✋ Отпиши
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages>1 && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:16, flexWrap:'wrap' }}>
              <button disabled={page===1}          onClick={()=>setPage(1)}          style={{...inp,cursor:'pointer',padding:'6px 11px'}}>«</button>
              <button disabled={page===1}          onClick={()=>setPage(p=>p-1)}     style={{...inp,cursor:'pointer',padding:'6px 14px'}}>← Назад</button>
              <span style={{fontSize:13,color:'var(--muted)',padding:'0 6px'}}>{page} / {totalPages}</span>
              <button disabled={page===totalPages} onClick={()=>setPage(p=>p+1)}     style={{...inp,cursor:'pointer',padding:'6px 14px'}}>Напред →</button>
              <button disabled={page===totalPages} onClick={()=>setPage(totalPages)} style={{...inp,cursor:'pointer',padding:'6px 11px'}}>»</button>
            </div>
          )}
        </>
      )}

      {/* ── Broadcast modal ── */}
      {broadcastOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, zIndex:200 }}>
          <div style={{ background:'#fff', borderRadius:20, padding:28, width:'100%', maxWidth:560, boxShadow:'0 24px 60px rgba(0,0,0,.3)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:18, fontWeight:900, margin:0, letterSpacing:'-.02em' }}>✉️ Broadcast имейл</h2>
              <button onClick={()=>setBroadcastOpen(false)} style={{ background:'#f5f5f5', border:'none', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:14 }}>✕</button>
            </div>
            <div style={{ background:'#fef3c7', border:'1px solid #fde68a', borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#92400e' }}>
              ⚠️ До <strong>{selectedTag?filtered.filter(l=>l.subscribed).length:subscribed.length}</strong> активни абоната.
              {selectedTag&&` (таг: ${selectedTag})`} Използвай <code>{'{{name}}'}</code> за персонализация.
            </div>
            <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:4 }}>Тема</label>
            <input value={bSubject} onChange={e=>setBSubject(e.target.value)} placeholder="Тема на имейла..."
              style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #e5e7eb', borderRadius:9, fontFamily:'inherit', fontSize:14, outline:'none', marginBottom:14, boxSizing:'border-box' as const }}
              onFocus={e=>e.target.style.borderColor='#2d6a4f'} onBlur={e=>e.target.style.borderColor='#e5e7eb'} />
            <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:4 }}>Съдържание</label>
            <textarea value={bBody} onChange={e=>setBBody(e.target.value)} rows={8} placeholder={'Здравей, {{name}}!\n\nСъдържание...'}
              style={{ width:'100%', padding:'10px 14px', border:'1.5px solid #e5e7eb', borderRadius:9, fontFamily:'monospace', fontSize:13, outline:'none', resize:'vertical', boxSizing:'border-box' as const, marginBottom:16 }}
              onFocus={e=>e.target.style.borderColor='#2d6a4f'} onBlur={e=>e.target.style.borderColor='#e5e7eb'} />
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={()=>setBroadcastOpen(false)} style={{padding:'10px 20px',border:'1px solid var(--border)',borderRadius:10,background:'#fff',cursor:'pointer',fontFamily:'inherit',fontSize:14}}>Отказ</button>
              <button onClick={sendBroadcast} disabled={bSending}
                style={{padding:'10px 24px',background:'#1b4332',color:'#fff',border:'none',borderRadius:10,cursor:'pointer',fontFamily:'inherit',fontSize:14,fontWeight:700,opacity:bSending?.6:1}}>
                {bSending?'⏳ Изпраща...':'✉️ Изпрати'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
