export const CHAR_PX = 8;
export const HEADER_H = 28;
export const ROW_H = 22;
export const ROW_LIMIT = 8;

export function textPx(text: string): number {
  return Math.ceil(text.length * CHAR_PX);
}
