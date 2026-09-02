// Shell: top strip + floating cards (KOAN.live NODE shell, floating mode) + toasts + help. SPEC s5.1.
import { PRESET_THEMES, applyTheme, currentTheme } from './themes'

export type Mode = 'walk' | 'hang' | 'level'
export type CleanLook = 'hidden' | 'whitebox' | 'both'

const CARD_KEY = 'koan-hang-cards'
type CardPos = Record<string, { x: number; y: number; folded: boolean }>
function loadCards(): CardPos { try { return JSON.parse(localStorage.getItem(CARD_KEY) ?? '{}') } catch { return {} } }
function saveCards(p: CardPos): void { try { localStorage.setItem(CARD_KEY, JSON.stringify(p)) } catch { /* private mode */ } }

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

export function chips<T extends string>(opts: { id: T; label: string; tip: string; disabled?: string }[], value: T, onPick: (v: T) => void): { root: HTMLElement; set: (v: T) => void } {
  const root = el('div', 'chips')
  const btns = new Map<T, HTMLButtonElement>()
  for (const o of opts) {
    const b = el('button', 'chip', o.label)
    b.title = o.disabled ? `${o.tip} · ${o.disabled}` : o.tip
    if (o.disabled) b.disabled = true
    b.addEventListener('click', () => { if (!b.disabled) onPick(o.id) })
    btns.set(o.id, b); root.appendChild(b)
  }
  const set = (v: T) => { for (const [id, b] of btns) b.classList.toggle('on', id === v) }
  set(value)
  return { root, set }
}

export interface Card { root: HTMLElement; body: HTMLElement; setStatus: (s: string) => void }

export class Shell {
  readonly root: HTMLElement
  readonly viewport: HTMLElement
  readonly top: HTMLElement
  readonly cardsLayer: HTMLElement
  private toasts: HTMLElement
  private positions = loadCards()
  private helpEl: HTMLElement

  constructor(mount: HTMLElement) {
    this.root = mount
    this.viewport = el('div', 'viewport'); mount.appendChild(this.viewport)
    this.top = el('div', 'top'); mount.appendChild(this.top)
    this.cardsLayer = el('div', 'cards'); mount.appendChild(this.cardsLayer)
    this.toasts = el('div', 'toasts'); mount.appendChild(this.toasts)
    this.helpEl = el('div', 'help'); this.helpEl.hidden = true; mount.appendChild(this.helpEl)
    this.helpEl.addEventListener('click', () => { this.helpEl.hidden = true })
  }

  logo(): void {
    const l = el('div', 'logo'); l.innerHTML = 'KOAN<b>.hang</b>'
    this.top.appendChild(l)
    this.top.appendChild(el('span', 'tag', 'hang real art in a real room'))
  }
  spacer(): void { this.top.appendChild(el('span', 'spacer')) }

  themePicker(onChange?: () => void): void {
    const names = Object.keys(PRESET_THEMES) as string[]
    const c = chips(names.map((n) => ({ id: n, label: n.toLowerCase(), tip: `theme ${n.toLowerCase()} · click = apply` })), currentTheme(), (v) => { applyTheme(v); c.set(v); onChange?.() })
    this.top.appendChild(c.root)
  }

  helpButton(text: string): void {
    const b = el('button', 'chip', '?'); b.title = 'keys and gestures · click = show'
    b.addEventListener('click', () => { this.helpEl.innerHTML = text; this.helpEl.hidden = !this.helpEl.hidden })
    this.top.appendChild(b)
  }
  toggleHelp(text: string): void { this.helpEl.innerHTML = text; this.helpEl.hidden = !this.helpEl.hidden }
  hideHelp(): boolean { const was = !this.helpEl.hidden; this.helpEl.hidden = true; return was }

  /** defaultPos: x from the left edge, or from the right edge when anchor is 'right'; used until the user drags the card */
  card(id: string, title: string, defaultPos: { x: number; y: number; anchor?: 'left' | 'right' }): Card {
    const root = el('div', 'card'); root.dataset.id = id
    const head = el('div', 'card-head')
    const fold = el('button', 'fold', '▾'); fold.title = 'fold · click = fold or open'
    const t = el('span', 'card-title', title)
    const status = el('span', 'card-status', '')
    head.append(fold, t, status)
    const body = el('div', 'card-body')
    root.append(head, body)
    this.cardsLayer.appendChild(root)
    const stored = this.positions[id]
    const p = stored ?? { x: 0, y: defaultPos.y, folded: false }
    let placed = !!stored // false = follow the default anchor until dragged
    const apply = () => {
      if (!placed) p.x = defaultPos.anchor === 'right' ? window.innerWidth - defaultPos.x - 260 : defaultPos.x
      root.style.left = `${Math.max(0, Math.min(window.innerWidth - 80, p.x))}px`
      root.style.top = `${Math.max(40, Math.min(window.innerHeight - 40, p.y))}px`
      body.hidden = p.folded; fold.textContent = p.folded ? '▸' : '▾'
    }
    apply()
    const persist = () => { this.positions[id] = p; saveCards(this.positions) }
    fold.addEventListener('click', () => { p.folded = !p.folded; apply(); if (placed) persist() })
    // drag by the head
    let drag: { dx: number; dy: number } | null = null
    head.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return
      drag = { dx: e.clientX - p.x, dy: e.clientY - p.y }; placed = true; e.preventDefault()
    })
    window.addEventListener('mousemove', (e) => { if (drag) { p.x = e.clientX - drag.dx; p.y = e.clientY - drag.dy; apply() } })
    window.addEventListener('mouseup', () => { if (drag) { drag = null; persist() } })
    window.addEventListener('resize', apply)
    return { root, body, setStatus: (s) => { status.textContent = s } }
  }

  toast(msg: string, kind: 'ok' | 'warn' | 'bad' = 'ok', ms = 4000): void {
    const t = el('div', `toast ${kind}`, msg)
    this.toasts.appendChild(t)
    setTimeout(() => t.remove(), ms)
  }
}

export function emptyState(title: string, text: string): HTMLElement {
  const e = el('div', 'empty')
  e.append(el('div', 'empty-title', title), el('div', 'empty-text', text))
  return e
}

export function row(label: string, control: HTMLElement, tip?: string): HTMLElement {
  const r = el('div', 'row')
  const l = el('label', undefined, label); if (tip) r.title = tip
  r.append(l, control)
  return r
}
