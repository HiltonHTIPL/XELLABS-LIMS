# XelLabs LIMS — UI Glitches Log

> Every UI bug found, its root cause, and the fix pattern.
> **Before building any dropdown, tooltip, popover, or floating element — read this file.**

---

## Rule: Never Use `position: absolute` for Dropdowns Inside `overflow-hidden` Containers

### Symptom
Dropdown menus (three-dot action menus, select popovers, tooltips) appear clipped or partially hidden — only the top portion is visible, cut off by the parent container.

### Root Cause
Any element with `position: absolute` is clipped by the nearest ancestor that has `overflow: hidden` (or `overflow-x/y: hidden`). Table wrappers, card containers, and scrollable panels commonly use `overflow-hidden` for rounded corners or scroll containment — this silently clips all absolutely-positioned children.

In this project: the clients table wrapper uses `overflow-hidden` for rounded corners (`rounded-xl overflow-hidden`). The `ActionsMenu` dropdown used `position: absolute`, so it was clipped at the table boundary.

### Fix Pattern — Always Use `position: fixed` + `getBoundingClientRect()`

```tsx
// ✅ CORRECT — escapes overflow containers
const btnRef = useRef<HTMLButtonElement>(null)
const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null)

function handleOpen() {
  if (!btnRef.current) return
  const rect = btnRef.current.getBoundingClientRect()
  setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
  setOpen(o => !o)
}

// In JSX:
<button ref={btnRef} onClick={handleOpen}>…</button>
{open && menuPos && (
  <div style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, zIndex: 9999 }}>
    {/* menu items */}
  </div>
)}
```

```tsx
// ❌ WRONG — gets clipped by overflow-hidden parents
<div style={{ position: 'relative' }}>
  <button onClick={() => setOpen(true)}>…</button>
  {open && (
    <div style={{ position: 'absolute', right: 0, top: '100%' }}>
      {/* clipped! */}
    </div>
  )}
</div>
```

### Dismiss on Outside Click

With `position: fixed`, the menu sits outside the component's DOM subtree in visual terms, but the ref is still valid. Use two refs — one for the trigger button, one for the menu panel:

```tsx
useEffect(() => {
  function handler(e: MouseEvent) {
    if (
      btnRef.current && !btnRef.current.contains(e.target as Node) &&
      menuRef.current && !menuRef.current.contains(e.target as Node)
    ) setOpen(false)
  }
  document.addEventListener('mousedown', handler)
  return () => document.removeEventListener('mousedown', handler)
}, [])
```

### Files Fixed

| File | Date | What was fixed |
|---|---|---|
| `xellabs-frontend/app/dashboard/clients/_components/ClientsShell.tsx` | 2026-07-01 | `ActionsMenu` dropdown changed from `position: absolute` to `position: fixed` with `getBoundingClientRect()` |

---

## General Rules for Floating UI Elements

| Element type | Rule |
|---|---|
| Dropdown menus | Always `position: fixed` + `getBoundingClientRect()` |
| Tooltips | Always `position: fixed` + `getBoundingClientRect()` |
| Popovers | Always `position: fixed` + `getBoundingClientRect()` |
| Modals / drawers | `position: fixed` with `inset: 0` — these are fine |
| Toast notifications | `position: fixed` with `bottom/right` offsets — these are fine |

**Never** use `position: absolute` for any element that floats above other content unless you are certain the entire ancestor chain has no `overflow: hidden`.

---

## Other UI Glitches

_(Add new entries here as they are found and fixed)_

| # | Page | Symptom | Root Cause | Fix | Date |
|---|---|---|---|---|---|
| 1 | Clients | Three-dot action menu clipped at table bottom | `overflow-hidden` on table wrapper clipping `position: absolute` dropdown | Changed to `position: fixed` + `getBoundingClientRect()` | 2026-07-01 |
