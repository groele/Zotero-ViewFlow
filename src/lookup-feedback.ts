/** Updates a localized status and removes stale Fluent arguments. */
export const setLookupMessage = (el: Element, id: string, fallback: string, args?: Record<string, unknown>) => {
		el.setAttribute('data-l10n-id', id);
		if (args) el.setAttribute('data-l10n-args', JSON.stringify(args));
		else el.removeAttribute('data-l10n-args');
		el.textContent = fallback;
	};

/** Remove the complete result tree, including stale Fluent translation hooks. */
export function clearLookupResult(element: HTMLElement): void {
    element.removeAttribute('data-l10n-id');
    element.removeAttribute('data-l10n-args');
    element.innerHTML = '';
}
