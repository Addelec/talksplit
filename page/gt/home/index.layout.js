import * as ui from "@zos/ui";
import { getDeviceInfo } from "@zos/device";

export const COLORS = {
  background: 0x000000,
  text: 0xf5f5f7,
  muted: 0x929298,
  disabled: 0x606066,
  brand: 0xd6ec82,
  green: 0x62d995,
  red: 0xff6b75,
  button: 0x252529,
};

/**
 * Scales widget positions to the available display area.
 */
export function createLayout(round) {
  const { width, height } = getDeviceInfo();
  const size = Math.min(width, height);
  const left = (width - size) / 2;
  const top = (height - size) / 2;
  const text = (y, h, fontSize, inset = 0.1, color = COLORS.text) => ({
    x: Math.round(left + size * inset),
    y: Math.round(top + size * y),
    w: Math.round(size * (1 - inset * 2)),
    h: Math.round(size * h),
    text_size: Math.round(size * fontSize),
    color,
    align_h: ui.align.CENTER_H,
    align_v: ui.align.CENTER_V,
    text_style: ui.text_style.NONE,
  });
  return {
    background: { x: 0, y: 0, w: width, h: height, color: COLORS.background },
    clock: text(round ? 0.06 : 0.045, 0.12, 0.10, 0.27),
    elapsed: text(0.185, 0.075, 0.052, 0.15, COLORS.muted),
    chapter: {
      ...text(0.295, 0.17, 0.076, 0.09),
      text_style: ui.text_style.WRAP,
    },
    remaining: text(0.475, 0.205, 0.18, 0.07),
    delta: text(0.70, 0.085, 0.067, 0.16, COLORS.green),
    appName: text(0.16, 0.13, 0.09, 0.15, COLORS.brand),
    planFooter: text(0.73, 0.10, 0.043, 0.14, COLORS.muted),
    syncButton: {
      x: Math.round(left + size * 0.20), y: Math.round(top + size * 0.55),
      w: Math.round(size * 0.60), h: Math.round(size * 0.13),
      radius: Math.round(size * 0.065),
      text_size: Math.round(size * 0.055), color: COLORS.text,
      normal_color: COLORS.button, press_color: 0x3a3a40,
    },
    startButton: {
      x: Math.round(left + size * 0.20), y: Math.round(top + size * 0.36),
      w: Math.round(size * 0.60), h: Math.round(size * 0.13),
      radius: Math.round(size * 0.065),
      text_size: Math.round(size * 0.055), color: COLORS.text,
      normal_color: COLORS.button, press_color: 0x3a3a40,
    },
    button: {
      x: Math.round(left + size * 0.26),
      y: Math.round(top + size * 0.815),
      w: Math.round(size * 0.48),
      h: Math.round(size * 0.115),
      radius: Math.round(size * 0.0575),
      text_size: Math.round(size * 0.052),
      color: COLORS.text,
      normal_color: COLORS.button,
      press_color: 0x3a3a40,
    },
  };
}
