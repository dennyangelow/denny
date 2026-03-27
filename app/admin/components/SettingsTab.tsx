'use client'

import { useState, useEffect } from 'react'
import { toast } from '@/components/ui/Toast' // Ползваме вече създадения компонент

interface Props { ordersCount: number; leadsCount: number }

const SECTIONS = {
  general: {
    label: 'Общи текстове',
    keys: [
      { key: 'hero_title', label: 'Hero заглавие', type: 'text' },
      { key: 'hero_subtitle', label: 'Hero подзаглавие', type: 'textarea' },
      { key: 'hero_warning', label: 'Hero предупреждение', type: 'text' },
    ]
  },
  contacts: {
    label: 'Контакти & Известия',
    keys: [
      { key: 'site_phone', label: 'Телефон за клиенти', type: 'text' },
      { key: 'site_email', label: 'Email за клиенти', type: 'text' },
      { key: 'admin_email', label: 'Admin email (за нови поръчки)', type: 'text' },
      { key: 'whatsapp_number', label: 'WhatsApp номер', type: 'text' },
    ]
  },
  shipping: {
    label: 'Доставка & Плащане',
    keys: [
      { key: 'shipping_price', label: 'Цена доставка (лв.)', type: 'number' },
      { key: 'free_shipping_above', label: 'Безплатна доставка над (лв.)', type: 'number' },
    ]
  }
}

export function SettingsTab({ ordersCount, leadsCount }: Props) {
  const [vals, setVals] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if (d.settings) setVals(d.settings)
        setLoading(false)
      })
      .catch(() => {
        toast.error('Грешка при зареждане на настройките')
        setLoading(false)
      })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: vals }),
      })
      
      if (res.ok) {
        toast.success('Настройките са запазени успешно!')
      } else {
        throw new Error()
      }
    } catch (e) {
      toast.error('Възникна грешка при записването')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="settings-loading">Зареждане на конфигурацията...</div>

  return (
    <div className="settings-container">
      <style>{settingsStyles}</style>
      
      <header className="settings-header">
        <div>
          <h1>Настройки</h1>
          <p>Управление на глобалните параметри на сайта</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving} 
          className="save-btn-top"
        >
          {saving ? '...' : 'Запази промените'}
        </button>
      </header>

      <div className="settings-grid">
        <div className="settings-main">
          {Object.entries(SECTIONS).map(([id, section]) => (
            <section key={id} className="settings-card">
              <h3>{section.label}</h3>
              <div className="input-list">
                {section.keys.map(k => (
                  <div key={k.key} className="input-field">
                    <label>{k.label}</label>
                    {k.type === 'textarea' ? (
                      <textarea
                        value={vals[k.key] || ''}
                        onChange={e => setVals(p => ({ ...p, [k.key]: e.target.value }))}
                      />
                    ) : (
                      <input
                        type={k.type}
                        value={vals[k.key] || ''}
                        onChange={e => setVals(p => ({ ...p, [k.key]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <aside className="settings-sidebar">
          <div className="info-card">
            <h4>Статус</h4>
            <div className="stat-row"><span>Поръчки:</span> <strong>{ordersCount}</strong></div>
            <div className="stat-row"><span>Абонати:</span> <strong>{leadsCount}</strong></div>
          </div>

          <div className="danger-zone">
            <h4>Сигурност</h4>
            <p>Уверете се, че ADMIN_SECRET е активен в Vercel.</p>
            <button className="secondary-btn" onClick={() => window.open('https://vercel.com')}>
              Отвори Vercel
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}

const settingsStyles = `
  .settings-container { padding: 32px; max-width: 1200px; margin: 0 auto; }
  .settings-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
  .settings-header h1 { font-size: 24px; font-weight: 800; color: #111; }
  .settings-header p { color: #6b7280; font-size: 14px; }
  
  .settings-grid { display: grid; grid-template-columns: 1fr 300px; gap: 24px; }
  
  .settings-card { background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; margin-bottom: 24px; }
  .settings-card h3 { font-size: 16px; font-weight: 700; margin-bottom: 20px; color: #1f2937; }
  
  .input-list { display: flex; flex-direction: column; gap: 16px; }
  .input-field label { display: block; font-size: 12px; font-weight: 600; color: #4b5563; margin-bottom: 6px; }
  .input-field input, .input-field textarea {
    width: 100%; padding: 10px 14px; border: 1.5px solid #f3f4f6; border-radius: 10px;
    font-family: inherit; font-size: 14px; transition: 0.2s; background: #f9fafb;
  }
  .input-field input:focus { border-color: #2d6a4f; background: white; outline: none; }
  
  .save-btn-top {
    background: #1b4332; color: white; border: none; padding: 10px 24px;
    border-radius: 10px; font-weight: 700; cursor: pointer; transition: 0.2s;
  }
  .save-btn-top:hover { background: #2d6a4f; transform: translateY(-1px); }

  .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; }
  .stat-row { display: flex; justify-content: space-between; font-size: 13px; padding: 8px 0; border-bottom: 1px solid #edf2f7; }
  
  .danger-zone { margin-top: 24px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 16px; padding: 20px; }
  .danger-zone h4 { color: #be123c; font-size: 14px; margin-bottom: 8px; }
  .danger-zone p { font-size: 12px; color: #9f1239; margin-bottom: 12px; }
  
  @media (max-width: 1024px) {
    .settings-grid { grid-template-columns: 1fr; }
  }
`