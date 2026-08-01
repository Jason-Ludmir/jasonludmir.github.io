"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TOTAL_STEPS = 6;
const RUN_TIME_MS = 12_000;
const COLS = 12;
const ROWS = 6;
const STOPS = [0, 2, 3, 5, 6];

type Point = { x: number; y: number };
type NodeKind = "L" | "R" | "X" | "Z";

const colors = {
  blue: "#59a7ff",
  amber: "#ffbd66",
  pink: "#ff6e9f",
  green: "#32d6ad",
  cyan: "#6df3ff",
  violet: "#ae74ff",
};

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));
const ease = (value: number) => 1 - Math.pow(1 - clamp(value), 3);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixPoint = (a: Point, b: Point, t: number): Point => ({
  x: mix(a.x, b.x, t),
  y: mix(a.y, b.y, t),
});

function phaseForStep(step: number) {
  if (step < 2) {
    return {
      number: "01",
      label: "First routing layer",
      description: "144 data states move into the check-qubit layer.",
    };
  }
  if (step < 3) {
    return {
      number: "02",
      label: "Reset",
      description: "The first 144 ancilla-assisted SWAPs are complete.",
    };
  }
  if (step < 5) {
    return {
      number: "03",
      label: "Second routing layer",
      description: "144 states move into their shifted data positions.",
    };
  }
  if (step < 6) {
    return {
      number: "04",
      label: "Shift complete",
      description: "The global toric permutation has reached its target.",
    };
  }
  return {
    number: "04",
    label: "Shift complete",
    description: "288 SWAPs. 576 two-qubit gates. Six physical timesteps.",
  };
}

