// app/blog/[slug]/loading.tsx — v2
// ✅ ПРОМЯНА спрямо v1: старият skeleton беше скициран само за статия
//    (breadcrumb+корица+заглавие+абзаци+FAQ) — откакто /blog/[slug] вече
//    обслужва и категорийни pillar hub-ове (/blog/domati), същият файл се
//    показва и за тях, докато данните се зареждат, но hub-ът реално
//    изглежда съвсем различно (hero + грид от карти, не абзаци).
//    Тази версия е нарочно по-неутрална: горна секция (пасва еднакво на
//    breadcrumb+заглавие ЗА СТАТИЯ и на hero заглавие+увод ЗА hub), после
//    грид от правоъгълни блокове — достатъчно общ силует, че да не
//    изглежда грубо разминат с нито един от двата реални резултата.

const SHIMMER = `
  @keyframes shimmer {
    0%   { background-position: -600px 0 }
    100% { background-position:  600px 0 }
  }
  .sk {
    background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
    background-size: 600px 100%;
    animation: shimmer 1.6s ease-in-out infinite;
    border-radius: 6px;
  }
`

export default function BlogSlugLoading() {
  return (
    <div style={{ background: '#fafaf8', minHeight: '100vh' }}>
      <style>{SHIMMER}</style>

      {/* ── Горна секция — пасва еднакво добре на "breadcrumb + заглавие
          на статия" и на "hero заглавие + увод на категория" ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 28px' }}>
        <div className="sk" style={{ width: 160, height: 12, marginBottom: 18 }} />
        <div className="sk" style={{ width: '55%', height: 34, marginBottom: 10 }} />
        <div className="sk" style={{ width: '38%', height: 34, marginBottom: 16 }} />
        <div className="sk" style={{ width: '70%', height: 15 }} />
      </div>

      {/* ── Грид от общи правоъгълни блокове — достатъчно неутрален
          силует: и за карти (hub), и като общ "зареждащо се съдържание"
          placeholder преди абзаците на статия да се появят ── */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px 60px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 22 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, overflow: 'hidden' }}>
              <div className="sk" style={{ width: '100%', aspectRatio: '16/9', borderRadius: 0 }} />
              <div style={{ padding: '14px 16px 16px' }}>
                <div className="sk" style={{ width: '85%', height: 16, marginBottom: 8 }} />
                <div className="sk" style={{ width: '100%', height: 12, marginBottom: 6 }} />
                <div className="sk" style={{ width: '70%', height: 12 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
