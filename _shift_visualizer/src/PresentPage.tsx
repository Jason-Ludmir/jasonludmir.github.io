"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TOTAL_STEPS = 6;
const RUN_TIME_MS = 12_000;
const COLS = 12;
const ROWS = 6;
const STOPS = [0, 2, 3, 5, 6];
const SLIDE_STOPS = [
  [0],
  [0, 0.28, 1],
  [0, 0.42, 0.68, 1],
  [0, 0.46, 0.7, 1],
  [0, 0.6, 0.72, 0.82, 0.92],
  [0, 0.22, 0.42, 0.62, 0.94],
  [0, 2 / 6, 3 / 6, 5 / 6, 1],
  [0, 0.34, 0.64, 0.92],
  [0, 0.28, 0.53, 0.918],
  [0, 0.32, 0.68, 1],
] as const;
const STEP_TRANSITION_MS = 720;

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

function connectivityPhase(progress: number) {
  if (progress <= 0.001) {
    return {
      number: "01",
      label: "Fixed versus reconfigurable connectivity",
      description: "Superconducting couplers are fabricated in place; neutral-atom interactions follow position.",
    };
  }
  if (progress <= 0.281) {
    return {
      number: "02",
      label: "Bring the AOD column to the middle",
      description: "Three transported atoms enter Rydberg range of three atoms in the stationary middle column.",
    };
  }
  return {
    number: "03",
    label: "Move directly to the right column",
    description: "The same transported qubits form a different set of interactions without fixed couplers.",
  };
}