function drawShift(canvas: HTMLCanvasElement, step: number) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
  const pixelHeight = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);

  const padX = Math.max(24, width * 0.04);
  const padY = Math.max(22, height * 0.07);
  const areaW = width - padX * 2;
  const areaH = height - padY * 2;
  const cellW = areaW / COLS;
  const cellH = areaH / ROWS;
  const radius = clamp(Math.min(cellW, cellH) * 0.13, 2.2, 6.2);

  const node = (column: number, row: number, kind: NodeKind): Point => {
    const c = ((column % COLS) + COLS) % COLS;
    const r = ((row % ROWS) + ROWS) % ROWS;
    const cx = padX + c * cellW + cellW / 2;
    const cy = padY + r * cellH + cellH / 2;
    const ox = cellW * 0.2;
    const oy = cellH * 0.21;
    const offsets: Record<NodeKind, Point> = {
      X: { x: -ox, y: -oy },
      R: { x: ox, y: -oy },
      Z: { x: -ox, y: oy },
      L: { x: ox, y: oy },
    };
    return { x: cx + offsets[kind].x, y: cy + offsets[kind].y };
  };

  const line = (
    start: Point,
    end: Point,
    color: string,
    alpha: number,
    lineWidth: number,
    glow = 0,
  ) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const bend = Math.min(20, Math.hypot(dx, dy) * 0.075);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(
      (start.x + end.x) / 2 -
        (dy / (Math.abs(dx) + Math.abs(dy) + 1)) * bend,
      (start.y + end.y) / 2 +
        (dx / (Math.abs(dx) + Math.abs(dy) + 1)) * bend,
      end.x,
      end.y,
    );
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = lineWidth;
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
    ctx.stroke();
    ctx.restore();
  };

  // Unit-cell grid.
  ctx.save();
  ctx.strokeStyle = "rgba(126, 160, 190, .08)";
  ctx.lineWidth = 1;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(padX + c * cellW, padY);
    ctx.lineTo(padX + c * cellW, padY + areaH);
    ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(padX, padY + r * cellH);
    ctx.lineTo(padX + areaW, padY + r * cellH);
    ctx.stroke();
  }
  ctx.restore();

  // Dormant fixed-coupler network.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      line(node(c, r, "X"), node(c, r, "L"), "#71859a", 0.115, 0.7);
      line(node(c, r, "Z"), node(c, r, "R"), "#71859a", 0.115, 0.7);
      line(node(c, r, "X"), node(c, r, "R"), "#71859a", 0.065, 0.65);
      line(node(c, r, "Z"), node(c, r, "L"), "#71859a", 0.065, 0.65);
      if ((c + r) % 2 === 0) {
        line(
          node(c, r, "X"),
          node(c + 3, r - 1, "L"),
          "#53677b",
          0.045,
          0.65,
        );
        line(
          node(c, r, "Z"),
          node(c + 3, r - 1, "R"),
          "#53677b",
          0.045,
          0.65,
        );
      }
    }
  }

  const firstMotion = ease(step / 2);
  const secondMotion = ease((step - 3) / 2);
  const firstActive = step < 2;
  const secondActive = step >= 3 && step < 5;
  const pulse = 0.22 + 0.1 * Math.sin(performance.now() / 180);

  if (firstActive || secondActive) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (firstActive) {
          line(node(c, r, "L"), node(c, r, "X"), colors.cyan, pulse, 1.1, 7);
          line(node(c, r, "R"), node(c, r, "Z"), colors.cyan, pulse, 1.1, 7);
        } else {
          line(
            node(c, r, "X"),
            node(c + 3, r - 1, "L"),
            colors.cyan,
            pulse,
            1.1,
            8,
          );
          line(
            node(c, r, "Z"),
            node(c + 3, r - 1, "R"),
            colors.cyan,
            pulse,
            1.1,
            8,
          );
        }
      }
    }
  }

  // Fixed physical sites.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      (["X", "R", "Z", "L"] as NodeKind[]).forEach((kind) => {
        const point = node(c, r, kind);
        const isCheck = kind === "X" || kind === "Z";
        const color =
          kind === "L"
            ? colors.blue
            : kind === "R"
              ? colors.amber
              : kind === "X"
                ? colors.pink
                : colors.green;
        ctx.save();
        ctx.globalAlpha = 0.92;
        ctx.fillStyle = color;
        if (isCheck) {
          const size = radius * 1.65;
          ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size);
        } else {
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
    }
  }

  // White state tokens move; hardware stays fixed.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      (["L", "R"] as NodeKind[]).forEach((kind) => {
        const checkKind: NodeKind = kind === "L" ? "X" : "Z";
        const start = node(c, r, kind);
        const via = node(c, r, checkKind);
        const target = node(c + 3, r - 1, kind);
        let point = start;
        if (step < 3) point = mixPoint(start, via, firstMotion);
        else if (step < 6) point = mixPoint(via, target, secondMotion);
        else point = target;
        ctx.save();
        ctx.beginPath();
        ctx.arc(point.x, point.y, Math.max(1.5, radius * 0.4), 0, Math.PI * 2);
        ctx.fillStyle = "#fbfeff";
        ctx.shadowColor = colors.cyan;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
      });
    }
  }

  ctx.save();
  ctx.strokeStyle = "rgba(142, 175, 202, .26)";
  ctx.strokeRect(padX - 8, padY - 8, areaW + 16, areaH + 16);
  ctx.fillStyle = "rgba(186, 211, 231, .56)";
  ctx.font = "500 9px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText("TORIC MODULE · 12 × 6 UNIT CELLS · 288 PHYSICAL SITES", padX, padY - 17);
  ctx.restore();
}

