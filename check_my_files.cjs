// check_my_files.cjs — проверява кои от поправените файлове са реално в ТВОЯ проект.
// Пусни от главната папка на проекта (там, където е package.json):   node check_my_files.cjs
// Само чете файлове — нищо не променя.
const fs = require('fs'), path = require('path')

// [файл, текст, който трябва да съдържа (или null = достатъчно е да съществува), коя версия е, задължителен ли е]
const CHECKS = [
  ['app/api/analytics/page-view/route.ts',        'internal === true',     'page-view route v14',                 true],
  ['app/api/analytics/affiliate-click/route.ts',  'internal === true',     'affiliate-click route v13',           true],
  ['app/api/analytics/product-event/route.ts',    'internal === true',     'product-event route v3',              true],
  ['components/analytics/PageViewTracker.tsx',    'da_internal',           'PageViewTracker v3',                  true],
  ['lib/trackAffiliateClick.ts',                  'da_internal',           'trackAffiliateClick v2',              true],
  ['lib/trackProductEvent.ts',                    'da_internal',           'trackProductEvent v2',                true],
  ['hooks/useAdminData.ts',                       'computeAdminStats',     'useAdminData v19',                    true],
  ['app/admin/components/rangeUtils.ts',          '— v5',                  'rangeUtils v5 (периоди точно N дни)', true],
  ['app/admin/components/DashboardTab.tsx',       'N дни включително днес','DashboardTab v2',                     true],
  ['app/admin/components/AnalyticsTab.tsx',       'last365Unique',         'AnalyticsTab (с поправките)',         true],
  ['app/admin/components/InternalDeviceCard.tsx', null,                    'карта "Това устройство"',             true],
  ['app/api/admin/whoami/route.ts',               null,                    'whoami route',                        true],
  ['app/admin/page.tsx',                          'useAutoMarkAdminDevice','админ page.tsx — 3-те промени',       true],
  ['app/admin/components/OrdersTab.tsx',          'DeleteOrdersDialog',    'OrdersTab v11 (изтриване)',           true],
  ['app/admin/components/OrderModal.tsx',         'onDelete',              'OrderModal v9 (изтриване)',           true],
  ['app/admin/components/DeleteOrdersDialog.tsx', null,                    'диалог за изтриване',                 true],
  ['app/api/orders/purge/route.ts',               null,                    'purge route (изтриване)',             true],
  ['components/client/CartSystem.tsx',            'da_utm',                'CartSystem — UTM към поръчката',      false],
  ['components/blog/AffiliateTrackedLink.tsx',    "source = 'blog'",       'AffiliateTrackedLink v3',             false],
  ['components/analytics/GoogleAnalytics.tsx',    "startsWith('/admin')",  'GoogleAnalytics v2',                  false],
  ['lib/unsubscribe-token.ts',                    'UNSUBSCRIBE_SECRET',    'unsubscribe-token v2',                false],
]

let missingRequired = 0, missingOptional = 0
console.log('\nПроверка на проекта в: ' + process.cwd() + '\n')
for (const [file, marker, label, required] of CHECKS) {
  const full = path.join(process.cwd(), file)
  let status, note = ''
  if (!fs.existsSync(full)) { status = required ? '❌' : '⚠️'; note = 'ФАЙЛЪТ ЛИПСВА' }
  else if (marker && !fs.readFileSync(full, 'utf8').includes(marker)) { status = required ? '❌' : '⚠️'; note = 'старата версия е (няма "' + marker + '")' }
  else status = '✅'
  if (status === '❌') missingRequired++
  if (status === '⚠️') missingOptional++
  console.log(`${status} ${label.padEnd(40)} ${file}${note ? '  ← ' + note : ''}${status === '⚠️' ? '  (по желание)' : ''}`)
}
console.log('\n' + (missingRequired === 0 ? '✅ Всички задължителни файлове са на място.' : `❌ Липсват/стари са ${missingRequired} задължителни файла — замени ги от архива.`) +
  (missingOptional ? `\n⚠️ ${missingOptional} по желание (не пречат на работата).` : '') + '\n')
process.exit(missingRequired ? 1 : 0)
