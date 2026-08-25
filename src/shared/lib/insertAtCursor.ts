/**
 * Splices `insertion` into a textarea/input's current value at the caret position (or over the
 * current selection), then restores focus with the caret placed right after the inserted text.
 */
export function insertAtCursor(
  el: HTMLTextAreaElement | HTMLInputElement,
  currentValue: string,
  insertion: string,
  onChange: (next: string) => void
) {
  const start = el.selectionStart ?? currentValue.length;
  const end = el.selectionEnd ?? currentValue.length;
  onChange(currentValue.slice(0, start) + insertion + currentValue.slice(end));

  requestAnimationFrame(() => {
    const caret = start + insertion.length;
    el.focus();
    el.setSelectionRange(caret, caret);
  });
}
