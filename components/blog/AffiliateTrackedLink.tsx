'use client'
// components/blog/AffiliateTrackedLink.tsx — v1
// Единствената причина product embed-ът да имаше нужда от 'use client' в
// оригиналния BlogPostClient беше този onClick tracking call. Изолиран тук
// като най-малкия възможен клиентски остров — всичко останало в поста
// (параграфи, heading-и, снимки, quote, cover image) си остава сървърно.

interface Props {
  href: string
  slug: string
  sponsored: boolean
  children: React.ReactNode
  className?: string
}

function trackAffiliateClick(slug: string) {
  try {
    fetch('/api/affiliate-clicks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ slug, source: 'blog' }),
    }).catch(() => {})
  } catch {
    /* noop */
  }
}

export function AffiliateTrackedLink({ href, slug, sponsored, children, className }: Props) {
  return (
    <a
      href={href}
      className={className}
      {...(sponsored ? { rel: 'sponsored nofollow noopener', target: '_blank' } : {})}
      onClick={() => sponsored && trackAffiliateClick(slug)}
    >
      {children}
    </a>
  )
}
