'use client'
// components/client/SpecialSectionButton.tsx
// Client component за бутона в special_sections — добавя affiliate click tracking

import { trackAffiliateClick } from '@/lib/trackAffiliateClick'

interface Props {
  href: string
  text: string
  slug: string
  partner?: string
}

export function SpecialSectionButton({ href, text, slug, partner }: Props) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="ginegar-btn"
      onClick={() => {
        if (partner && slug) {
          trackAffiliateClick(partner, slug)
        }
      }}
    >
      {text}
    </a>
  )
}
