// lib/jsonld.ts — v1
// Безопасно сериализиране на JSON-LD за <script type="application/ld+json">.
//
// Проблем: JSON.stringify() НЕ escape-ва "<". Ако някое поле, което влиза в
// schema (meta_description, author_bio, FAQ отговор, заглавие...), съдържа
// "</script><script>...", браузърът затваря script тага и изпълнява
// останалото — stored XSS за всеки посетител на страницата.
// Замяната на "<" с \u003c е валиден JSON (парсърите го връщат като "<"),
// но не може да затвори тага.
//
// Употреба:  <script type="application/ld+json"
//              dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />

export function jsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
