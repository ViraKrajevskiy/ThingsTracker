import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('App crashed:', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 30, fontFamily: 'monospace', color: '#E8F0FF', background: '#0A1628', minHeight: '100vh' }}>
          <h2 style={{ color: '#FF6B9D' }}>Что-то сломалось в интерфейсе</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#FFB347' }}>{String(this.state.error?.stack || this.state.error)}</pre>
        </div>
      )
    }
    return this.props.children
  }
}
