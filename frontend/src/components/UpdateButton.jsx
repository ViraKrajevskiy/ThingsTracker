import React, { useEffect, useState } from 'react'

const api = typeof window !== 'undefined' ? window.electronAPI : null

export default function UpdateButton() {
  const [status, setStatus] = useState(null) // checking|available|downloading|downloaded|none|error|dev
  const [percent, setPercent] = useState(0)
  const [version, setVersion] = useState('')

  useEffect(() => {
    if (!api) return
    const off = api.onUpdateStatus((d) => {
      setStatus(d.status)
      if (d.percent != null) setPercent(d.percent)
      if (d.version) setVersion(d.version)
    })
    return off
  }, [])

  if (!api) return null // browser / PWA — no updates here

  const check = async () => { setStatus('checking'); await api.checkForUpdates() }
  const restart = () => api.restartToUpdate()

  const label = {
    checking: 'Проверяем…',
    available: 'Найдено обновление ' + version,
    downloading: 'Загрузка ' + percent + '%',
    downloaded: 'Обновление готово',
    none: 'Актуальная версия',
    error: 'Ошибка проверки',
    dev: 'Обновления только в собранной версии',
  }[status]

  return (
    <div className="update-box">
      {status === 'downloaded' ? (
        <button className="update-btn primary" onClick={restart}>Перезапустить и обновить</button>
      ) : (
        <button className="update-btn" onClick={check} disabled={status === 'checking' || status === 'downloading'}>
          {status === 'checking' || status === 'downloading' ? label : 'Проверить обновления'}
        </button>
      )}
      {label && status !== 'checking' && status !== 'downloading' && status !== 'downloaded' && (
        <div className="update-status">{label}</div>
      )}
    </div>
  )
}
