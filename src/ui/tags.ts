export type MarkKind = 'quest' | 'deliver' | null;

export class Tag {
  readonly el = document.createElement('div');
  private label = document.createElement('div');
  private mark = document.createElement('div');
  private bubbleEl: HTMLDivElement | null = null;
  private bubbleTimer = 0;
  private markKind: MarkKind = null;
  private shown = true;

  constructor(parent: HTMLElement, name: string, sub: string, cls = '') {
    this.el.className = 'anchor';
    this.el.style.display = 'flex';
    this.el.style.flexDirection = 'column';
    this.el.style.alignItems = 'center';
    this.label.className = `label ${cls}`;
    this.mark.className = 'mark';
    this.mark.style.display = 'none';
    this.el.append(this.mark, this.label);
    this.setText(name, sub);
    parent.append(this.el);
  }

  setText(name: string, sub: string) {
    this.label.innerHTML = `${name.replace(/</g, '&lt;')}${sub ? `<span class="sub">${sub.replace(/</g, '&lt;')}</span>` : ''}`;
  }

  setMark(kind: MarkKind) {
    if (kind === this.markKind) return;
    this.markKind = kind;
    this.mark.style.display = kind ? '' : 'none';
    this.mark.className = `mark ${kind === 'deliver' ? 'deliver' : ''}`;
    this.mark.textContent = kind === 'deliver' ? '✉' : '!';
  }

  bubble(text: string, ms = 2800) {
    this.bubbleEl?.remove();
    clearTimeout(this.bubbleTimer);
    const b = document.createElement('div');
    b.className = 'bubble';
    b.textContent = text;
    b.style.marginBottom = '10px';
    this.el.prepend(b);
    this.bubbleEl = b;
    this.bubbleTimer = window.setTimeout(() => {
      b.classList.add('out');
      setTimeout(() => b.remove(), 220);
      if (this.bubbleEl === b) this.bubbleEl = null;
    }, ms);
  }

  place(x: number, y: number, visible: boolean, scale = 1) {
    if (!visible) {
      if (this.shown) {
        this.el.style.display = 'none';
        this.shown = false;
      }
      return;
    }
    if (!this.shown) {
      this.el.style.display = 'flex';
      this.shown = true;
    }
    this.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
  }

  remove() {
    this.el.remove();
  }
}
