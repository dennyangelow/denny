'use client'
// app/admin/components/LeadsTab.tsx — v7
// КРИТИЧНИ ПОПРАВКИ:
//   1. handleBulkSync: използва syncedIds[] от response (не брой!)
//   2. handleSyncOne: правилно обработва success/invalidEmail
//   3. "Ре-sync всички" бутон е ВИНАГИ видим (не само когато всичко е synced)
//   4. Прогрес показва реален брой (X/Y синхронизирани)

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
  const [bulkProgress,  setBulkProgress]  = useState({ done: 0, total: 0 })
  const [resettingInvalid, setResettingInvalid] = useState(false)
  const [isMobile,      setIsMobile]      = useState(false)
  // Локален state за synced статуси (оптимистичен UI)
  const [syncedIds,     setSyncedIds]     = useState<Set<string>>(new Set())
  // Невалидни имейли (за да не се опитваме пак)
  const [invalidIds,    setInvalidIds]    = useState<Set<string>>(new Set())

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Инициализираме syncedIds от leads
  useEffect(() => {
    const synced  = new Set<string>()
    const invalid = new Set<string>()
    leads.forEach(l => {
      if ((l as any).systemeio_synced)        synced.add(l.id)
      if ((l as any).systemeio_email_invalid) invalid.add(l.id)
    })
    setSyncedIds(synced)
    setInvalidIds(invalid)
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

  // Брой несинхронизирани (без невалидните имейли)
  const unsyncedCount = useMemo(() =>
    uniqueLeads.filter(l =>
      !syncedIds.has(l.id) &&
      !(l as any).systemeio_synced &&
      !invalidIds.has(l.id) &&
      !(l as any).systemeio_email_invalid &&
      l.subscribed
    ).length,
    [uniqueLeads, syncedIds, invalidIds])

  // Брой невалидни имейли (за banner-а)
  const invalidCount = useMemo(() =>
    uniqueLeads.filter(l => invalidIds.has(l.id) || !!(l as any).systemeio_email_invalid).length,
    [uniqueLeads, invalidIds])

  // Прогрес процент за sync progress bar
  const progressPct = bulkProgress.total > 0
    ? Math.round((bulkProgress.done / bulkProgress.total) * 100)
    : 0

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


  // ── Ресет на невалидни имейли ─────────────────────────────────────────────
  // Ресетва systemeio_email_invalid=false в Supabase за да може да се sync-не пак
  const handleResetInvalid = useCallback(async (ids?: string[]) => {
    setResettingInvalid(true)
    try {
      const res  = await fetch('/api/leads/sync/reset-invalid', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(ids ? { ids } : {}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Грешка')
      // Ресетваме локалния state
      if (ids) { setInvalidIds(prev => { const next = new Set(prev); ids.forEach(id=>next.delete(id)); return next }) }
      else { setInvalidIds(new Set()) }
      toast.success(`✅ ${data.reset ?? ids?.length ?? '?'} контакта ресетнати — sync-ни пак`)
      // Рефрешваме страницата за да се опреснят leads данните (unsyncedCount, banner)
      setTimeout(() => window.location.reload(), 1200)
    } catch(e:any) { toast.error(`❌ ${e.message}`) }
    finally { setResettingInvalid(false) }
  }, [])

  // ── Sync един lead ────────────────────────────────────────────────────────
  const handleSyncOne = useCallback(async (lead: Lead) => {
    const alreadySynced = syncedIds.has(lead.id) || !!(lead as any).systemeio_synced
    if (alreadySynced) return
    setSyncingId(lead.id)
    try {
      const res  = await fetch(`/api/leads/sync?id=${lead.id}`, { method: 'POST' })
      const data = await res.json()

      // Успех: synced=1 или success=true (включително невалиден имейл — пропускаме тихо)
      if (data.synced === 1) {
        setSyncedIds(prev => new Set([...prev, lead.id]))
        toast.success(`✅ ${lead.email} → Systeme.io`)
      } else if (data.invalidEmail) {
        setInvalidIds(prev => new Set([...prev, lead.id]))
        toast.error(`⚠️ ${lead.email} — невалиден имейл, пропуснат`)
      } else if (data.success === false && data.message) {
        toast.error(`❌ ${data.message}`)
      } else {
        const errMsg = data.errors?.[0] || data.error || 'Неизвестна грешка'
        toast.error(`❌ ${errMsg}`)
      }
    } catch { toast.error('Мрежова грешка') }
    finally { setSyncingId(null) }
  }, [syncedIds])

  // ── Bulk sync ─────────────────────────────────────────────────────────────
  // ПОПРАВЕНО: използва syncedIds[] от response — не брой!
  const handleBulkSync = useCallback(async (forceAll = false) => {
    const toSync = forceAll
      ? uniqueLeads.filter(l => l.subscribed && !invalidIds.has(l.id) && !(l as any).systemeio_email_invalid)
      : uniqueLeads.filter(l =>
          !syncedIds.has(l.id) &&
          !(l as any).systemeio_synced &&
          !invalidIds.has(l.id) &&
          !(l as any).systemeio_email_invalid &&
          l.subscribed
        )

    if (toSync.length === 0) { toast.success('Всички са синхронизирани! ✅'); return }

    setBulkSyncing(true)
    setBulkProgress({ done: 0, total: toSync.length })
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

          if (!res.ok) {
            console.error('[bulk] Batch error:', data.error)
            totalFailed += chunk.length
          } else {
            totalSynced += data.synced || 0
            totalFailed += data.failed || 0

            // ✅ ПОПРАВЕНО: използваме точните syncedIds от сървъра
            if (data.syncedIds?.length > 0) {
              setSyncedIds(prev => {
                const next = new Set(prev)
                data.syncedIds.forEach((id: string) => next.add(id))
                return next
              })
            }

            // Маркираме невалидните имейли
            if (data.invalidIds?.length > 0) {
              setInvalidIds(prev => {
                const next = new Set(prev)
                data.invalidIds.forEach((id: string) => next.add(id))
                return next
              })
            }

            setBulkProgress(p => ({ ...p, done: p.done + (data.synced || 0) + (data.invalid || 0) }))
          }
        } catch (err) {
          console.error('[bulk] Chunk error:', err)
          totalFailed += chunk.length
        }

        // Пауза между chunk-овете (само ако има следващ)
        if (i + CHUNK < toSync.length) await new Promise(r => setTimeout(r, 2000))
      }

      if (totalFailed === 0) {
        toast.success(`✅ Синхронизирани ${totalSynced} контакта в Systeme.io!`)
      } else if (totalSynced > 0) {
        toast.success(`✅ ${totalSynced} OK · ⚠️ ${totalFailed} грешки`)
      } else {
        toast.error(`❌ Всички ${totalFailed} контакта се провалиха — провери Vercel logs`)
      }

      // Рефрешваме само ако е имало успешни sync-ове
      if (totalSynced > 0) {
        setTimeout(() => window.location.reload(), 1500)
      }
    } catch { toast.error('Мрежова грешка') }
    finally {
      setBulkSyncing(false)
      setBulkProgress({ done: 0, total: 0 })
    }
  }, [uniqueLeads, syncedIds, invalidIds])

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


      {/* ── Невалидни имейли banner ── */}
      {invalidCount > 0 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10,
          background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:12,
          padding:'12px 16px', marginBottom:12 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span>⚠️</span>
            <div>
              <strong style={{ color:'#991b1b', fontSize:13 }}>{invalidCount} контакта с &quot;Невалиден&quot; статус</strong>
              <div style={{ fontSize:12, color:'#b91c1c', marginTop:2 }}>Маркирани погрешно? Ресетни ги и sync-ни пак.</div>
            </div>
          </div>
          <button onClick={() => handleResetInvalid()} disabled={resettingInvalid}
            style={{ fontSize:12, padding:'8px 14px', borderRadius:8, border:'1px solid #fca5a5', background:'#fff', color:'#991b1b', fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity:resettingInvalid?0.6:1, whiteSpace:'nowrap' as const }}>
            {resettingInvalid ? '⏳ Ресетва...' : '🔄 Ресетни всички невалидни'}
          </button>
        </div>
      )}

      {/* ── Systeme.io sync banner / progress ── */}
      {bulkSyncing ? (
        <div style={{ background:'linear-gradient(135deg,#eff6ff,#dbeafe)', border:'1px solid #93c5fd', borderRadius:12, padding:'14px 18px', marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:13, color:'#1e40af', fontWeight:700 }}>
            <span>⏳ Синхронизиране...</span>
            <span>{bulkProgress.done} / {bulkProgress.total} ({progressPct}%)</span>
          </div>
          <div style={{ height:10, background:'rgba(147,197,253,0.3)', borderRadius:99, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${progressPct}%`, background:'linear-gradient(90deg,#3b82f6,#2563eb)', borderRadius:99, transition:'width 0.4s ease' }} />
          </div>
          <div style={{ fontSize:11, color:'#3b82f6', marginTop:6, textAlign:'center' }}>По 3 контакта наведнъж — страницата ще се опресни след края</div>
        </div>
      ) : unsyncedCount > 0 ? (
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
                {bulkSyncing && bulkProgress.total > 0
                  ? `⏳ ${bulkProgress.done} / ${bulkProgress.total} синхронизирани...`
                  : 'Натисни бутона за да ги добавиш всички наведнъж'
                }
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button onClick={() => handleBulkSync(false)} disabled={bulkSyncing}
              style={{ background:bulkSyncing?'#d97706':'linear-gradient(135deg,#ea580c,#c2410c)',
                color:'#fff', border:'none', borderRadius:9, padding:'10px 18px', cursor:bulkSyncing?'default':'pointer',
                fontFamily:'inherit', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:7,
                opacity:bulkSyncing?.7:1, boxShadow:'0 2px 8px rgba(194,65,12,.3)', whiteSpace:'nowrap' as const }}>
              {bulkSyncing
                ? <><span style={{ display:'inline-block', animation:'spin 1s linear infinite' }}>⏳</span> Синхронизира...</>
                : <>🟠 Sync {unsyncedCount} → Systeme.io</>}
            </button>
            {/* Ре-sync бутон — винаги видим */}
            <button onClick={() => handleBulkSync(true)} disabled={bulkSyncing}
              style={{ fontSize:12, padding:'10px 14px', borderRadius:9, border:'1px solid #fde68a',
                background:'#fffbeb', color:'#92400e', fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                opacity:bulkSyncing?0.6:1, whiteSpace:'nowrap' as const }}>
              {bulkSyncing ? '⏳...' : '🔄 Ре-sync всички'}
            </button>
          </div>
        </div>
      ) : (
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
          </div>

          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, padding:'20px 22px' }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:14 }}>🔗 UTM Источници</div>
            {utmData.map(([src, cnt]) => (
              <div key={src} style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'5px 0', borderBottom:'1px solid #f9f9f9' }}>
                <span style={{color:'#374151'}}>{src}</span>
                <strong style={{color:'#111'}}>{cnt}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════ LIST ══════════════ */}
      {section==='list' && (
        <>
          {/* ── Filters ── */}
          <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
            <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}
              placeholder="Имейл, имена, телефон..."
              style={{ ...inp, minWidth:200, flex:1 }} />

            {/* Subscription filter */}
            {(['all','subscribed','unsubscribed'] as const).map(f=>(
              <button key={f} onClick={()=>{setFilter(f);setPage(1)}}
                style={{ ...inp, cursor:'pointer', background:filter===f?'#1b4332':'#fff', color:filter===f?'#fff':'var(--text)',
                  borderColor:filter===f?'#1b4332':'var(--border)', fontWeight:filter===f?700:400 }}>
                {f==='all'?'Всички':f==='subscribed'?'✓ Активни':'✗ Отписани'}
              </button>
            ))}

            {/* Sync filter */}
            {(['all','synced','unsynced'] as const).map(f=>(
              <button key={f} onClick={()=>{setSyncFilter(f);setPage(1)}}
                style={{ ...inp, cursor:'pointer',
                  background: syncFilter===f ? (f==='synced'?'#16a34a':f==='unsynced'?'#ea580c':'#374151') : '#fff',
                  color: syncFilter===f?'#fff':'var(--text)',
                  borderColor: syncFilter===f ? (f==='synced'?'#16a34a':f==='unsynced'?'#ea580c':'#374151') : 'var(--border)',
                  fontWeight:syncFilter===f?700:400 }}>
                {f==='all'?'Всички':f==='synced'?'✅ Sync':'🟠 Unsync'}
              </button>
            ))}

            {/* Slug filter */}
            {allSlugs.length > 1 && (
              <select value={slugFilter} onChange={e=>{setSlugFilter(e.target.value);setPage(1)}} style={{...inp,cursor:'pointer'}}>
                <option value=''>Всички наръчници</option>
                {allSlugs.map(s=><option key={s} value={s}>{slugEmoji(s)} {slugLabel(s)}</option>)}
              </select>
            )}

            {/* Multi-DL filter */}
            <button onClick={()=>{setMultiFilter(m=>!m);setPage(1)}}
              style={{ ...inp, cursor:'pointer', background:multiFilter?'#7c3aed':'#fff',
                color:multiFilter?'#fff':'var(--text)', borderColor:multiFilter?'#7c3aed':'var(--border)',
                fontWeight:multiFilter?700:400 }}>
              🔥 Multi-DL
            </button>

            {/* Tag filter */}
            {allTags.length > 0 && (
              <select value={selectedTag} onChange={e=>{setSelectedTag(e.target.value);setPage(1)}} style={{...inp,cursor:'pointer'}}>
                <option value=''>Всички тагове</option>
                {allTags.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            )}

            {/* Clear filters */}
            {(search||filter!=='all'||syncFilter!=='all'||slugFilter||multiFilter||selectedTag) && (
              <button onClick={()=>{setSearch('');setFilter('all');setSyncFilter('all');setSlugFilter('');setMultiFilter(false);setSelectedTag('');setPage(1)}}
                style={{...inp,cursor:'pointer',color:'#ef4444',borderColor:'#fca5a5'}}>
                Изчисти
              </button>
            )}
          </div>

          <div style={{ fontSize:12, color:'var(--muted)', marginBottom:10 }}>
            Показани: {filtered.length} контакта
          </div>

          {/* ── Desktop table ── */}
          <div className="desktop-only" style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#f9fafb' }}>
                    <th onClick={()=>handleSort('email')} style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, fontSize:11, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.06em', cursor:'pointer', whiteSpace:'nowrap' }}>
                      Имейл / Имена <SortArrow k='email' />
                    </th>
                    <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, fontSize:11, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.06em' }}>Наръчници</th>
                    <th onClick={()=>handleSort('created_at')} style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, fontSize:11, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.06em', cursor:'pointer' }}>
                      Статус <SortArrow k='created_at' />
                    </th>
                    <th style={{ padding:'10px 14px', textAlign:'center', fontWeight:700, fontSize:11, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.06em' }}>Systeme.io</th>
                    <th onClick={()=>handleSort('created_at')} style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, fontSize:11, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.06em', cursor:'pointer', whiteSpace:'nowrap' }}>
                      Дата <SortArrow k='created_at' />
                    </th>
                    <th style={{ padding:'10px 14px', width:32 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(l => {
                    const isSynced  = syncedIds.has(l.id) || !!(l as any).systemeio_synced
                    const isInvalid = invalidIds.has(l.id) || !!(l as any).systemeio_email_invalid
                    const syncing   = syncingId === l.id
                    const expanded  = expandedId === l.id
                    const slugSet   = emailToSlugs.get(l.email) || new Set<string>()
                    const isMulti   = multiEmails.has(l.email)

                    return (
                      <>
                        <tr key={l.id} className="lead-row" onClick={()=>setExpandedId(expanded?null:l.id)}>
                          {/* Email / Name */}
                          <td style={{ padding:'11px 14px', borderBottom:'1px solid #f5f5f5' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#d1fae5,#a7f3d0)',
                                display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#065f46', flexShrink:0 }}>
                                {(l.name||l.email)[0].toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight:600, color:'#111', fontSize:13 }}>{l.email}</div>
                                {l.name && <div style={{ fontSize:11, color:'#6b7280', marginTop:1 }}>{l.name}</div>}
                                {l.phone && <div style={{ fontSize:11, color:'#9ca3af' }}>📞 {l.phone}</div>}
                              </div>
                            </div>
                          </td>

                          {/* Наръчници */}
                          <td style={{ padding:'11px 14px', borderBottom:'1px solid #f5f5f5' }}>
                            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                              {Array.from(slugSet).map(slug=>(
                                <span key={slug} style={{ fontSize:11, padding:'2px 7px', borderRadius:99, fontWeight:700,
                                  background:'#f0fdf4', color:'#15803d', border:'1px solid #bbf7d0' }}>
                                  {slugEmoji(slug)} {slugLabel(slug)}
                                </span>
                              ))}
                              {isMulti && (
                                <span style={{ fontSize:10, padding:'2px 6px', borderRadius:99, fontWeight:800,
                                  background:'#fef3c7', color:'#92400e', border:'1px solid #fde68a' }}>
                                  🔥 Multi
                                </span>
                              )}
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
                            {isInvalid ? (
                              <button onClick={()=>handleResetInvalid([l.id])} disabled={resettingInvalid}
                                title="Имейлът е маркиран невалиден — натисни за ресет"
                                style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, padding:'4px 10px',
                                  borderRadius:7, fontWeight:700, background:'#fef2f2', color:'#991b1b',
                                  border:'1px solid #fca5a5', cursor:'pointer', fontFamily:'inherit',
                                  opacity:resettingInvalid?0.6:1 }}>
                                ⚠️ Невалиден
                              </button>
                            ) : (
                              <button
                                onClick={()=>handleSyncOne(l)}
                                disabled={syncing || isSynced}
                                className="sync-btn"
                                title={isSynced?'Синхронизиран ✅':'Натисни за sync'}
                                style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, padding:'4px 10px',
                                  borderRadius:7, fontWeight:700,
                                  background:isSynced?'#f0fdf4':'#fff7ed',
                                  color:isSynced?'#15803d':'#ea580c',
                                  border:`1px solid ${isSynced?'#86efac':'#fed7aa'}`,
                                  opacity:(syncing&&!isSynced)?0.7:1,
                                  cursor:isSynced?'default':'pointer' }}>
                                <SyncDot synced={isSynced} />
                                {syncing?'⏳...':isSynced?'Synced':'Sync →'}
                              </button>
                            )}
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
                                {!isSynced && !isInvalid && (
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

          {/* ── Mobile cards ── */}
          <div className="mobile-only">
            {paginated.map(l => {
              const isSynced  = syncedIds.has(l.id) || !!(l as any).systemeio_synced
              const isInvalid = invalidIds.has(l.id) || !!(l as any).systemeio_email_invalid
              const syncing   = syncingId === l.id
              const slugSet   = emailToSlugs.get(l.email) || new Set<string>()
              return (
                <div key={l.id} style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px', marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:'#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.email}</div>
                      {l.name && <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{l.name}</div>}
                      {l.phone && <div style={{ fontSize:12, color:'#9ca3af' }}>📞 {l.phone}</div>}
                    </div>
                    <span style={{ fontSize:11, padding:'3px 8px', borderRadius:99, fontWeight:700, flexShrink:0,
                      background:l.subscribed?'#d1fae5':'#fee2e2', color:l.subscribed?'#065f46':'#991b1b' }}>
                      {l.subscribed?'✓':'✗'}
                    </span>
                  </div>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginTop:8 }}>
                    {Array.from(slugSet).map(slug=>(
                      <span key={slug} style={{ fontSize:11, padding:'2px 7px', borderRadius:99, fontWeight:700, background:'#f0fdf4', color:'#15803d', border:'1px solid #bbf7d0' }}>
                        {slugEmoji(slug)} {slugLabel(slug)}
                      </span>
                    ))}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:10 }}>
                    <span style={{ fontSize:11, color:'#9ca3af' }}>
                      {new Date(l.created_at).toLocaleDateString('bg-BG',{day:'2-digit',month:'short',year:'2-digit'})}
                    </span>
                    {isInvalid ? (
                      <span style={{ fontSize:11, padding:'4px 10px', borderRadius:7, fontWeight:700, background:'#fef2f2', color:'#991b1b', border:'1px solid #fca5a5' }}>⚠️ Невалиден</span>
                    ) : (
                      <button onClick={()=>handleSyncOne(l)} disabled={syncing||isSynced}
                        style={{ fontSize:11, padding:'5px 12px', borderRadius:7, fontWeight:700, border:'none',
                          background:isSynced?'#f0fdf4':'#fff7ed', color:isSynced?'#15803d':'#ea580c',
                          cursor:isSynced?'default':'pointer', fontFamily:'inherit', opacity:(syncing&&!isSynced)?0.7:1 }}>
                        {syncing?'⏳...':isSynced?'✅ Synced':'🟠 Sync →'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
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