function drawAodShift(canvas: HTMLCanvasElement, progress: number) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
  const pixelHeight = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);

  const padX = Math.max(60, width * 0.1);
  const padTop = Math.max(58, height * 0.16);
  const padBottom = Math.max(38, height * 0.08);
  const areaW = width - padX * 2;
  const areaH = height - padTop - padBottom;
  const cellW = areaW / COLS;
  const cellH = areaH / ROWS;
  const radius = clamp(Math.min(cellW, cellH) * 0.12, 2.2, 6.4);
  const phase = progress * 5;
  const horizontalT = ease((phase - 0.35) / 1.35);
  const verticalT = ease((phase - 1.95) / 1.25);
  const resyncT = ease((phase - 3.45) / 1.15);
  const horizontalActive = phase < 1.9;
  const verticalActive = phase >= 1.9 && phase < 3.45;
  const resyncActive = phase >= 3.45;
  const pulse = 0.45 + 0.25 * Math.sin(performance.now() / 170);

  const atom = (column: number, row: number, side: 0 | 1): Point => ({
    x: padX + column * cellW + cellW * (side === 0 ? 0.36 : 0.64),
    y: padTop + row * cellH + cellH / 2,
  });

  const horizontalPoint = (column: number, row: number, side: 0 | 1) => {
    const start = atom(column, row, side);
    if (column < 9) return start;
    const target = atom(column - 9, row, side);
    const lift = Math.sin(horizontalT * Math.PI) * Math.min(42, cellH * 0.85);
    return {
      x: mix(start.x, target.x, horizontalT),
      y: mix(start.y, target.y, horizontalT) - lift,
    };
  };

  const afterHorizontal = (column: number, row: number, side: 0 | 1) =>
    atom(column >= 9 ? column - 9 : column, row, side);

  const verticalPoint = (column: number, row: number, side: 0 | 1) => {
    const start = afterHorizontal(column, row, side);
    if (row !== 0) return start;
    const target = afterHorizontal(column, ROWS - 1, side);
    const bow = Math.sin(verticalT * Math.PI) * Math.min(44, cellW * 0.72);
    return {
      x: mix(start.x, target.x, verticalT) + bow,
      y: mix(start.y, target.y, verticalT),
    };
  };

  const afterVertical = (column: number, row: number, side: 0 | 1) =>
    afterHorizontal(column, row === 0 ? ROWS - 1 : row, side);

  // Each roll leaves a small physical module offset. Keep both offsets until
  // the final monotone resynchronization instead of snapping atoms back.
  const resyncScale = resyncActive ? 1 - resyncT : 1;
  const moduleOffset = {
    x: horizontalT * 10 * resyncScale,
    y: verticalT * -7 * resyncScale,
  };

  // SLM lattice.
  ctx.save();
  ctx.strokeStyle = "rgba(104, 182, 157, .13)";
  ctx.lineWidth = 1;
  for (let c = 0; c <= COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(padX + c * cellW, padTop);
    ctx.lineTo(padX + c * cellW, padTop + areaH);
    ctx.stroke();
  }
  for (let r = 0; r <= ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(padX, padTop + r * cellH);
    ctx.lineTo(padX + areaW, padTop + r * cellH);
    ctx.stroke();
  }
  ctx.restore();

  // Faint stationary reference controls.
  for (let c = 0; c < COLS; c++) {
    const x = padX + c * cellW + cellW / 2;
    ctx.save();
    ctx.strokeStyle = "rgba(109, 243, 255, .055)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(x, padTop - 34);
    ctx.lineTo(x, padTop + areaH + 7);
    ctx.stroke();
    ctx.fillStyle = "rgba(109, 243, 255, .22)";
    ctx.beginPath();
    ctx.arc(x, padTop - 38, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (horizontalActive) {
    const lift = Math.sin(horizontalT * Math.PI) * Math.min(42, cellH * 0.85);
    for (let c = 9; c < COLS; c++) {
      const startX = padX + c * cellW + cellW / 2;
      const targetX = padX + (c - 9) * cellW + cellW / 2;
      const x = mix(startX, targetX, horizontalT) + moduleOffset.x;
      const yOffset = -lift + moduleOffset.y;
      ctx.save();
      ctx.strokeStyle = `rgba(109, 243, 255, ${pulse})`;
      ctx.lineWidth = 1.35;
      ctx.shadowColor = colors.cyan;
      ctx.shadowBlur = 9;
      ctx.beginPath();
      ctx.moveTo(x, padTop - 34 + yOffset);
      ctx.lineTo(x, padTop + areaH + 7 + yOffset);
      ctx.stroke();
      ctx.fillStyle = colors.cyan;
      ctx.beginPath();
      ctx.arc(x, padTop - 38 + yOffset, 3.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const stripX = mix(padX + 9 * cellW, padX, horizontalT) + moduleOffset.x;
    ctx.save();
    ctx.fillStyle = `rgba(109, 243, 255, ${0.05 + pulse * 0.07})`;
    ctx.fillRect(stripX, padTop - lift + moduleOffset.y, 3 * cellW, areaH);
    ctx.restore();
  }
  if (verticalActive) {
    const startY = padTop + cellH / 2;
    const targetY = padTop + (ROWS - 1) * cellH + cellH / 2;
    const bow = Math.sin(verticalT * Math.PI) * Math.min(44, cellW * 0.72);
    const railX = padX + bow + moduleOffset.x;
    const railY = mix(startY, targetY, verticalT) + moduleOffset.y;
    ctx.save();
    ctx.fillStyle = `rgba(174, 116, 255, ${0.08 + pulse * 0.08})`;
    ctx.fillRect(railX, railY - cellH / 2, areaW, cellH);
    ctx.strokeStyle = `rgba(174, 116, 255, ${pulse})`;
    ctx.lineWidth = 1.35;
    ctx.shadowColor = colors.violet;
    ctx.shadowBlur = 9;
    ctx.beginPath();
    ctx.moveTo(railX - 8, railY);
    ctx.lineTo(railX + areaW + 8, railY);
    ctx.stroke();
    ctx.restore();
  }

  // During resynchronization the complete captured module and its AOD frame
  // translate together until the atoms are dropped back into SLM traps.
  if (resyncActive && resyncT < 1) {
    ctx.save();
    ctx.translate(moduleOffset.x, moduleOffset.y);
    ctx.strokeStyle = `rgba(109, 243, 255, ${0.18 + (1 - resyncT) * 0.28})`;
    ctx.lineWidth = 1;
    ctx.shadowColor = colors.cyan;
    ctx.shadowBlur = 7;
    ctx.strokeRect(padX - 4, padTop - 4, areaW + 8, areaH + 8);
    ctx.restore();
  }

  // Static atoms. Selected wrap strips lift from SLM into AOD transport.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const side of [0, 1] as const) {
        const selectedHorizontal = c >= 9 && horizontalActive;
        const selectedVertical = r === 0 && verticalActive;
        let point = horizontalActive
          ? horizontalPoint(c, r, side)
          : verticalActive
            ? verticalPoint(c, r, side)
            : afterVertical(c, r, side);
        let alpha = 0.93;

        point = {
          x: point.x + moduleOffset.x,
          y: point.y + moduleOffset.y,
        };

        if (
          (c < 3 && horizontalT > 0.72) ||
          (r === ROWS - 1 && verticalT > 0.72)
        ) {
          alpha = 0.23;
        }

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = side === 0 ? colors.blue : colors.amber;
        ctx.shadowColor = selectedHorizontal || selectedVertical ? colors.cyan : "transparent";
        ctx.shadowBlur = selectedHorizontal || selectedVertical ? 9 : 0;
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // Trap-change/drop flash.
  if (resyncActive) {
    for (let c = 0; c < COLS; c++) {
      const x = padX + c * cellW + cellW / 2;
      ctx.save();
      ctx.globalAlpha = 0.15 + resyncT * 0.32;
      ctx.fillStyle = colors.green;
      ctx.shadowColor = colors.green;
      ctx.shadowBlur = 10;
      ctx.fillRect(x - 1, padTop - 3, 2, areaH + 6);
      ctx.restore();
    }
  }

  ctx.save();
  ctx.strokeStyle = "rgba(132, 188, 174, .34)";
  ctx.strokeRect(padX - 9, padTop - 9, areaW + 18, areaH + 18);
  ctx.fillStyle = "rgba(194, 230, 220, .64)";
  ctx.font = "500 9px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText("SLM STORAGE LATTICE · 144 DATA ATOMS", padX, padTop - 48);
  ctx.textAlign = "right";
  ctx.fillText(
    horizontalActive
      ? "AOD CAPTURE · 3-COLUMN WRAP STRIP"
      : verticalActive
        ? "AOD CAPTURE · 1-ROW WRAP STRIP"
        : "MONOTONE RESYNC · DROP TO SLM",
    padX + areaW,
    padTop - 48,
  );
  ctx.restore();
}

function drawParallelAod(canvas: HTMLCanvasElement, progress: number) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
  const pixelHeight = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);

  const modules = [
    { name: "M0", dx: 1, dy: 1, color: colors.blue },
    { name: "M1", dx: 2, dy: 1, color: colors.green },
    { name: "M2", dx: 3, dy: 2, color: colors.amber },
  ];
  const phase = progress * 5;
  const padX = Math.max(95, width * 0.14);
  const gap = Math.max(14, height * 0.025);
  const top = Math.max(26, height * 0.055);
  const moduleH = (height - top * 2 - gap * 2) / 3;
  const moduleW = width - padX * 2;
  const rollX = ease((phase - 0.25) / 1.15);
  const rollY = ease((phase - 1.45) / 1.1);
  const pulse = 0.36 + 0.2 * Math.sin(performance.now() / 175);

  ctx.save();
  ctx.fillStyle = "rgba(192, 224, 214, .56)";
  ctx.font = "500 9px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText("ONE COMPUTE COLUMN · SHARED +X / +Y AOD DIRECTIONS", padX, top - 13);
  ctx.restore();

  modules.forEach((module, index) => {
    const baseY = top + index * (moduleH + gap);
    const dropStart = 3.15 + index * 0.48;
    const dropT = ease((phase - dropStart) / 0.48);
    const frameX = padX;
    const frameY = baseY;
    const moduleOffsetX = module.dx * 7 * rollX * (1 - dropT);
    const moduleOffsetY = module.dy * 4 * rollY * (1 - dropT);
    const cellW = moduleW / COLS;
    const cellH = moduleH / ROWS;
    const radius = clamp(Math.min(cellW, cellH) * 0.12, 1.2, 3.1);
    const status =
      phase < 1.4
        ? "ROLL X"
        : phase < 2.65
          ? "ROLL Y"
          : dropT >= 1
            ? "DROPPED TO SLM"
            : "MONOTONE RESYNC";

    ctx.save();
    ctx.fillStyle = dropT >= 1 ? "rgba(50, 214, 173, .055)" : "rgba(12, 28, 39, .7)";
    ctx.strokeStyle = dropT >= 1 ? "rgba(50, 214, 173, .48)" : "rgba(128, 170, 195, .22)";
    ctx.lineWidth = 1;
    ctx.fillRect(frameX - 8, frameY - 5, moduleW + 16, moduleH + 10);
    ctx.strokeRect(frameX - 8, frameY - 5, moduleW + 16, moduleH + 10);
    ctx.restore();

    // Reference AOD columns remain faint while active guides travel with atoms.
    for (let c = 0; c < COLS; c++) {
      const selected = c >= COLS - module.dx;
      const baseBeamX = frameX + c * cellW + cellW / 2;
      ctx.save();
      ctx.strokeStyle = "rgba(109, 243, 255, .045)";
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.moveTo(baseBeamX, frameY);
      ctx.lineTo(baseBeamX, frameY + moduleH);
      ctx.stroke();
      ctx.restore();

      if (phase < 1.4 && selected) {
        const wrapX = -rollX * (COLS - module.dx) * cellW;
        const beamX = baseBeamX + wrapX + moduleOffsetX;
        ctx.save();
        ctx.strokeStyle = `rgba(109, 243, 255, ${pulse})`;
        ctx.lineWidth = 1.1;
        ctx.shadowColor = colors.cyan;
        ctx.shadowBlur = 7;
        ctx.beginPath();
        ctx.moveTo(beamX, frameY + moduleOffsetY);
        ctx.lineTo(beamX, frameY + moduleH + moduleOffsetY);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (phase >= 1.4 && phase < 2.65) {
      for (let r = 0; r < module.dy; r++) {
        const wrapY = rollY * (ROWS - module.dy) * cellH;
        const railY = frameY + r * cellH + cellH / 2 + wrapY + moduleOffsetY;
        ctx.save();
        ctx.strokeStyle = `rgba(174, 116, 255, ${pulse})`;
        ctx.lineWidth = 1.1;
        ctx.shadowColor = colors.violet;
        ctx.shadowBlur = 7;
        ctx.beginPath();
        ctx.moveTo(frameX + moduleOffsetX, railY);
        ctx.lineTo(frameX + moduleW + moduleOffsetX, railY);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (phase >= 2.65 && dropT < 1) {
      ctx.save();
      ctx.translate(moduleOffsetX, moduleOffsetY);
      ctx.strokeStyle = `rgba(109, 243, 255, ${0.15 + (1 - dropT) * 0.25})`;
      ctx.lineWidth = 0.9;
      ctx.shadowColor = colors.cyan;
      ctx.shadowBlur = 6;
      ctx.strokeRect(frameX - 3, frameY - 2, moduleW + 6, moduleH + 4);
      ctx.restore();
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const xRollOffset =
          c >= COLS - module.dx
            ? -rollX * (COLS - module.dx) * cellW
            : 0;
        const yRollOffset =
          r < module.dy
            ? rollY * (ROWS - module.dy) * cellH
            : 0;
        for (const side of [0, 1] as const) {
          const atomX =
            frameX +
            c * cellW +
            cellW * (side === 0 ? 0.36 : 0.64) +
            xRollOffset +
            moduleOffsetX;
          const atomY =
            frameY + r * cellH + cellH / 2 + yRollOffset + moduleOffsetY;
          ctx.save();
          ctx.fillStyle = side === 0 ? module.color : colors.pink;
          ctx.globalAlpha = 0.82;
          ctx.beginPath();
          ctx.arc(atomX, atomY, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    ctx.save();
    ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillStyle = module.color;
    ctx.textAlign = "right";
    ctx.fillText(`${module.name}  δ=(+${module.dx},+${module.dy})`, frameX - 17, frameY + 18);
    ctx.fillStyle = dropT >= 1 ? colors.green : "rgba(177, 202, 220, .6)";
    ctx.font = "500 8px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(status, frameX - 17, frameY + 32);
    ctx.restore();
  });
}

function parkPhase(progress: number) {
  const phase = progress * 5;
  if (phase < 0.55) {
    return {
      number: "01",
      label: "Capture the wrap strip",
      description: "AOD traps pick up only the columns that cross the torus edge.",
    };
  }
  if (phase < 1.95) {
    return {
      number: "02",
      label: "Horizontal cyclic roll",
      description: "The selected strip wraps with its AOD traps and keeps its new position.",
    };
  }
  if (phase < 3.45) {
    return {
      number: "03",
      label: "Vertical cyclic roll",
      description: "The vertical roll starts from the horizontally shifted atom coordinates.",
    };
  }
  return {
    number: "04",
    label: "Resynchronize and drop",
    description: "Atoms align monotonically, then transfer back into SLM traps.",
  };
}

function parallelPhase(progress: number) {
  const phase = progress * 5;
  if (phase < 1.4) {
    return {
      number: "01",
      label: "Shared horizontal direction",
      description: "All three modules roll different-width strips in the same AOD direction.",
    };
  }
  if (phase < 2.65) {
    return {
      number: "02",
      label: "Shared vertical direction",
      description: "The second roll accumulates on the first while AOD traps remain attached.",
    };
  }
  if (phase < 3.2) {
    return {
      number: "03",
      label: "Residual offsets",
      description: "Different shift magnitudes leave the modules temporarily misaligned.",
    };
  }
  return {
    number: "04",
    label: "Staggered SLM drop-off",
    description: "A monotone sweep parks each module as soon as it reaches alignment.",
  };
}

export default function PresentPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const [screen, setScreen] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const step = progress * TOTAL_STEPS;
  const phase =
    screen === 0
      ? phaseForStep(step)
      : screen === 1
        ? parkPhase(progress)
        : parallelPhase(progress);

  const setBoundedProgress = useCallback((next: number) => {
    const bounded = clamp(next);
    progressRef.current = bounded;
    setProgress(bounded);
  }, []);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const tick = (time: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = time;
      const delta = time - lastTimeRef.current;
      lastTimeRef.current = time;
      if (playing) {
        const next = progressRef.current + delta / RUN_TIME_MS;
        if (next >= 1) {
          setBoundedProgress(1);
          setPlaying(false);
        } else {
          setBoundedProgress(next);
        }
      }
      if (canvasRef.current) {
        if (screen === 0) {
          drawShift(canvasRef.current, progressRef.current * TOTAL_STEPS);
        } else if (screen === 1) {
          drawAodShift(canvasRef.current, progressRef.current);
        } else {
          drawParallelAod(canvasRef.current, progressRef.current);
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      lastTimeRef.current = null;
    };
  }, [playing, screen, setBoundedProgress]);

  const replay = useCallback(() => {
    setBoundedProgress(0);
    setPlaying(true);
  }, [setBoundedProgress]);

  const changeScreen = useCallback(
    (nextScreen: number) => {
      const bounded = Math.max(0, Math.min(2, nextScreen));
      if (bounded === screen) return;
      setScreen(bounded);
      setBoundedProgress(0);
      setPlaying(true);
    },
    [screen, setBoundedProgress],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        changeScreen(screen + 1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        changeScreen(screen - 1);
      }
      if (event.key === " ") {
        event.preventDefault();
        if (progressRef.current >= 1) replay();
        else setPlaying((value) => !value);
      }
      if (event.key.toLowerCase() === "f") {
        if (!document.fullscreenElement) {
          void document.documentElement.requestFullscreen();
        } else {
          void document.exitFullscreen();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [changeScreen, replay, screen]);

  const cnotCount =
    step < 3
      ? Math.round(288 * clamp(step / 2))
      : 288 + Math.round(288 * clamp((step - 3) / 2));
  const swapCount =
    step < 3
      ? Math.round(144 * clamp(step / 2))
      : 144 + Math.round(144 * clamp((step - 3) / 2));
  const resetCount =
    Math.round(144 * clamp(step - 2)) +
    Math.round(144 * clamp(step - 5));
  const activeConnections =
    step < 2 || (step >= 3 && step < 5) ? 144 : 0;

  const parkAodPhases =
    progress < 0.11 ? 0 : progress < 0.69 ? 1 : 2;
  const parallelDrops = Math.round(3 * ease((progress * 5 - 3.15) / 1.45));

  const titles = [
    {
      kicker: "Fixed-coupler shift · δ = x³y⁻¹",
      title: "One global shift, in physical gates.",
      primaryLabel: "Two-qubit gates executed",
      primaryValue: cnotCount.toLocaleString(),
      primaryNote: "/ 576 CNOTs",
      costs: [
        ["SWAPs complete", swapCount.toString(), "/ 288"],
        ["Active connections", activeConnections.toString(), "parallel width"],
        ["Measure / reset", resetCount.toString(), "/ 288"],
        ["Physical timestep", Math.min(6, Math.floor(step) + 1).toString(), "/ 6"],
      ],
      timeline: ["Swap 01", "Reset", "Swap 02", "Done"],
      note: "Shift network only · syndrome cycle intentionally excluded",
    },
    {
      kicker: "Park ’n Ride · same logical δ = x³y⁻¹",
      title: "The same shift becomes atom transport.",
      primaryLabel: "Two-qubit gates executed",
      primaryValue: "0",
      primaryNote: "/ 576 avoided",
      costs: [
        ["SWAP gates", "0", "/ 288 avoided"],
        ["Readout", "0", "during shift"],
        ["AOD roll phases", parkAodPhases.toString(), "/ 2 + resync"],
        ["Data atoms", "144", "same gross code"],
      ],
      timeline: ["Capture", "Roll x", "Roll y", "Resync"],
      note: "Park-n-Ride Sec. IV-D · shift cost moves to transport and trap switching",
    },
    {
      kicker: "Park ’n Ride · one compute column",
      title: "Different shifts execute at the same time.",
      primaryLabel: "Shift automorphisms in flight",
      primaryValue: progress >= 1 ? "3" : progress > 0.04 ? "3" : "0",
      primaryNote: "/ 3 concurrent",
      costs: [
        ["Two-qubit gates", "0", "across all shifts"],
        ["AOD roll phases", progress < 0.29 ? "1" : "2", "shared directions"],
        ["Modules aligned", parallelDrops.toString(), "/ 3"],
        ["Compute columns", "1", "column-local"],
      ],
      timeline: ["Roll x", "Roll y", "Offsets", "Staggered SLM drop"],
      note: "Shared directions preserve AOD ordering · modules drop as they align",
    },
  ] as const;
  const current = titles[screen];
  const legends =
    screen === 0
      ? [
          ["legend-circle l", "L data"],
          ["legend-circle r", "R data"],
          ["legend-square x", "X check"],
          ["legend-square z", "Z check"],
          ["legend-line", "active two-qubit gate"],
          ["state-dot", "quantum state"],
        ]
      : [
          ["legend-circle l", "L atom"],
          ["legend-circle r", "R atom"],
          ["aod-line", "moving AOD traps"],
          ["slm-box", "SLM lattice"],
          ["state-dot", screen === 1 ? "captured wrap strip" : "module motion"],
        ];

  return (
    <main className={`present-shell screen-${screen}`}>
      <header className="present-header">
        <div className="present-title">
          <a href="/" aria-label="Return to full explainer">
            <span className="brand-mark" />
          </a>
          <div>
            <p>{current.kicker}</p>
            <h1>{current.title}</h1>
          </div>
        </div>
        <nav className="deck-tabs" aria-label="Presentation screens">
          {["Fixed couplers", "Park ’n Ride", "Parallel column"].map((label, index) => (
            <button
              key={label}
              className={screen === index ? "is-active" : ""}
              onClick={() => changeScreen(index)}
              aria-current={screen === index ? "page" : undefined}
            >
              <span>0{index + 1}</span>
              {label}
            </button>
          ))}
        </nav>
        <div className="present-phase">
          <span>{phase.number}</span>
          <div>
            <strong>{phase.label}</strong>
            <small>{phase.description}</small>
          </div>
        </div>
      </header>

      <section className="present-costs" aria-label="Live operation costs">
        <article className="primary-cost">
          <span>{current.primaryLabel}</span>
          <strong>{current.primaryValue}</strong>
          <small>{current.primaryNote}</small>
        </article>
        {current.costs.map(([label, value, note]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>

      <section className="present-stage">
        <canvas
          ref={canvasRef}
          className="present-canvas"
          aria-label={
            screen === 0
              ? "Animated fixed-coupler shift automorphism"
              : screen === 1
                ? "Animated Park-n-Ride AOD shift automorphism"
                : "Three Park-n-Ride modules shifting in parallel"
          }
        />
        <div className="present-legend" aria-hidden="true">
          {legends.map(([className, label]) => (
            <span key={label}><i className={className} />{label}</span>
          ))}
        </div>
        <div className="present-shift">
          <span>{screen === 2 ? "shared physical directions" : "global permutation"}</span>
          <strong>{screen === 2 ? "+x · +y" : "+3x · −1y"}</strong>
        </div>
        <button
          className="deck-edge deck-edge-left"
          onClick={() => changeScreen(screen - 1)}
          disabled={screen === 0}
          aria-label="Previous presentation screen"
        >
          ←
        </button>
        <button
          className="deck-edge deck-edge-right"
          onClick={() => changeScreen(screen + 1)}
          disabled={screen === 2}
          aria-label="Next presentation screen"
        >
          →
        </button>
      </section>

      <footer className="present-controls">
        <button
          className="present-play"
          onClick={() => {
            if (progress >= 1) replay();
            else setPlaying((value) => !value);
          }}
        >
          <span className={playing ? "pause-icon" : "play-icon"} />
          {progress >= 1 ? "Replay" : playing ? "Pause" : "Play"}
        </button>
        <div className="present-timeline">
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            style={{ "--timeline-progress": `${progress * 100}%` } as React.CSSProperties}
            aria-label="Shift timeline"
            onChange={(event) => {
              setPlaying(false);
              setBoundedProgress(Number(event.target.value));
            }}
          />
          <div aria-hidden="true">
            {current.timeline.map((label) => <span key={label}>{label}</span>)}
          </div>
        </div>
        <button
          className="fullscreen-button"
          onClick={() => {
            if (!document.fullscreenElement) {
              void document.documentElement.requestFullscreen();
            } else {
              void document.exitFullscreen();
            }
          }}
        >
          Fullscreen <kbd>F</kbd>
        </button>
        <p className="present-note">
          {current.note}
        </p>
      </footer>
    </main>
  );
}