function drawConnectivityIntro(canvas: HTMLCanvasElement, progress: number) {
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

  const inset = clamp(width * 0.06, 56, 92);
  const gap = clamp(width * 0.025, 24, 40);
  const panelY = 14;
  const panelH = height - 28;
  const panelW = (width - inset * 2 - gap) / 2;
  const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 220);
  const middleT = ease(progress / 0.28);
  const rightT = ease((progress - 0.28) / 0.72);
  const middleStrength = progress <= 0.28 ? middleT : 1 - rightT;
  const rightStrength = rightT;

  const roundRect = (x: number, y: number, w: number, h: number, r = 14) => {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  };
  const panel = (x: number, accent: string) => {
    ctx.save(); roundRect(x, panelY, panelW, panelH);
    ctx.fillStyle = "rgba(8,21,32,.72)"; ctx.fill();
    ctx.globalAlpha = 0.22; ctx.strokeStyle = accent; ctx.stroke(); ctx.restore();
  };
  const mono = (text: string, x: number, y: number, size = 9, color = "rgba(190,211,225,.72)", align: CanvasTextAlign = "left") => {
    ctx.save(); ctx.textAlign = align; ctx.fillStyle = color;
    ctx.font = `600 ${size * 1.08}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillText(text, x, y); ctx.restore();
  };
  const node = (x: number, y: number, color: string, radius = 6, alpha = 1) => {
    ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = "#0a1822"; ctx.strokeStyle = color; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
  };
  const edge = (a: Point, b: Point, color: string, alpha = 1, widthPx = 1.4) => {
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = widthPx;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
  };
  const subpanel = (x: number, y: number, w: number, h: number, label: string) => {
    ctx.save(); roundRect(x, y, w, h, 10); ctx.fillStyle = "rgba(8,19,29,.48)"; ctx.fill();
    ctx.strokeStyle = "rgba(128,158,180,.14)"; ctx.stroke(); ctx.restore();
    mono(label, x + 11, y + 18, 6.5, "rgba(137,161,181,.58)");
  };

  panel(inset, colors.blue);
  panel(inset + panelW + gap, colors.green);
  const upperY = panelY + 48;
  const sectionGap = 9;
  const sectionH = (panelH - 71 - sectionGap) / 2;

  const drawFixedGrid = (boxX: number, boxY: number, boxW: number, boxH: number, physical: boolean) => {
    const spacing = clamp(Math.min(boxW, boxH) * 0.23, 38, 64);
    const cx = boxX + boxW / 2;
    const cy = boxY + boxH / 2 + 6;
    const points: Point[][] = [];
    for (let r = 0; r < 3; r++) {
      points[r] = [];
      for (let c = 0; c < 3; c++) points[r][c] = { x: cx + (c - 1) * spacing, y: cy + (r - 1) * spacing };
    }
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (c < 2) edge(points[r][c], points[r][c + 1], physical ? "rgba(89,167,255,.48)" : "rgba(109,243,255,.64)", 1, physical ? 3.2 : 1.5);
        if (r < 2) edge(points[r][c], points[r + 1][c], physical ? "rgba(89,167,255,.48)" : "rgba(109,243,255,.64)", 1, physical ? 3.2 : 1.5);
      }
    }
    points.flat().forEach((p) => {
      if (physical) {
        ctx.save(); ctx.shadowColor = colors.blue; ctx.shadowBlur = 9;
        ctx.fillStyle = "#163653"; ctx.strokeStyle = colors.blue; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
      } else node(p.x, p.y, colors.cyan, 6);
    });
  };

  const leftX = inset;
  mono("SUPERCONDUCTING QUBITS", leftX + 18, panelY + 24, 10, colors.blue);
  mono("CONNECTIVITY IS FABRICATED INTO THE CHIP", leftX + 18, panelY + 39, 7, "rgba(137,161,181,.58)");
  subpanel(leftX + 12, upperY, panelW - 24, sectionH, "PHYSICAL LAYOUT · FIXED COUPLERS");
  drawFixedGrid(leftX + 12, upperY, panelW - 24, sectionH, true);
  const lowerY = upperY + sectionH + sectionGap;
  subpanel(leftX + 12, lowerY, panelW - 24, sectionH, "CONNECTIVITY GRAPH · DEGREE ≤ 4");
  drawFixedGrid(leftX + 12, lowerY, panelW - 24, sectionH, false);

  const rightX = inset + panelW + gap;
  mono("NEUTRAL-ATOM QUBITS", rightX + 18, panelY + 24, 10, colors.green);
  mono("CONNECTIVITY FOLLOWS THE ATOMS", rightX + 18, panelY + 39, 7, "rgba(137,161,181,.58)");
  subpanel(rightX + 12, upperY, panelW - 24, sectionH, "PHYSICAL LAYOUT · AOD TRANSPORT");
  subpanel(rightX + 12, lowerY, panelW - 24, sectionH, "CONNECTIVITY GRAPH · RECONFIGURABLE");

  const drawMovingSystem = (boxX: number, boxY: number, boxW: number, boxH: number, physical: boolean) => {
    const centerY = boxY + boxH / 2 + 7;
    const rowGap = clamp(boxH * 0.22, 28, 43);
    const baseX = boxX + boxW * 0.2;
    const middleX = boxX + boxW * 0.52;
    const rightColumnX = boxX + boxW * 0.8;
    const middleMeetX = middleX - clamp(boxW * 0.1, 38, 52);
    const rightMeetX = rightColumnX - clamp(boxW * 0.1, 38, 52);
    const movingX = progress <= 0.28
      ? mix(baseX, middleMeetX, middleT)
      : mix(middleMeetX, rightMeetX, rightT);
    const moving: Point[] = [];
    const middle: Point[] = [];
    const right: Point[] = [];
    for (let r = 0; r < 3; r++) {
      const y = centerY + (r - 1) * rowGap;
      moving.push({ x: movingX, y }); middle.push({ x: middleX, y }); right.push({ x: rightColumnX, y });
    }

    if (!physical) {
      for (let r = 0; r < 2; r++) {
        edge(moving[r], moving[r + 1], "rgba(109,243,255,.35)");
        edge(middle[r], middle[r + 1], "rgba(50,214,173,.35)");
        edge(right[r], right[r + 1], "rgba(50,214,173,.35)");
      }
      for (let r = 0; r < 3; r++) {
        edge(moving[r], middle[r], colors.cyan, middleStrength, 2.2);
        edge(moving[r], right[r], colors.violet, rightStrength, 2.2);
      }
    }

    if (physical) {
      ctx.save(); ctx.strokeStyle = `rgba(109,243,255,${0.35 + pulse * 0.35})`; ctx.lineWidth = 1.2;
      ctx.shadowColor = colors.cyan; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(movingX, moving[0].y - 19); ctx.lineTo(movingX, moving[2].y + 19); ctx.stroke(); ctx.restore();
      [...middle, ...right].forEach((p) => {
        ctx.fillStyle = "rgba(50,214,173,.12)"; ctx.beginPath(); ctx.arc(p.x, p.y, 18, 0, Math.PI * 2); ctx.fill();
      });
      moving.forEach((p) => {
        const interaction = Math.max(middleStrength, rightStrength);
        ctx.save(); ctx.globalAlpha = interaction * 0.35;
        ctx.fillStyle = interaction === rightStrength && rightStrength > middleStrength ? colors.violet : colors.cyan;
        ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      });
    }

    moving.forEach((p) => node(p.x, p.y, colors.cyan, physical ? 7 : 5.5));
    middle.forEach((p) => node(p.x, p.y, colors.green, physical ? 7 : 5.5));
    right.forEach((p) => node(p.x, p.y, colors.green, physical ? 7 : 5.5));
    if (physical) {
      mono("AOD", movingX, moving[0].y - 26, 6.5, colors.cyan, "center");
      mono("MIDDLE", middleX, moving[2].y + 30, 6, "rgba(125,174,160,.62)", "center");
      mono("RIGHT", rightColumnX, moving[2].y + 30, 6, "rgba(125,174,160,.62)", "center");
    }
  };
  drawMovingSystem(rightX + 12, upperY, panelW - 24, sectionH, true);
  drawMovingSystem(rightX + 12, lowerY, panelW - 24, sectionH, false);

  ctx.save(); ctx.globalAlpha = Math.max(middleStrength, rightStrength);
  const status = rightStrength > middleStrength ? "AOD ↔ RIGHT" : "AOD ↔ MIDDLE";
  const statusColor = rightStrength > middleStrength ? colors.violet : colors.cyan;
  roundRect(rightX + panelW - 126, panelY + 12, 108, 23, 11);
  ctx.fillStyle = "rgba(12,30,40,.92)"; ctx.fill(); ctx.strokeStyle = `${statusColor}66`; ctx.stroke();
  mono(status, rightX + panelW - 72, panelY + 27, 6.5, statusColor, "center");
  ctx.restore();
}

function classicalBitPhase(progress: number) {
  if (progress <= 0.001) {
    return {
      number: "01",
      label: "Store one classical bit",
      description: "The intended value is written into a single physical device.",
    };
  }
  if (progress <= 0.421) {
    return {
      number: "02",
      label: "One fault flips the answer",
      description: "With only one copy, the receiver cannot tell that 1 became 0.",
    };
  }
  if (progress <= 0.681) {
    return {
      number: "03",
      label: "Add classical redundancy",
      description: "The intended value is repeated across seven independently stored bits.",
    };
  }
  return {
    number: "04",
    label: "Let the majority decide",
    description: "Six correct copies outvote the single flipped bit and recover the original value.",
  };
}

function drawClassicalBitIntro(canvas: HTMLCanvasElement, progress: number) {
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

  const inset = clamp(width * 0.06, 56, 92);
  const gap = clamp(width * 0.025, 24, 40);
  const panelY = 14;
  const panelH = height - 28;
  const panelW = (width - inset * 2 - gap) / 2;
  const flip = ease((progress - 0.2) / 0.22);
  const repeat = ease((progress - 0.43) / 0.25);
  const vote = ease((progress - 0.7) / 0.23);
  const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 220);

  const roundRect = (x: number, y: number, w: number, h: number, r = 14) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  };
  const panel = (x: number, accent: string) => {
    ctx.save();
    roundRect(x, panelY, panelW, panelH);
    ctx.fillStyle = "rgba(8, 21, 32, .72)";
    ctx.fill();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = accent;
    ctx.stroke();
    ctx.restore();
  };
  const mono = (text: string, x: number, y: number, size = 9, color = "rgba(190,211,225,.72)", align: CanvasTextAlign = "left") => {
    ctx.save();
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.font = `600 ${size * 1.08}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillText(text, x, y);
    ctx.restore();
  };
  const drawArrow = (x1: number, y1: number, x2: number, y2: number, color: string, alpha = 1) => {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 - 8, y2 - 5); ctx.lineTo(x2 - 8, y2 + 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  const bitCell = (cx: number, cy: number, value: string, accent: string, alpha = 1, error = false, size = 64) => {
    ctx.save(); ctx.globalAlpha *= alpha;
    roundRect(cx - size / 2, cy - size / 2, size, size, 12);
    ctx.fillStyle = error ? "rgba(91,39,32,.9)" : "rgba(15,38,51,.92)"; ctx.fill();
    ctx.strokeStyle = accent; ctx.lineWidth = error ? 2.2 : 1.2; ctx.stroke();
    ctx.fillStyle = error ? colors.amber : "#e4f2f9";
    ctx.textAlign = "center";
    ctx.font = `500 ${size * 0.58}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillText(value, cx, cy + size * 0.2);
    ctx.restore();
  };

  panel(inset, colors.pink);
  panel(inset + panelW + gap, colors.green);

  const leftX = inset;
  mono("ONE PHYSICAL BIT", leftX + 18, panelY + 24, 10, colors.pink);
  mono("NO REDUNDANCY", leftX + 18, panelY + 39, 7, "rgba(137,161,181,.58)");
  const leftY = panelY + panelH * 0.48;
  const sourceX = leftX + panelW * 0.25;
  const targetX = leftX + panelW * 0.75;
  bitCell(sourceX, leftY, "1", colors.cyan, 1, false, clamp(panelH * 0.25, 82, 140));
  mono("INTENDED", sourceX, leftY - clamp(panelH * 0.16, 54, 78), 7, colors.cyan, "center");
  drawArrow(sourceX + 64, leftY, targetX - 64, leftY, flip > 0.05 ? colors.amber : "rgba(109,243,255,.48)");

  ctx.save(); ctx.globalAlpha = flip;
  const boltX = (sourceX + targetX) / 2;
  ctx.strokeStyle = colors.amber; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(boltX - 7, leftY - 31); ctx.lineTo(boltX + 5, leftY - 8);
  ctx.lineTo(boltX - 3, leftY - 8); ctx.lineTo(boltX + 8, leftY + 22);
  ctx.stroke();
  mono("NOISE", boltX, leftY - 42, 7, colors.amber, "center");
  ctx.restore();

  bitCell(targetX, leftY, flip > 0.5 ? "0" : "1", flip > 0.5 ? colors.amber : colors.cyan, 1, flip > 0.5, clamp(panelH * 0.25, 82, 140));
  mono(flip > 0.5 ? "WRONG" : "READ", targetX, leftY - clamp(panelH * 0.16, 54, 78), 7, flip > 0.5 ? colors.amber : colors.cyan, "center");
  mono("ONE FLIP → THE STORED ANSWER IS LOST", leftX + panelW / 2, panelY + panelH - 26, 8, colors.amber, "center");

  const rightX = inset + panelW + gap;
  ctx.save();
  ctx.globalAlpha = repeat;
  mono("7-BIT REPETITION CODE", rightX + 18, panelY + 24, 10, colors.green);
  mono("CLASSICAL REDUNDANCY + MAJORITY VOTE", rightX + 18, panelY + 39, 7, "rgba(137,161,181,.58)");

  const cellsY = panelY + panelH * 0.38;
  const cellSize = clamp(panelW * 0.09, 38, 60);
  const cellGap = clamp(panelW * 0.025, 9, 16);
  const totalW = cellSize * 7 + cellGap * 6;
  const cellsX = rightX + (panelW - totalW) / 2 + cellSize / 2;
  for (let i = 0; i < 7; i++) {
    const local = ease(repeat * 1.42 - i * 0.07);
    const isFault = i === 3 && flip > 0.65 && vote < 0.88;
    bitCell(cellsX + i * (cellSize + cellGap), cellsY, isFault ? "0" : "1", isFault ? colors.amber : colors.green, local, isFault, cellSize);
    mono(`b${i + 1}`, cellsX + i * (cellSize + cellGap), cellsY + cellSize * 0.75, 5.8, "rgba(137,161,181,.55)", "center");
  }

  ctx.save(); ctx.globalAlpha = vote;
  const tallyY = panelY + panelH * 0.62;
  roundRect(rightX + panelW * 0.12, tallyY, panelW * 0.76, 64, 11);
  ctx.fillStyle = "rgba(13,36,42,.88)"; ctx.fill();
  ctx.strokeStyle = "rgba(50,214,173,.3)"; ctx.stroke();
  mono("COUNT THE COPIES", rightX + panelW * 0.16, tallyY + 18, 7, "rgba(151,176,187,.68)");
  mono("1", rightX + panelW * 0.31, tallyY + 46, 19, colors.green, "center");
  mono("× 6", rightX + panelW * 0.38, tallyY + 44, 9, colors.green);
  mono("0", rightX + panelW * 0.59, tallyY + 46, 19, colors.amber, "center");
  mono("× 1", rightX + panelW * 0.66, tallyY + 44, 9, colors.amber);
  ctx.restore();

  const outputY = panelY + panelH * 0.84;
  drawArrow(rightX + panelW * 0.35, outputY, rightX + panelW * 0.58, outputY, colors.green, vote);
  ctx.save(); ctx.globalAlpha = vote;
  mono("MAJORITY", rightX + panelW * 0.46, outputY - 12, 6.5, colors.green, "center");
  bitCell(rightX + panelW * 0.68, outputY, "1", colors.green, 1, false, cellSize * 1.12);
  mono("RECOVERED", rightX + panelW * 0.68, outputY + cellSize * 0.88, 7, colors.green, "center");
  ctx.restore();

  ctx.save(); ctx.globalAlpha = vote;
  const marginY = panelY + panelH * 0.19;
  roundRect(rightX + panelW * 0.79, marginY - 17, panelW * 0.16, 34, 17);
  ctx.fillStyle = `rgba(50,214,173,${0.08 + pulse * 0.08})`; ctx.fill();
  ctx.strokeStyle = "rgba(50,214,173,.42)"; ctx.stroke();
  mono("6 > 1", rightX + panelW * 0.87, marginY + 3, 8, colors.green, "center");
  ctx.restore();
  ctx.restore();
}

function logicalQubitPhase(progress: number) {
  if (progress <= 0.001) {
    return {
      number: "01",
      label: "A physical qubit is fragile",
      description: "Its state is stored in one physical system, so a local error directly changes it.",
    };
  }
  if (progress <= 0.461) {
    return {
      number: "02",
      label: "Errors change the state",
      description: "Bit flips, phase flips, and combined errors move the encoded information.",
    };
  }
  if (progress <= 0.701) {
    return {
      number: "03",
      label: "Encode one logical qubit",
      description: "A color code distributes one quantum state across seven physical qubits.",
    };
  }
  return {
    number: "04",
    label: "Detect and correct locally",
    description: "Syndromes reveal where an error occurred without revealing the logical state.",
  };
}

function drawLogicalQubitIntro(canvas: HTMLCanvasElement, progress: number) {
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

  const inset = clamp(width * 0.06, 56, 92);
  const gap = clamp(width * 0.025, 24, 40);
  const panelY = 14;
  const panelH = height - 28;
  const panelW = (width - inset * 2 - gap) / 2;
  const errorReveal = ease((progress - 0.16) / 0.3);
  const encodeReveal = ease((progress - 0.46) / 0.24);
  const correction = ease((progress - 0.72) / 0.22);
  const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 230);

  const roundRect = (x: number, y: number, w: number, h: number, r = 14) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  };
  const panel = (x: number, accent: string) => {
    ctx.save();
    roundRect(x, panelY, panelW, panelH);
    ctx.fillStyle = "rgba(8, 21, 32, .72)";
    ctx.fill();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = accent;
    ctx.stroke();
    ctx.restore();
  };
  const mono = (text: string, x: number, y: number, size = 9, color = "rgba(190,211,225,.72)", align: CanvasTextAlign = "left") => {
    ctx.save();
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.font = `600 ${size * 1.08}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillText(text, x, y);
    ctx.restore();
  };
  const arrow = (from: Point, to: Point, color: string, alpha = 1, lineWidth = 2) => {
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - 8 * Math.cos(angle - 0.45), to.y - 8 * Math.sin(angle - 0.45));
    ctx.lineTo(to.x - 8 * Math.cos(angle + 0.45), to.y - 8 * Math.sin(angle + 0.45));
    ctx.closePath(); ctx.fill();
    ctx.restore();
  };

  panel(inset, colors.pink);
  panel(inset + panelW + gap, colors.green);

  const leftX = inset;
  mono("ONE PHYSICAL QUBIT", leftX + 18, panelY + 24, 10, colors.pink);
  mono("THE STATE LIVES IN ONE PLACE", leftX + 18, panelY + 39, 7, "rgba(137,161,181,.58)");
  const sphereX = leftX + panelW * 0.34;
  const sphereY = panelY + panelH * 0.45;
  const radius = clamp(panelH * 0.23, 74, 135);
  ctx.save();
  ctx.strokeStyle = "rgba(165,194,214,.28)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(sphereX, sphereY, radius, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(sphereX, sphereY, radius, radius * 0.28, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(sphereX, sphereY, radius * 0.28, radius, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = "rgba(165,194,214,.18)";
  ctx.beginPath(); ctx.moveTo(sphereX - radius - 13, sphereY); ctx.lineTo(sphereX + radius + 13, sphereY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sphereX, sphereY + radius + 13); ctx.lineTo(sphereX, sphereY - radius - 13); ctx.stroke();
  mono("|0⟩", sphereX + 7, sphereY - radius - 8, 7, "rgba(203,221,232,.65)");
  mono("|1⟩", sphereX + 7, sphereY + radius + 13, 7, "rgba(203,221,232,.65)");

  const stateAngle = -1.02;
  const cleanTip = { x: sphereX + Math.cos(stateAngle) * radius * 0.79, y: sphereY + Math.sin(stateAngle) * radius * 0.79 };
  arrow({ x: sphereX, y: sphereY }, cleanTip, colors.cyan, 1, 2.4);
  ctx.fillStyle = colors.cyan; ctx.beginPath(); ctx.arc(cleanTip.x, cleanTip.y, 4.2, 0, Math.PI * 2); ctx.fill();
  mono("|ψ⟩", cleanTip.x + 10, cleanTip.y - 7, 9, colors.cyan);

  const corruptedAngle = mix(stateAngle, stateAngle + Math.PI * 0.72, errorReveal);
  const corruptTip = { x: sphereX + Math.cos(corruptedAngle) * radius * 0.72, y: sphereY + Math.sin(corruptedAngle) * radius * 0.72 };
  arrow({ x: sphereX, y: sphereY }, corruptTip, colors.amber, errorReveal, 2.1);
  ctx.restore();

  const cardX = leftX + panelW * 0.66;
  const cardW = panelW * 0.29;
  const errors = [
    ["X", "BIT FLIP", "|0⟩ ↔ |1⟩", colors.blue],
    ["Z", "PHASE FLIP", "|+⟩ ↔ |−⟩", colors.pink],
    ["Y", "BOTH", "bit + phase", colors.amber],
  ];
  errors.forEach(([symbol, name, detail, accent], i) => {
    const local = ease(errorReveal * 1.35 - i * 0.16);
    const h = 51;
    const y = sphereY - 83 + i * 62;
    ctx.save(); ctx.globalAlpha = local;
    roundRect(cardX, y, cardW, h, 9);
    ctx.fillStyle = "rgba(16,34,46,.9)"; ctx.fill();
    ctx.strokeStyle = `${accent}55`; ctx.stroke();
    mono(symbol, cardX + 12, y + 21, 14, accent);
    mono(name, cardX + 34, y + 18, 7.5, "rgba(228,240,248,.87)");
    mono(detail, cardX + 34, y + 34, 6.5, "rgba(146,168,185,.68)");
    ctx.restore();
  });
  mono("ONE LOCAL ERROR → INFORMATION CHANGES", leftX + panelW / 2, panelY + panelH - 24, 8, colors.amber, "center");

  const rightX = inset + panelW + gap;
  mono("ONE LOGICAL QUBIT", rightX + 18, panelY + 24, 10, colors.green);
  mono("7-QUBIT COLOR CODE · CONCEPTUAL VIEW", rightX + 18, panelY + 39, 7, "rgba(137,161,181,.58)");
  const centerX = rightX + panelW * 0.51;
  const centerY = panelY + panelH * 0.49;
  const scale = clamp(panelH * 0.19, 68, 116);
  const codePoints = [
    { x: centerX, y: centerY - scale },
    { x: centerX - scale * 0.5, y: centerY - scale * 0.14 },
    { x: centerX + scale * 0.5, y: centerY - scale * 0.14 },
    { x: centerX - scale, y: centerY + scale * 0.72 },
    { x: centerX, y: centerY + scale * 0.72 },
    { x: centerX + scale, y: centerY + scale * 0.72 },
    { x: centerX, y: centerY + scale * 0.15 },
  ];
  const faces = [
    [0, 1, 6, 2, "rgba(89,167,255,.17)", colors.blue],
    [1, 3, 4, 6, "rgba(255,110,159,.15)", colors.pink],
    [2, 6, 4, 5, "rgba(255,189,102,.14)", colors.amber],
  ] as const;
  ctx.save(); ctx.globalAlpha = encodeReveal;
  faces.forEach(([a, b, c, d, fill, stroke], i) => {
    ctx.beginPath();
    ctx.moveTo(codePoints[a].x, codePoints[a].y);
    [b, c, d].forEach((idx) => ctx.lineTo(codePoints[idx].x, codePoints[idx].y));
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    ctx.strokeStyle = correction > 0.15 && i < 2 ? `${stroke}${Math.round((0.35 + pulse * 0.4) * 255).toString(16).padStart(2,"0")}` : `${stroke}66`;
    ctx.lineWidth = correction > 0.15 && i < 2 ? 2 : 1; ctx.stroke();
  });
  codePoints.forEach((p, i) => {
    const isError = i === 6 && correction < 0.78;
    ctx.fillStyle = isError ? colors.amber : "#d8f7ef";
    ctx.strokeStyle = isError ? "#ffe0a8" : colors.green;
    ctx.lineWidth = isError ? 2.5 : 1.2;
    ctx.beginPath(); ctx.arc(p.x, p.y, isError ? 8 : 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (isError) mono("!", p.x, p.y + 3, 8, "#3a2609", "center");
  });
  ctx.restore();

  ctx.save(); ctx.globalAlpha = encodeReveal;
  const logicalStateY = centerY - scale - 30;
  roundRect(centerX - 62, logicalStateY - 14, 124, 28, 14);
  ctx.fillStyle = "rgba(6,22,27,.86)"; ctx.fill();
  ctx.strokeStyle = "rgba(50,214,173,.5)"; ctx.stroke();
  mono("|ψ⟩  →  |ψ⟩ₗ", centerX, logicalStateY + 4, 11, colors.green, "center");
  ctx.restore();

  const stages = [
    ["ENCODE", "spread one state", colors.cyan],
    ["SYNDROME", "locate the error", colors.amber],
    ["CORRECT", "restore the code", colors.green],
  ];
  const stageW = (panelW - 52) / 3;
  stages.forEach(([name, detail, accent], i) => {
    const local = i === 0 ? encodeReveal : ease(correction * 1.25 - (i - 1) * 0.15);
    const x = rightX + 18 + i * (stageW + 8);
    const y = panelY + panelH - 64;
    ctx.save(); ctx.globalAlpha = local;
    roundRect(x, y, stageW, 39, 8);
    ctx.fillStyle = "rgba(16,35,43,.9)"; ctx.fill();
    ctx.strokeStyle = `${accent}55`; ctx.stroke();
    mono(name, x + 8, y + 15, 7, accent);
    mono(detail, x + 8, y + 29, 5.8, "rgba(150,174,187,.66)");
    ctx.restore();
  });

  ctx.save(); ctx.globalAlpha = encodeReveal;
  const bridgeY = panelY + panelH * 0.22;
  arrow({ x: leftX + panelW + 7, y: bridgeY }, { x: rightX - 7, y: bridgeY }, colors.green, 0.7, 1.5);
  mono("ENCODE", leftX + panelW + gap / 2, bridgeY - 10, 6.5, colors.green, "center");
  ctx.restore();
}

