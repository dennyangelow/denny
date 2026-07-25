// lib/images.ts
// ✅ Споделен helper за обединяване на главна снимка + галерия в списък с
//    уникален alt текст за всяка. Ползва се от Собствени продукти (OwnProduktClient),
//    и може да се разшири и за Наръчници при нужда.
//    lib/affiliate.ts си пази собствено копие (getAllImages) — не пипано, за да не
//    рискуваме вече деплойнатия афилиейт код; тук е за всичко останало.

export interface GalleryEntry { url: string; alt?: string }
export interface ResolvedImage { url: string; alt: string }

export function buildImageList(
  mainUrl:     string | null | undefined,
  mainAlt:     string | null | undefined,
  gallery:     (string | GalleryEntry)[] | null | undefined,
  fallbackAlt: string
): ResolvedImage[] {
  const seen = new Set<string>()
  const out: ResolvedImage[] = []
  const baseAlt = (mainAlt && mainAlt.trim()) || fallbackAlt

  if (mainUrl && !seen.has(mainUrl)) {
    seen.add(mainUrl)
    out.push({ url: mainUrl, alt: baseAlt })
  }

  const list = Array.isArray(gallery) ? gallery : []
  for (const entry of list) {
    const url       = typeof entry === 'string' ? entry : entry?.url
    const customAlt = typeof entry === 'string' ? undefined : entry?.alt
    if (!url || seen.has(url)) continue
    seen.add(url)
    const autoAlt = `${baseAlt} — снимка ${out.length + 1}`
    out.push({ url, alt: customAlt && customAlt.trim() ? customAlt.trim() : autoAlt })
  }

  return out
}
