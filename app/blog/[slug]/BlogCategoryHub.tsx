// app/blog/[slug]/BlogCategoryHub.tsx — v1
// ✅ НОВ файл. Pillar/hub страница за категория (/blog/domati,
//    /blog/krastavici и т.н.) — рендва се от app/blog/[slug]/page.tsx
//    когато slug-ът съвпада с категориен slug, вместо с post slug.
//    Reuse-ва .blog-card/.blog-grid стиловете от blog.css (същите като
//    BlogListClient.tsx), за да изглежда визуално еднакво с /blog листата.

import { SafeImg } from '@/components/client/SafeImg'
import type { BlogListPost, BlogCategory } from '@/lib/blog'
import { deriveExcerpt } from '@/lib/blog'

interface Props {
  category: BlogCategory
  posts:    BlogListPost[]
}

export default function BlogCategoryHub({ category, posts }: Props) {
  return (
    <>
      <div className="blog-hero">
        <div className="blog-hero-inner">
          <nav className="blog-breadcrumb" aria-label="Breadcrumb">
            <a href="/">Начало</a><span>/</span><a href="/blog">Блог</a><span>/</span><span>{category.label}</span>
          </nav>
          <h1 className="blog-hero-title">{category.emoji} {category.label}</h1>
          {category.intro_text && (
            <p className="blog-hero-sub">{category.intro_text}</p>
          )}
        </div>
      </div>

      <div className="blog-list-wrap">
        {posts.length === 0 ? (
          <div className="blog-empty">
            <div style={{ fontSize: 40, marginBottom: 10 }}>🌱</div>
            Скоро тук ще има статии за „{category.label}". Провери отново скоро.
          </div>
        ) : (
          <div className="blog-grid">
            {posts.map((post, i) => (
              <a key={post.id} href={`/blog/${post.slug}`} className="blog-card">
                <div className="blog-card-img-wrap">
                  {post.cover_image_url && (
                    <SafeImg
                      src={post.cover_image_url}
                      alt={post.cover_image_alt || post.title}
                      priority={i === 0}
                      width={640}
                      height={360}
                      quality={70}
                      sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  )}
                </div>
                <div className="blog-card-body">
                  <h2 className="blog-card-title">{post.title}</h2>
                  <p className="blog-card-excerpt">{deriveExcerpt(post)}</p>
                  <div className="blog-card-meta">
                    {post.published_at && (
                      <span>{new Date(post.published_at).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    )}
                    {post.reading_time_minutes && <span>· {post.reading_time_minutes} мин четене</span>}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        <p style={{ marginTop: 32, textAlign: 'center' }}>
          <a href="/blog">← Всички статии в блога</a>
        </p>
      </div>
    </>
  )
}
