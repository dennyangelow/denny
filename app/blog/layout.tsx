// app/blog/layout.tsx — v1
// ⚠️ ДОПУСКАНЕ: AffiliateProduktClient.tsx не импортира сам SiteHeader/
//    SiteFooter/produkt.css, значи те се включват от layout.tsx на неговия
//    маршрут (app/produkt/[slug]/layout.tsx — не ми е предоставен). Тук
//    следвам същата конвенция за /blog. Ако при теб SiteHeader/SiteFooter
//    се рендват другаде (напр. общ layout над всички не-homepage маршрути),
//    махни ги оттук за да не се появят двойно.
import './blog.css'
import SiteHeader from '@/components/layout/SiteHeader'
import SiteFooter from '@/components/layout/SiteFooter'

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="blog-page">
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  )
}