function scalingPhase(progress: number) {
  if (progress <= 0.001) {
    return {
      number: "01",
      label: "Start with the small codes",
      description: "Distance-3 surface and color patches sit above the gross BB code.",
    };
  }
  if (progress <= 0.601) {
    return {
      number: "02",
      label: "Increase error distance",
      description: "Distance-7 patches and the distance-18 two-gross block enter completely at right.",
    };
  }
  return {
    number: "03",
    label: progress < 0.919 ? "Reveal the scaling laws" : "Compare the overhead",
    description: progress < 0.919
      ? "Each row resolves into its complete physical-qubit scaling law."
      : "Two-dimensional topological patches grow quadratically with distance.",
  };
}

function drawScalingComparison(canvas: HTMLCanvasElement, progress: number) {
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

  const left = clamp(width * 0.135, 108, 194);
  const right = clamp(width * 0.045, 32, 70);
  const top = Math.max(12, height * 0.025);
  const gap = Math.max(5, height * 0.012);
  const rowHeight = (height - top * 2 - gap * 2) / 3;
  const contentWidth = width - left - right;
  const startX = left + contentWidth * 0.17;
  const targetX = left + contentWidth * 0.52;
  const formulaX = left + contentWidth * 0.78;
  const reveal = ease((progress - 0.2) / 0.4);
  const slide = (1 - reveal) * Math.min(56, contentWidth * 0.07);
  const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 260);

  const label = (name: string, detail: string, row: number, accent: string) => {
    const y = top + row * (rowHeight + gap) + rowHeight / 2;
    ctx.save();
    ctx.fillStyle = accent;
    ctx.font = "600 12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(name.toUpperCase(), 28, y - 7);
    ctx.fillStyle = "rgba(174, 197, 216, .58)";
    ctx.font = "500 8px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(detail.toUpperCase(), 28, y + 10);
    ctx.restore();
  };

  const separator = (row: number) => {
    if (row === 0) return;
    const y = top + row * (rowHeight + gap) - gap / 2;
    ctx.save();
    ctx.strokeStyle = "rgba(132, 166, 191, .12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(22, y);
    ctx.lineTo(width - 22, y);
    ctx.stroke();
    ctx.restore();
  };

  const transitionArrow = (y: number) => {
    const x1 = startX + Math.min(72, contentWidth * 0.085);
    const x2 = targetX - Math.min(78, contentWidth * 0.09);
    ctx.save();
    ctx.globalAlpha = reveal;
    ctx.strokeStyle = `rgba(109, 243, 255, ${0.24 + pulse * 0.18})`;
    ctx.fillStyle = colors.cyan;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y);
    ctx.lineTo(x2 - 7, y - 4);
    ctx.lineTo(x2 - 7, y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const topologyCaption = (
    x: number,
    y: number,
    title: string,
    detail: string,
    alpha = 1,
  ) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(229, 241, 249, .9)";
    ctx.font = "600 9px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(title, x, y);
    ctx.fillStyle = "rgba(137, 161, 181, .7)";
    ctx.font = "500 7px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(detail, x, y + 12);
    ctx.restore();
  };

  const drawSurfacePatch = (
    cx: number,
    cy: number,
    distance: number,
    size: number,
    alpha: number,
  ) => {
    const step = size / Math.max(1, distance - 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx - size / 2, cy - size / 2);
    for (let r = 0; r < distance - 1; r++) {
      for (let c = 0; c < distance - 1; c++) {
        ctx.fillStyle = (r + c) % 2 === 0
          ? "rgba(89, 167, 255, .11)"
          : "rgba(255, 110, 159, .09)";
        ctx.fillRect(c * step, r * step, step, step);
      }
    }
    ctx.strokeStyle = "rgba(155, 188, 213, .32)";
    ctx.lineWidth = 0.8;
    for (let i = 0; i < distance; i++) {
      const p = i * step;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
    const logicalIndex = Math.floor(distance / 2) * step;
    ctx.strokeStyle = colors.cyan;
    ctx.globalAlpha = alpha * 0.72;
    ctx.lineWidth = Math.max(1, size / 55);
    ctx.beginPath();
    ctx.moveTo(logicalIndex, 0);
    ctx.lineTo(logicalIndex, size);
    ctx.stroke();
    ctx.strokeStyle = colors.pink;
    ctx.beginPath();
    ctx.moveTo(0, logicalIndex);
    ctx.lineTo(size, logicalIndex);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    for (let r = 0; r < distance; r++) {
      for (let c = 0; c < distance; c++) {
        ctx.fillStyle = "#dcecf7";
        ctx.beginPath();
        ctx.arc(c * step, r * step, clamp(size / distance * 0.14, 1.1, 2.3), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.strokeStyle = "rgba(208, 229, 242, .58)";
    ctx.lineWidth = 1.1;
    ctx.strokeRect(0, 0, size, size);
    ctx.restore();
  };

  const drawColorPatch = (
    cx: number,
    cy: number,
    distance: number,
    size: number,
    alpha: number,
  ) => {
    const h = size * 0.86;
    const topPoint = { x: cx, y: cy - h / 2 };
    const leftPoint = { x: cx - size / 2, y: cy + h / 2 };
    const rightPoint = { x: cx + size / 2, y: cy + h / 2 };
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = Math.max(1.2, size / 58);
    [[topPoint, leftPoint, colors.pink], [leftPoint, rightPoint, colors.green], [rightPoint, topPoint, colors.blue]].forEach(
      ([a, b, color]) => {
        const start = a as Point;
        const end = b as Point;
        ctx.strokeStyle = color as string;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
      },
    );
    for (let r = 0; r < distance; r++) {
      const t = distance === 1 ? 0 : r / (distance - 1);
      const y = mix(topPoint.y, leftPoint.y, t);
      const rowLeft = mix(topPoint.x, leftPoint.x, t);
      const rowRight = mix(topPoint.x, rightPoint.x, t);
      for (let c = 0; c <= r; c++) {
        const u = r === 0 ? 0.5 : c / r;
        const x = mix(rowLeft, rowRight, u);
        ctx.fillStyle = c % 3 === 0 ? colors.pink : c % 3 === 1 ? colors.green : colors.blue;
        ctx.globalAlpha = alpha * 0.84;
        ctx.beginPath();
        ctx.arc(x, y, clamp(size / distance * 0.13, 1.15, 2.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = alpha * 0.78;
    ctx.strokeStyle = colors.amber;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(topPoint.x, topPoint.y);
    ctx.lineTo(cx, cy + h / 2);
    ctx.stroke();
    ctx.restore();
  };

  const drawBicyclePatch = (
    cx: number,
    cy: number,
    rows: number,
    patchWidth: number,
    patchHeight: number,
    alpha: number,
  ) => {
    const cols = 12;
    const cellW = patchWidth / cols;
    const cellH = patchHeight / rows;
    const x0 = cx - patchWidth / 2;
    const y0 = cy - patchHeight / 2;
    const radius = clamp(Math.min(cellW, cellH) * 0.17, 0.75, 2.1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgba(153, 185, 208, .18)";
    ctx.lineWidth = 0.55;
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(x0 + c * cellW, y0);
      ctx.lineTo(x0 + c * cellW, y0 + patchHeight);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(x0, y0 + r * cellH);
      ctx.lineTo(x0 + patchWidth, y0 + r * cellH);
      ctx.stroke();
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = x0 + c * cellW;
        const y = y0 + r * cellH;
        ctx.fillStyle = colors.blue;
        ctx.beginPath();
        ctx.arc(x + cellW * 0.28, y + cellH * 0.68, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = colors.amber;
        ctx.beginPath();
        ctx.arc(x + cellW * 0.72, y + cellH * 0.32, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = colors.green;
        ctx.fillRect(x + cellW * 0.2 - radius, y + cellH * 0.24 - radius, radius * 1.65, radius * 1.65);
        ctx.fillStyle = colors.pink;
        ctx.fillRect(x + cellW * 0.68 - radius, y + cellH * 0.7 - radius, radius * 1.65, radius * 1.65);
      }
    }
    ctx.strokeStyle = colors.cyan;
    ctx.globalAlpha = alpha * 0.58;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0 + patchWidth * 0.35, y0 + patchHeight * 0.76);
    ctx.lineTo(x0 + patchWidth * 0.53, y0 + patchHeight * 0.22);
    ctx.lineTo(x0 + patchWidth * 0.73, y0 + patchHeight * 0.6);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "rgba(215, 233, 244, .58)";
    ctx.lineWidth = 1.1;
    ctx.strokeRect(x0, y0, patchWidth, patchHeight);
    ctx.fillStyle = "rgba(109, 243, 255, .82)";
    ctx.font = "600 9px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillText("↔", cx, y0 - 3);
    ctx.fillText("↕", x0 - 6, cy + 3);
    ctx.restore();
  };

  const scalingFormula = (
    row: number,
    formula: string,
    detail: string,
    accent: string,
  ) => {
    const y = top + row * (rowHeight + gap) + rowHeight / 2;
    const rowFormulaReveal = ease((progress - (0.62 + row * 0.1)) / 0.1);
    ctx.save();
    ctx.globalAlpha = rowFormulaReveal;
    ctx.fillStyle = "rgba(130, 153, 173, .66)";
    ctx.font = "500 7px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("PHYSICAL-QUBIT SCALING", formulaX, y - 18);
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12 * rowFormulaReveal;
    ctx.font = `500 ${clamp(width * 0.018, 18, 30)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillText(formula, formulaX, y + 7);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(154, 177, 196, .68)";
    ctx.font = "500 8px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(detail, formulaX, y + 24);
    ctx.restore();
  };

  for (let row = 0; row < 3; row++) separator(row);

  const surfaceY = top + rowHeight / 2 - 3;
  label("Surface code", "one logical qubit per patch", 0, colors.blue);
  drawSurfacePatch(startX, surfaceY, 3, clamp(rowHeight * 0.36, 42, 58), 1);
  topologyCaption(startX, surfaceY + rowHeight * 0.34, "d = 3", "n = 9 data qubits");
  transitionArrow(surfaceY);
  drawSurfacePatch(targetX + slide, surfaceY, 7, clamp(rowHeight * 0.62, 70, 102), reveal);
  topologyCaption(targetX + slide, surfaceY + rowHeight * 0.38, "d = 7", "n = 49 data qubits", reveal);
  scalingFormula(0, "n = Θ(d²)", "per encoded logical qubit", colors.blue);

  const colorY = top + (rowHeight + gap) + rowHeight / 2 - 2;
  label("Color code", "one logical qubit per patch", 1, colors.pink);
  drawColorPatch(startX, colorY, 3, clamp(rowHeight * 0.39, 46, 64), 1);
  topologyCaption(startX, colorY + rowHeight * 0.34, "d = 3", "n = 7 data qubits");
  transitionArrow(colorY);
  drawColorPatch(targetX + slide, colorY, 7, clamp(rowHeight * 0.66, 74, 108), reveal);
  topologyCaption(targetX + slide, colorY + rowHeight * 0.39, "d = 7", "n = 37 data qubits", reveal);
  scalingFormula(1, "n = Θ(d²)", "per encoded logical qubit", colors.pink);

  const bbY = top + 2 * (rowHeight + gap) + rowHeight / 2 - 2;
  label("Bivariate bicycle", "twelve logical qubits per block", 2, colors.green);
  drawBicyclePatch(
    startX,
    bbY,
    6,
    clamp(rowHeight * 0.8, 88, 126),
    clamp(rowHeight * 0.38, 42, 58),
    1,
  );
  topologyCaption(startX, bbY + rowHeight * 0.35, "gross · [[144,12,12]]", "12 physical qubits / logical");
  transitionArrow(bbY);
  drawBicyclePatch(
    targetX + slide,
    bbY,
    12,
    clamp(rowHeight * 0.73, 82, 118),
    clamp(rowHeight * 0.66, 74, 102),
    reveal,
  );
  topologyCaption(
    targetX + slide,
    bbY + rowHeight * 0.4,
    "two-gross · [[288,12,18]]",
    "24 physical qubits / logical",
    reveal,
  );
  scalingFormula(2, "k,d = Θ(n)", "asymptotically good qLDPC target", colors.green);
}

function gateComplexityPhase(progress: number) {
  if (progress < 0.22) {
    return {
      number: "01",
      label: "Align identical code blocks",
      description: "Matching physical qubits in two CSS blocks are paired for a logical CNOT.",
    };
  }
  if (progress < 0.48) {
    return {
      number: "02",
      label: "Fire one bitwise layer",
      description: "Every physical CNOT executes in parallel when pairwise connectivity exists.",
    };
  }
  if (progress < 0.7) {
    return {
      number: "03",
      label: "Select two BB logical qubits",
      description: "The target states are embedded among twelve logical qubits in each BB block.",
    };
  }
  return {
    number: "04",
    label: "Compile into bicycle instructions",
    description: "Shifts, LPU surgery, repeated checks, and feed-forward replace a direct gate.",
  };
}

function drawGateComplexity(canvas: HTMLCanvasElement, progress: number) {
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

  const inset = clamp(width * 0.055, 52, 86);
  const gap = clamp(width * 0.018, 14, 28);
  const topY = 12;
  const topH = height * 0.38;
  const bottomY = topY + topH + 12;
  const bottomH = height - bottomY - 12;
  const pairReveal = ease((progress - 0.04) / 0.18);
  const fire = ease((progress - 0.22) / 0.2);
  const bbReveal = ease((progress - 0.44) / 0.18);
  const compile = ease((progress - 0.66) / 0.28);
  const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 220);

  const roundRect = (x: number, y: number, w: number, h: number, r = 12) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  };
  const panel = (x: number, y: number, w: number, h: number, accent: string) => {
    ctx.save();
    roundRect(x, y, w, h, 13);
    ctx.fillStyle = "rgba(8, 22, 32, .7)";
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.2;
    ctx.stroke();
    ctx.restore();
  };
  const mono = (text: string, x: number, y: number, size = 9, color = "rgba(190,211,225,.72)", align: CanvasTextAlign = "left") => {
    ctx.save();
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.font = `600 ${size * 1.08}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillText(text, x, y);
    ctx.restore();
  };
  const badge = (text: string, x: number, y: number, accent: string, alpha = 1) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = "600 8px ui-monospace, SFMono-Regular, Menlo, monospace";
    const w = ctx.measureText(text).width + 18;
    roundRect(x - w / 2, y - 10, w, 20, 10);
    ctx.fillStyle = `${accent}18`;
    ctx.fill();
    ctx.strokeStyle = `${accent}66`;
    ctx.stroke();
    ctx.fillStyle = accent;
    ctx.textAlign = "center";
    ctx.fillText(text, x, y + 3);
    ctx.restore();
  };

  const halfW = (width - inset * 2 - gap) / 2;
  const drawGridBlock = (cx: number, cy: number, triangular: boolean, accent: string, alpha: number) => {
    const points: Point[] = [];
    const span = clamp(topH * 0.42, 54, 84);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (triangular) {
      const rows = 5;
      for (let r = 0; r < rows; r++) {
        const count = r + 1;
        for (let c = 0; c < count; c++) {
          points.push({
            x: cx + (c - (count - 1) / 2) * span / 4,
            y: cy - span * 0.42 + r * span / 4,
          });
        }
      }
    } else {
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          points.push({ x: cx + (c - 2) * span / 4, y: cy + (r - 2) * span / 4 });
        }
      }
    }
    ctx.strokeStyle = "rgba(137,169,190,.18)";
    ctx.lineWidth = 0.8;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const d = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
        if (d < span / 3) {
          ctx.beginPath(); ctx.moveTo(points[i].x, points[i].y); ctx.lineTo(points[j].x, points[j].y); ctx.stroke();
        }
      }
    }
    for (const p of points) {
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    return points;
  };

  const drawCssPair = (x: number, name: string, triangular: boolean, accent: string) => {
    panel(x, topY, halfW, topH, accent);
    mono(name.toUpperCase(), x + 16, topY + 20, 9, accent);
    mono("TWO IDENTICAL CSS BLOCKS", x + 16, topY + 34, 7, "rgba(137,161,181,.58)");
    const cy = topY + topH * 0.57;
    const leftCx = x + halfW * 0.31;
    const rightCx = x + halfW * 0.69;
    const a = drawGridBlock(leftCx, cy, triangular, accent, 1);
    const b = drawGridBlock(rightCx, cy, triangular, accent, pairReveal);
    const count = Math.min(a.length, b.length);
    ctx.save();
    ctx.globalAlpha = fire;
    for (let i = 0; i < count; i++) {
      ctx.strokeStyle = `${accent}${Math.round((0.25 + pulse * 0.45) * 255).toString(16).padStart(2,"0")}`;
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(a[i].x, a[i].y); ctx.lineTo(b[i].x, b[i].y); ctx.stroke();
      ctx.fillStyle = "#07131d";
      ctx.strokeStyle = accent;
      ctx.beginPath(); ctx.arc(b[i].x, b[i].y, 3.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    mono("CONTROL", leftCx, topY + topH - 14, 7, "rgba(160,181,197,.58)", "center");
    mono("TARGET", rightCx, topY + topH - 14, 7, "rgba(160,181,197,.58)", "center");
    badge("BITWISE CNOT · DEPTH 1*", x + halfW / 2, topY + 20, accent, fire);
  };

  drawCssPair(inset, "Surface code", false, colors.blue);
  drawCssPair(inset + halfW + gap, "Color code", true, colors.pink);

  panel(inset, bottomY, width - inset * 2, bottomH, colors.green);
  ctx.save(); ctx.globalAlpha = bbReveal;
  mono("BIVARIATE BICYCLE · SELECTED LOGICAL CNOT", inset + 16, bottomY + 21, 9, colors.green);
  mono("12 LOGICAL QUBITS SHARE EACH DENSE CODE BLOCK", inset + 16, bottomY + 35, 7, "rgba(137,161,181,.58)");

  const moduleW = clamp(width * 0.115, 116, 166);
  const moduleH = clamp(bottomH * 0.58, 86, 126);
  const moduleY = bottomY + bottomH * 0.58;
  const drawBbModule = (cx: number, target: number, label: string) => {
    const x = cx - moduleW / 2;
    const y = moduleY - moduleH / 2;
    roundRect(x, y, moduleW, moduleH, 12);
    ctx.fillStyle = "rgba(14,43,42,.72)"; ctx.fill();
    ctx.strokeStyle = "rgba(50,214,173,.32)"; ctx.stroke();
    mono(label, cx, y - 8, 7, "rgba(146,180,178,.7)", "center");
    for (let i = 0; i < 12; i++) {
      const col = i % 6, row = Math.floor(i / 6);
      const px = x + 15 + col * (moduleW - 30) / 5;
      const py = y + moduleH * (row ? 0.67 : 0.33);
      ctx.strokeStyle = i + 1 === target ? colors.amber : "rgba(108,176,164,.28)";
      ctx.fillStyle = i + 1 === target ? `rgba(255,189,102,${0.4 + pulse * 0.25})` : "rgba(24,72,67,.72)";
      ctx.beginPath(); ctx.arc(px, py, i + 1 === target ? 7 : 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      mono(String(i + 1), px, py + 2.3, 5.5, i + 1 === target ? "#fff1d4" : "rgba(189,220,213,.72)", "center");
    }
    return { x, y, cx };
  };
  const leftModule = drawBbModule(inset + moduleW * 0.65, 4, "BB MODULE A");
  const rightModule = drawBbModule(width - inset - moduleW * 0.65, 10, "BB MODULE B");
  ctx.restore();

  const flowX1 = leftModule.x + moduleW + 22;
  const flowX2 = rightModule.x - 22;
  const flowW = flowX2 - flowX1;
  const cards = [
    ["01", "REWRITE", "CNOT → Pauli pattern"],
    ["02", "ADDRESS", "shift to native support"],
    ["03", "SURGERY", "LPU + adapter checks"],
    ["04", "CORRECT", "decode + feed-forward"],
  ];
  const cardGap = 7;
  const cardW = (flowW - cardGap * 3) / 4;
  const cardY = moduleY - 28;
  cards.forEach(([num, title, detail], i) => {
    const local = ease((compile * 1.28 - i * 0.09));
    const x = flowX1 + i * (cardW + cardGap);
    ctx.save(); ctx.globalAlpha = local;
    roundRect(x, cardY, cardW, 56, 9);
    ctx.fillStyle = "rgba(17,35,44,.92)"; ctx.fill();
    ctx.strokeStyle = i === 2 ? "rgba(50,214,173,.48)" : "rgba(133,161,181,.2)"; ctx.stroke();
    mono(num, x + 9, cardY + 14, 6.5, i === 2 ? colors.green : "rgba(109,243,255,.55)");
    mono(title, x + 9, cardY + 29, 7.5, "rgba(229,241,249,.88)");
    mono(detail, x + 9, cardY + 43, 5.8, "rgba(148,171,187,.65)");
    if (i < cards.length - 1) {
      ctx.strokeStyle = "rgba(109,243,255,.35)";
      ctx.beginPath(); ctx.moveTo(x + cardW, cardY + 28); ctx.lineTo(x + cardW + cardGap, cardY + 28); ctx.stroke();
    }
    ctx.restore();
  });
  badge("CONTROL OVERHEAD, NOT ENCODING OVERHEAD", width / 2, bottomY + bottomH - 17, colors.amber, compile);
}

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

function drawPlacementOrdering(canvas: HTMLCanvasElement, progress: number) {
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

  const conflictT = ease((progress - 0.08) / 0.24);
  const spectralT = ease((progress - 0.34) / 0.34);
  const resultsT = ease((progress - 0.72) / 0.28);
  const inset = clamp(width * 0.045, 48, 82);
  const leftX = inset;
  const leftW = width * 0.455 - inset;
  const panelY = 16;
  const panelH = height - 32;
  const graphTop = panelY + 88;
  const metricsH = clamp(height * 0.13, 82, 112);
  const graphBottom = panelY + panelH - metricsH - 35;
  const graphH = graphBottom - graphTop;
  const columnGap = clamp(leftW * 0.026, 8, 15);
  const columnW = (leftW - columnGap * 2) / 3;
  const moduleW = clamp(columnW * 0.42, 64, 94);
  const moduleH = clamp(graphH * 0.11, 34, 48);

  const startSlots = [
    [0, 0], [1, 2], [2, 0],
    [0, 2], [2, 2], [1, 0],
    [0, 1], [2, 1], [1, 1],
  ];
  const spectralSlots = [
    [0, 0], [0, 1], [0, 2],
    [1, 0], [1, 1], [1, 2],
    [2, 0], [2, 1], [2, 2],
  ];
  const interactions = [
    [0, 1], [1, 2], [0, 2],
    [3, 4], [4, 5], [3, 5],
    [6, 7], [7, 8], [6, 8],
  ];

  const pointFor = (moduleIndex: number): Point => {
    const [startCol, startRow] = startSlots[moduleIndex];
    const [endCol, endRow] = spectralSlots[moduleIndex];
    const col = mix(startCol, endCol, spectralT);
    const row = mix(startRow, endRow, spectralT);
    return {
      x: leftX + columnW / 2 + col * (columnW + columnGap),
      y: graphTop + graphH * (0.19 + row * 0.31),
    };
  };

  const roundRect = (x: number, y: number, w: number, h: number, radius = 12) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
  };
  const mono = (
    text: string,
    x: number,
    y: number,
    size = 8,
    color = "rgba(176,201,219,.68)",
    align: CanvasTextAlign = "left",
  ) => {
    ctx.save();
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.font = `600 ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  ctx.save();
  roundRect(leftX, panelY, leftW, panelH, 16);
  ctx.fillStyle = "rgba(7,18,31,.76)";
  ctx.fill();
  ctx.strokeStyle = `rgba(${Math.round(mix(255, 50, spectralT))}, ${Math.round(mix(189, 214, spectralT))}, ${Math.round(mix(102, 173, spectralT))}, .24)`;
  ctx.stroke();
  ctx.restore();

  mono("THE PLACEMENT PROBLEM", leftX + 20, panelY + 28, 10, spectralT > 0.55 ? colors.green : colors.amber);
  mono("SAME BB MODULES · DIFFERENT PHYSICAL ORDER", leftX + 20, panelY + 46, 7, "rgba(137,161,181,.58)");
  ctx.save();
  roundRect(leftX + leftW - 175, panelY + 17, 154, 31, 8);
  ctx.fillStyle = spectralT > 0.5 ? "rgba(50,214,173,.09)" : "rgba(255,189,102,.08)";
  ctx.fill();
  ctx.strokeStyle = spectralT > 0.5 ? "rgba(50,214,173,.34)" : "rgba(255,189,102,.3)";
  ctx.stroke();
  ctx.restore();
  mono(
    spectralT > 0.5 ? "SPECTRAL ORDERING" : "ARBITRARY ORDERING",
    leftX + leftW - 98,
    panelY + 37,
    7.2,
    spectralT > 0.5 ? colors.green : colors.amber,
    "center",
  );

  for (let col = 0; col < 3; col++) {
    const x = leftX + col * (columnW + columnGap);
    ctx.save();
    roundRect(x, graphTop - 12, columnW, graphH + 24, 11);
    ctx.fillStyle = "rgba(9,24,36,.44)";
    ctx.fill();
    ctx.strokeStyle = spectralT > 0.4 ? "rgba(50,214,173,.16)" : "rgba(117,151,176,.14)";
    ctx.stroke();
    ctx.restore();
    mono(`COMPUTE COLUMN ${col + 1}`, x + columnW / 2, graphTop + 5, 6.3, "rgba(130,157,178,.5)", "center");
  }

  const longMidpoints: Point[] = [];
  interactions.forEach(([aIndex, bIndex], edgeIndex) => {
    const a = pointFor(aIndex);
    const b = pointFor(bIndex);
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    const isLong = distance > columnW * 0.78;
    if (isLong && longMidpoints.length < 3) {
      longMidpoints.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    }
    ctx.save();
    ctx.globalAlpha = 0.42 + spectralT * 0.34;
    ctx.strokeStyle = spectralT > 0.45 ? colors.green : isLong ? colors.amber : colors.blue;
    ctx.lineWidth = spectralT > 0.45 ? 2.1 : isLong ? 1.8 : 1.15;
    if (isLong && spectralT < 0.35) ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    const bow = (edgeIndex % 3 - 1) * 25 * (1 - spectralT);
    ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + bow, b.x, b.y);
    ctx.stroke();
    ctx.restore();
  });

  if (conflictT > 0.02 && spectralT < 0.88) {
    longMidpoints.forEach((point, index) => {
      const visibility = conflictT * (1 - spectralT);
      const pulse = 1 + 0.12 * Math.sin(performance.now() / 180 + index);
      ctx.save();
      ctx.globalAlpha = visibility;
      ctx.strokeStyle = colors.pink;
      ctx.lineWidth = 2;
      ctx.shadowColor = colors.pink;
      ctx.shadowBlur = 13;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 9 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
    mono("LONG BRIDGES + AOD MOVE CONFLICTS", leftX + leftW / 2, graphBottom + 20, 7.5, colors.pink, "center");
  }

  for (let moduleIndex = 0; moduleIndex < 9; moduleIndex++) {
    const point = pointFor(moduleIndex);
    const group = Math.floor(moduleIndex / 3);
    const accent = [colors.blue, colors.violet, colors.green][group];
    ctx.save();
    roundRect(point.x - moduleW / 2, point.y - moduleH / 2, moduleW, moduleH, 8);
    ctx.fillStyle = "rgba(11,30,44,.95)";
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.globalAlpha = 0.92;
    ctx.stroke();
    ctx.restore();
    mono(`M${moduleIndex}`, point.x, point.y + 3, 8.5, accent, "center");
    mono(`12L · 288P`, point.x, point.y + 15, 5.5, "rgba(146,173,193,.54)", "center");
  }

  if (spectralT > 0.35) {
    ctx.save();
    ctx.globalAlpha = ease((spectralT - 0.35) / 0.65);
    roundRect(leftX + 16, graphTop + 13, leftW - 32, 30, 8);
    ctx.fillStyle = "rgba(50,214,173,.075)";
    ctx.fill();
    ctx.strokeStyle = "rgba(50,214,173,.24)";
    ctx.stroke();
    ctx.restore();
    mono("FIEDLER ORDER → STRONGLY INTERACTING MODULES STAY CLOSE", leftX + leftW / 2, graphTop + 33, 6.9, colors.green, "center");
  }

  const metricY = panelY + panelH - metricsH - 14;
  const metricGap = 9;
  const metricW = (leftW - 40 - metricGap * 2) / 3;
  const metrics = [
    ["AVG PARTNER TRAVEL", mix(550.59, 361.91, spectralT), "", "34% LOWER"],
    ["BRIDGE ROUNDS / LAYER", mix(14.62, 8.02, spectralT), "", "45% FEWER"],
    ["BRIDGE MICRO-STEPS", mix(1491.3, 810.0, spectralT), "", "46% FEWER"],
  ] as const;
  metrics.forEach(([label, value, suffix, improvement], index) => {
    const x = leftX + 20 + index * (metricW + metricGap);
    ctx.save();
    roundRect(x, metricY, metricW, metricsH, 10);
    ctx.fillStyle = spectralT > 0.4 ? "rgba(50,214,173,.055)" : "rgba(255,189,102,.045)";
    ctx.fill();
    ctx.strokeStyle = spectralT > 0.4 ? "rgba(50,214,173,.2)" : "rgba(255,189,102,.16)";
    ctx.stroke();
    ctx.restore();
    mono(label, x + 10, metricY + 20, 5.8, "rgba(134,161,181,.62)");
    const digits = index === 0 ? value.toFixed(0) : index === 1 ? value.toFixed(1) : value.toFixed(0);
    mono(`${digits}${suffix}`, x + 10, metricY + 48, 15, spectralT > 0.4 ? colors.green : colors.amber);
    if (spectralT > 0.55) {
      ctx.save(); ctx.globalAlpha = ease((spectralT - 0.55) / 0.45);
      mono(improvement, x + 10, metricY + metricsH - 12, 6.2, colors.green);
      ctx.restore();
    }
  });

  const rightX = width * 0.505;
  ctx.save();
  ctx.globalAlpha = 0.18 + resultsT * 0.2;
  roundRect(rightX, panelY, width - rightX - inset, panelH, 16);
  ctx.fillStyle = "rgba(6,17,28,.7)";
  ctx.fill();
  ctx.strokeStyle = "rgba(50,214,173,.24)";
  ctx.stroke();
  ctx.restore();
  mono("PARK-N-RIDE RESULTS", rightX + 20, panelY + 28, 10, colors.green);
  mono("SPECTRAL PLACEMENT WINS ACROSS BOTH SCALING AXES", rightX + 20, panelY + 46, 7, "rgba(137,161,181,.58)");
}

function placementPhase(progress: number) {
  if (progress < 0.18) {
    return {
      number: "01",
      label: "Pack modules into compute columns",
      description: "The same BB modules can be ordered many different ways on the atom array.",
    };
  }
  if (progress < 0.5) {
    return {
      number: "02",
      label: "Long partners create conflicts",
      description: "Distant joint-measurement partners need longer bridge travel and more serialized motion.",
    };
  }
  if (progress < 0.82) {
    return {
      number: "03",
      label: "Order the interaction graph spectrally",
      description: "Fiedler ordering co-locates strongly interacting modules before column packing.",
    };
  }
  return {
    number: "04",
    label: "Spectral placement wins",
    description: "The paper reports the lowest estimated runtime at every size and every column capacity.",
  };
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
  const transitionRef = useRef<{
    from: number;
    to: number;
    start: number | null;
  } | null>(null);
  const [screen, setScreen] = useState(0);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const slideStops = SLIDE_STOPS[screen];
  const finalStop = slideStops[slideStops.length - 1];
  const step = progress * TOTAL_STEPS;
  const phase =
    screen === 0
      ? {
          number: "00",
          label: "Title",
          description: "Hardware-aware BB-code execution on neutral atoms.",
        }
      : screen === 1
        ? connectivityPhase(progress)
      : screen === 2
          ? classicalBitPhase(progress)
        : screen === 3
            ? logicalQubitPhase(progress)
          : screen === 4
              ? scalingPhase(progress)
            : screen === 5
                ? gateComplexityPhase(progress)
              : screen === 6
                  ? phaseForStep(step)
                  : screen === 7
                    ? parkPhase(progress)
                    : screen === 8
                      ? parallelPhase(progress)
                      : placementPhase(progress);

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
      const transition = transitionRef.current;
      if (transition) {
        if (transition.start === null) transition.start = time;
        const transitionProgress = clamp((time - transition.start) / STEP_TRANSITION_MS);
        setBoundedProgress(mix(transition.from, transition.to, ease(transitionProgress)));
        if (transitionProgress >= 1) transitionRef.current = null;
      } else if (playing) {
        const next = progressRef.current + delta / RUN_TIME_MS;
        if (next >= finalStop) {
          setBoundedProgress(finalStop);
          setPlaying(false);
        } else {
          setBoundedProgress(next);
        }
      }
      if (canvasRef.current) {
        if (screen === 1) {
          drawConnectivityIntro(canvasRef.current, progressRef.current);
        } else if (screen === 2) {
          drawClassicalBitIntro(canvasRef.current, progressRef.current);
        } else if (screen === 3) {
          drawLogicalQubitIntro(canvasRef.current, progressRef.current);
        } else if (screen === 4) {
          drawScalingComparison(canvasRef.current, progressRef.current);
        } else if (screen === 5) {
          drawGateComplexity(canvasRef.current, progressRef.current);
        } else if (screen === 6) {
          drawShift(canvasRef.current, progressRef.current * TOTAL_STEPS);
        } else if (screen === 7) {
          drawAodShift(canvasRef.current, progressRef.current);
        } else if (screen === 8) {
          drawParallelAod(canvasRef.current, progressRef.current);
        } else if (screen === 9) {
          drawPlacementOrdering(canvasRef.current, progressRef.current);
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      lastTimeRef.current = null;
    };
  }, [finalStop, playing, screen, setBoundedProgress]);

  const replay = useCallback(() => {
    transitionRef.current = null;
    setBoundedProgress(0);
    setPlaying(true);
  }, [setBoundedProgress]);

  const changeScreen = useCallback(
    (nextScreen: number, initialProgress = 0) => {
      const bounded = Math.max(0, Math.min(9, nextScreen));
      if (bounded === screen) return;
      transitionRef.current = null;
      setScreen(bounded);
      setBoundedProgress(initialProgress);
      setPlaying(false);
    },
    [screen, setBoundedProgress],
  );

  const animateTo = useCallback((target: number) => {
    setPlaying(false);
    transitionRef.current = {
      from: progressRef.current,
      to: clamp(target),
      start: null,
    };
  }, []);

  const advance = useCallback(() => {
    const current = progressRef.current;
    const nextStop = slideStops.find((stop) => stop > current + 0.012);
    if (nextStop !== undefined) {
      animateTo(nextStop);
    } else if (screen < 9) {
      changeScreen(screen + 1, 0);
    }
  }, [animateTo, changeScreen, screen, slideStops]);

  const retreat = useCallback(() => {
    const current = progressRef.current;
    const previousStops = [...slideStops].reverse();
    const previousStop = previousStops.find((stop) => stop < current - 0.012);
    if (previousStop !== undefined) {
      animateTo(previousStop);
    } else if (screen > 0) {
      const previousSlideStops = SLIDE_STOPS[screen - 1];
      changeScreen(screen - 1, previousSlideStops[previousSlideStops.length - 1]);
    }
  }, [animateTo, changeScreen, screen, slideStops]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        advance();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        retreat();
      }
      if (event.key === " ") {
        event.preventDefault();
        if (screen === 0) return;
        if (progressRef.current >= finalStop - 0.001) replay();
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
  }, [advance, finalStop, replay, retreat, screen]);

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
    progress < 0.34 ? 0 : progress < 0.64 ? 1 : 2;
  const parallelDrops = Math.round(3 * ease((progress * 5 - 3.15) / 1.45));
  const connectivityTarget =
    progress <= 0.001
      ? "fixed ↔ mobile"
      : progress <= 0.281
        ? "middle"
        : "right";
  const adaptiveLinks =
    progress <= 0.28
      ? Math.round(3 * ease(progress / 0.28))
      : 3;

  const titles = [
    {
      kicker: "Rice University · Park ’n Ride",
      title: "Hardware-Aware Compilation and Execution of Bivariate Bicycle Codes on Neutral-Atom Systems",
      primaryLabel: "",
      primaryValue: "",
      primaryNote: "",
      costs: [],
      timeline: [],
      note: "",
    },
    {
      kicker: "Hardware connectivity · the architectural divide",
      title: "Fixed couplers or interactions that move?",
      primaryLabel: "Connectivity model",
      primaryValue: connectivityTarget,
      primaryNote: "fabricated edges versus position-defined edges",
      costs: [
        ["Superconducting grid", "degree ≤ 4", "fixed nearest neighbors"],
        ["Transported atoms", "3", "one AOD column"],
        ["Active Rydberg links", adaptiveLinks.toString(), "change with position"],
        ["Hardware rewiring", "0", "motion changes the graph"],
      ],
      timeline: ["Fixed grid", "Meet middle", "Meet right"],
      note: "Conceptual connectivity comparison · Rydberg interactions appear when transported atoms enter the interaction radius",
    },
    {
      kicker: "Classical error correction · the intuition",
      title: "One bad bit should not decide the answer.",
      primaryLabel: "Stored copies",
      primaryValue: "1 → 7",
      primaryNote: "add redundancy before transmission",
      costs: [
        ["Original value", "1", "the intended bit"],
        ["Flipped copies", "1", "/ 7 stored bits"],
        ["Majority result", "1", "six votes to one"],
        ["Recovered correctly", "yes", "without trusting one bit"],
      ],
      timeline: ["Store one bit", "Bit flip", "Repeat ×7", "Majority vote"],
      note: "Classical repetition-code intuition · seven copies can tolerate one flipped bit with a wide voting margin",
    },
    {
      kicker: "Quantum error correction · the core idea",
      title: "From a fragile qubit to a logical qubit.",
      primaryLabel: "Quantum information encoded",
      primaryValue: "1 → 7",
      primaryNote: "physical systems in a small color code",
      costs: [
        ["Bare physical qubit", "1", "error acts directly"],
        ["Logical qubit", "1", "distributed state"],
        ["Correctable local errors", "0 → 1", "distance-3 illustration"],
        ["Logical state measured", "no", "syndrome only"],
      ],
      timeline: ["Physical qubit", "X / Z / Y errors", "Encode", "Detect + correct"],
      note: "Conceptual 7-qubit color-code illustration · syndromes expose the error, not |ψ⟩",
    },
    {
      kicker: "Encoding overhead · distance scaling",
      title: "Why qLDPC changes the scaling.",
      primaryLabel: "Logical qubits per BB block",
      primaryValue: "12",
      primaryNote: "gross and two-gross",
      costs: [
        ["Surface patch", "Θ(d²)", "per logical qubit"],
        ["Color patch", "Θ(d²)", "per logical qubit"],
        ["Gross → two-gross", progress < 0.24 ? "144" : "144→288", "code qubits"],
        ["Good qLDPC target", "k,d∝n", "constant rate + linear distance"],
      ],
      timeline: ["Small codes", "Increase distance", "Reveal scaling", "Compare overhead"],
      note: "Gross examples are finite BB codes · asymptotic statement applies to good qLDPC families",
    },
    {
      kicker: "Logical gates · the qLDPC tradeoff",
      title: "Fewer qubits. Harder logical control.",
      primaryLabel: "Direct physical gate layers",
      primaryValue: progress < 0.48 ? "1" : "→ protocol",
      primaryNote: "bitwise CSS → BB instruction stack",
      costs: [
        ["CSS blockwise CNOT", "depth 1*", "pairwise connectivity"],
        ["BB shift automorphism", "14", "physical timesteps each"],
        ["BB logical measurement", "120 / 216", "gross / two-gross timesteps"],
        ["Arbitrary Pauli synthesis", "≈18.5", "bicycle measurements · mean"],
      ],
      timeline: ["Align blocks", "Bitwise CNOT", "Select BB qubits", "Compile + surgery"],
      note: "*Blockwise transversal CNOT assumes matching pairwise couplers · BB costs from Tour de Gross Tables 2 and Fig. 9",
    },
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
    {
      kicker: "Static module placement · spectral seriation",
      title: "Where modules sit determines how far bridges move.",
      primaryLabel: "Placement strategy",
      primaryValue: "spectral",
      primaryNote: "weighted interaction graph → compute columns",
      costs: [
        ["Partner travel", "−34%", "at 113 modules vs. greedy"],
        ["Bridge rounds", "−45%", "per logical layer"],
        ["Bridge micro-steps", "−46%", "motion-time proxy"],
        ["Runtime rank", "#1", "all sizes + capacities"],
      ],
      timeline: ["Arbitrary order", "Move conflicts", "Spectral order", "Measured results"],
      note: "Park-n-Ride Figs. 7–8 and Table II · module order changes travel distance and AOD contention",
    },
  ] as const;
  const current = titles[screen];
  const legends =
    screen <= 5 || screen === 9
      ? []
      : screen === 6
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
          ["state-dot", screen === 7 ? "captured wrap strip" : "module motion"],
        ];

  return (
    <main className={`present-shell screen-${screen}${screen === 0 ? " is-title-screen" : ""}`}>
      {screen > 0 && <header className="present-header">
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
          {["Title", "Connectivity", "Classical bits", "Logical qubits", "Why qLDPC", "Gate tradeoff", "Fixed couplers", "Park ’n Ride", "Parallel column", "Placement results"].map((label, index) => (
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
      </header>}

      <section className="present-stage">
        {screen === 0 ? (
          <section className="title-slide" aria-labelledby="presentation-title">
            <div className="title-slide-logo">
              <img
                src={`${import.meta.env.BASE_URL}presenters/rice-university.svg`}
                alt="Rice University"
              />
            </div>
            <p className="title-slide-kicker">40th SCI Summer Research Colloquium</p>
            <h1 id="presentation-title">
              <em>Hardware-Aware Compilation and Execution of Bivariate Bicycle Codes on Neutral-Atom Systems</em>
            </h1>
            <div className="title-rule" aria-hidden="true" />
            <div className="author-row" aria-label="Authors">
              {[
                ["Jason Ludmir", "jason-ludmir.jpg", "lead-author"],
                ["Aditya Ranjan", "aditya-ranjan.jpg", ""],
                ["Nicholas S. DiBrita", "nicholas-dibrita.jpeg", ""],
                ["Jason Han", "jason-han.jpeg", ""],
                ["Dr. Tirthak Patel", "tirthak-patel.png", ""],
              ].map(([name, image, className]) => (
                <article className={`author-card ${className}`} key={name}>
                  <div className="author-portrait">
                    <img src={`${import.meta.env.BASE_URL}presenters/${image}`} alt={name} />
                  </div>
                  <h2>{name}</h2>
                </article>
              ))}
            </div>
          </section>
        ) : <canvas
          ref={canvasRef}
          className="present-canvas"
          aria-label={
            screen === 1
              ? "Animated comparison of fixed superconducting connectivity and mobile neutral-atom connectivity"
              : screen === 2
                ? "Animated classical bit flip and seven-bit majority-vote repetition code"
                : screen === 3
                  ? "Animated introduction to physical errors and logical qubit encoding with a color code"
                  : screen === 4
                    ? "Animated comparison of surface, color, and bivariate bicycle code scaling"
                    : screen === 5
                      ? "Animated comparison of transversal CSS gates and BB logical-control complexity"
                      : screen === 6
                        ? "Animated fixed-coupler shift automorphism"
                        : screen === 7
                          ? "Animated Park-n-Ride AOD shift automorphism"
                          : screen === 8
                            ? "Three Park-n-Ride modules shifting in parallel"
                            : "Animated comparison of arbitrary and spectral BB-module placement with Park-n-Ride result plots"
          }
        />}
        {screen === 9 && (
          <div className="placement-result-plots">
            <figure
              style={{
                opacity: ease((progress - 0.72) / 0.16),
                transform: `translateY(${mix(18, 0, ease((progress - 0.72) / 0.16))}px)`,
              }}
            >
              <div className="placement-plot-label"><span>FIG. 7</span> Scaling with circuit size</div>
              <img
                src={`${import.meta.env.BASE_URL}paper-results/figure-7-runtime-vs-modules.png`}
                alt="Park-n-Ride Figure 7: spectral placement has the lowest average estimated runtime at every module count"
              />
            </figure>
            <figure
              style={{
                opacity: ease((progress - 0.8) / 0.16),
                transform: `translateY(${mix(18, 0, ease((progress - 0.8) / 0.16))}px)`,
              }}
            >
              <div className="placement-plot-label"><span>FIG. 8</span> Scaling with column capacity</div>
              <img
                src={`${import.meta.env.BASE_URL}paper-results/figure-8-runtime-vs-capacity.png`}
                alt="Park-n-Ride Figure 8: spectral placement has the lowest average estimated runtime at every compute-column capacity"
              />
            </figure>
            <div
              className="placement-takeaway"
              style={{ opacity: ease((progress - 0.91) / 0.09) }}
            >
              <strong>Spectral is best in every comparison.</strong>
              <span>At 113 modules: &gt;2 s faster than arbitrary placement · 45% fewer bridge rounds than greedy.</span>
            </div>
          </div>
        )}
        {legends.length > 0 && (
          <div className="present-legend" aria-hidden="true">
            {legends.map(([className, label]) => (
              <span key={label}><i className={className} />{label}</span>
            ))}
          </div>
        )}
        {screen > 0 && !(screen === 2 && progress < 0.43) && <div className="present-shift">
          <span>
            {screen === 1
              ? "physical layout ↔ connectivity graph"
              : screen === 2
                ? "one classical value"
                : screen === 3
                  ? "one quantum state"
                  : screen === 4
                    ? "topological patches vs qLDPC block"
                    : screen === 5
                      ? "logical entangling gate"
                      : screen === 9
                        ? "weighted module-interaction graph"
                      : screen === 8
                        ? "shared physical directions"
                        : "global permutation"}
          </span>
          <strong>
            {screen === 1
              ? "fixed edges ↔ moving edges"
              : screen === 2
                ? "1 → 1111111"
                : screen === 3
                  ? "|ψ⟩ → |ψ⟩ₗ"
                  : screen === 4
                    ? "1 logical ↔ 12 logical"
                    : screen === 5
                      ? "direct layer ↔ control stack"
                      : screen === 9
                        ? "Fiedler order → column packing"
                      : screen === 8
                        ? "+x · +y"
                        : "+3x · −1y"}
          </strong>
        </div>}
        <button
          className="deck-edge deck-edge-left"
          onClick={retreat}
          disabled={screen === 0 && progress <= 0.001}
          aria-label="Previous state or presentation screen"
        >
          ←
        </button>
        <button
          className="deck-edge deck-edge-right"
          onClick={advance}
          disabled={screen === 9 && progress >= finalStop - 0.001}
          aria-label="Next state or presentation screen"
        >
          →
        </button>
      </section>

      {screen === 0 ? (
        <footer className="title-controls">
          <span className="title-controls-rule" aria-hidden="true" />
          <p><kbd>→</kbd> Begin presentation</p>
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
        </footer>
      ) : <footer className="present-controls">
        <button
          className="present-play"
          onClick={() => {
            if (progress >= finalStop - 0.001) replay();
            else {
              transitionRef.current = null;
              setPlaying((value) => !value);
            }
          }}
        >
          <span className={playing ? "pause-icon" : "play-icon"} />
          {progress >= finalStop - 0.001 ? "Replay" : playing ? "Pause" : "Play"}
        </button>
        <div className="present-timeline">
          <input
            type="range"
            min="0"
            max={finalStop}
            step="0.001"
            value={progress}
            style={{ "--timeline-progress": `${(progress / finalStop) * 100}%` } as React.CSSProperties}
            aria-label="Shift timeline"
            onChange={(event) => {
              transitionRef.current = null;
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
      </footer>}
    </main>
  );
}
