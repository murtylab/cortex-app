export const CANVAS_WIDTH = 1200;
export const MIN_CHART_WIDTH = 240;
export const MIN_CHART_HEIGHT = 220;

export function canvasRect(card, index = 0) {
  return {
    x: card.x ?? 24 + (index % 2) * 576,
    y: card.y ?? 24 + Math.floor(index / 2) * 500,
    w: card.w ?? (card.width === 'full' ? 1152 : 552),
    h: card.h ?? 460,
  };
}

export function constrainRect(rect) {
  const w = Math.max(MIN_CHART_WIDTH, Math.min(CANVAS_WIDTH, rect.w));
  return {
    x: Math.max(0, Math.min(CANVAS_WIDTH - w, rect.x)),
    y: Math.max(0, rect.y), w,
    h: Math.max(MIN_CHART_HEIGHT, rect.h),
  };
}

export function transformRect(rect, dx, dy, action, snap = false) {
  const align = (value) => snap ? Math.round(value / 8) * 8 : Math.round(value);
  if (action === 'move') return constrainRect({ ...rect, x: align(rect.x + dx), y: align(rect.y + dy) });
  return constrainRect({ ...rect, w: align(rect.w + dx), h: align(rect.h + dy) });
}
