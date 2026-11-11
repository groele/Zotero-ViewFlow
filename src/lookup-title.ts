/** Rebuild Zotero title markup using only inert inline typography elements. */
export function renderLookupTitle(target: HTMLElement, title: string): void {
    const doc = target.ownerDocument;
    const Parser = doc?.defaultView?.DOMParser;
    target.textContent = '';
    if (!doc || !Parser) { target.textContent = title.replace(/<[^>]*>/g, ''); return; }
    const parsed = new Parser().parseFromString(title, 'text/html');
    const allowed = new Set(['sub', 'sup', 'i', 'b', 'em', 'strong', 'span']);
    const append = (source: Node, parent: Node) => {
        if (source.nodeType === 3) {
            parent.appendChild(doc.createTextNode(source.textContent || ''));
            return;
        }
        if (source.nodeType !== 1) return;
        const tag = (source as Element).localName;
        if (['script', 'style', 'iframe', 'object'].includes(tag)) return;
        const next: Node = allowed.has(tag) ? doc.createElementNS('http://www.w3.org/1999/xhtml', tag) : parent;
        if (next !== parent) parent.appendChild(next);
        for (const child of Array.from(source.childNodes)) if (child) append(child, next);
    };
    for (const child of Array.from(parsed.body.childNodes) as Node[]) append(child, target);
}
