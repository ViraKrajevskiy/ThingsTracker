import React, { useEffect, useState, useRef } from 'react'
import { api } from '../api.js'
import { IconPaperclip, IconPlay } from './Icons.jsx'

function isImage(m) { return m && m.startsWith('image/') }
function isVideo(m) { return m && m.startsWith('video/') }
function fmtSize(b) {
  if (b == null) return ''
  if (b < 1024) return b + ' Б'
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' КБ'
  return (b / 1024 / 1024).toFixed(1) + ' МБ'
}

export default function Attachments({ cardId }) {
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef(null)

  const load = async () => setItems(await api.attachments(cardId))
  useEffect(() => { load() }, [cardId])

  const upload = async (fileList) => {
    setBusy(true)
    for (const f of Array.from(fileList)) {
      await api.uploadAttachment(cardId, f)
    }
    setBusy(false)
    load()
  }
  const onPick = (e) => { if (e.target.files?.length) upload(e.target.files) }
  const onDrop = (e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.length) upload(e.dataTransfer.files) }
  const remove = async (id) => { await api.deleteAttachment(id); load() }

  return (
    <div className="attachments">
      <div className={'drop-zone' + (drag ? ' over' : '')}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}>
        <input ref={inputRef} type="file" multiple hidden onChange={onPick} />
        {busy ? 'Загрузка…' : (<><IconPaperclip size={14} /> Перетащи файлы сюда или нажми, чтобы выбрать</>)}
      </div>

      <div className="att-grid">
        {items.map(a => (
          <div className="att-item" key={a.id}>
            {isImage(a.mimetype) ? (
              <a href={api.attachmentUrl(a.id)} target="_blank" rel="noreferrer" className="att-thumb">
                <img src={api.attachmentUrl(a.id)} alt={a.filename} />
              </a>
            ) : isVideo(a.mimetype) ? (
              <a href={api.attachmentUrl(a.id)} target="_blank" rel="noreferrer" className="att-thumb">
                <video src={api.attachmentUrl(a.id)} muted />
                <span className="att-play"><IconPlay size={22} /></span>
              </a>
            ) : (
              <a href={api.attachmentDownloadUrl(a.id)} className="att-file">
                <span className="att-ext">{(a.filename.split('.').pop() || 'file').toUpperCase()}</span>
              </a>
            )}
            <div className="att-meta">
              <a className="att-name" href={api.attachmentDownloadUrl(a.id)} title={a.filename}>{a.filename}</a>
              <span className="att-size">{fmtSize(a.size)}</span>
            </div>
            <button className="att-del" onClick={() => remove(a.id)} title="Удалить">×</button>
          </div>
        ))}
      </div>
    </div>
  )
}
