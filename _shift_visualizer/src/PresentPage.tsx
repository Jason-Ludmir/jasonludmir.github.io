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

function classicalBitPhase(progress: number) {
  if (progress < 0.23) {
    return {
      number: "01",
      label: "Store one classical bit",
      description: "The intended value is written into a single physical device.",
    };
  }
  if (progress < 0.46) {
    return {
      number: "02",
      label: "One fault flips the answer",
      description: "With only one copy, the receiver cannot tell that 1 became 0.",
    };
  }
  if (progress < 0.72) {
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
    ctx.font = `600 ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
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
    ctx.save(); ctx.globalAlpha = alpha;
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
  bitCell(sourceX, leftY, "1", colors.cyan, 1, false, clamp(panelH * 0.25, 76, 118));
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

  bitCell(targetX, leftY, flip > 0.5 ? "0" : "1", flip > 0.5 ? colors.amber : colors.cyan, 1, flip > 0.5, clamp(panelH * 0.25, 76, 118));
  mono(flip > 0.5 ? "WRONG" : "READ", targetX, leftY - clamp(panelH * 0.16, 54, 78), 7, flip > 0.5 ? colors.amber : colors.cyan, "center");
  mono("ONE FLIP → THE STORED ANSWER IS LOST", leftX + panelW / 2, panelY + panelH - 26, 8, colors.amber, "center");

  const rightX = inset + panelW + gap;
  mono("7-BIT REPETITION CODE", rightX + 18, panelY + 24, 10, colors.green);
  mono("CLASSICAL REDUNDANCY + MAJORITY VOTE", rightX + 18, panelY + 39, 7, "rgba(137,161,181,.58)");

  const cellsY = panelY + panelH * 0.38;
  const cellSize = clamp(panelW * 0.083, 35, 52);
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
}

function logicalQubitPhase(progress: number) {
  if (progress < 0.24) {
    return {
      number: "01",
      label: "A physical qubit is fragile",
      description: "Its state is stored in one physical system, so a local error directly changes it.",
    };
  }
  if (progress < 0.5) {
    return {
      number: "02",
      label: "Errors change the state",
      description: "Bit flips, phase flips, and combined errors move the encoded information.",
    };
  }
  if (progress < 0.74) {
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
    ctx.font = `600 ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
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
  const radius = clamp(panelH * 0.23, 68, 112);
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
  const scale = clamp(panelH * 0.19, 62, 96);
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
  roundRect(centerX - 55, centerY - 13, 110, 27, 13);
  ctx.fillStyle = "rgba(6,22,27,.86)"; ctx.fill();
  ctx.strokeStyle = "rgba(50,214,173,.5)"; ctx.stroke();
  mono("|ψ⟩  →  |ψ⟩ₗ", centerX, centerY + 4, 10, colors.green, "center");
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
  if (progress < 0.24) {
    return {
      number: "01",
      label: "Start with the small codes",
      description: "Distance-3 surface and color patches sit above the gross BB code.",
    };
  }
  if (progress < 0.68) {
    return {
      number: "02",
      label: "Increase error distance",
      description: "Distance-7 patches and the distance-18 two-gross block enter at right.",
    };
  }
  return {
    number: "03",
    label: "Compare the overhead",
    description: "Two-dimensional topological patches grow quadratically with distance.",
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
  const formulaReveal = ease((progress - 0.62) / 0.27);
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
    ctx.save();
    ctx.globalAlpha = formulaReveal;
    ctx.fillStyle = "rgba(130, 153, 173, .66)";
    ctx.font = "500 7px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("PHYSICAL-QUBIT SCALING", formulaX, y - 18);
    ctx.fillStyle = accent;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12 * formulaReveal;
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
  const pairReveal = ease((progress - 0.04) / 0.2);
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
    ctx.font = `600 ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
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
      ? classicalBitPhase(progress)
      : screen === 1
        ? logicalQubitPhase(progress)
        : screen === 2
          ? scalingPhase(progress)
          : screen === 3
            ? gateComplexityPhase(progress)
            : screen === 4
              ? phaseForStep(step)
              : screen === 5
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
          drawClassicalBitIntro(canvasRef.current, progressRef.current);
        } else if (screen === 1) {
          drawLogicalQubitIntro(canvasRef.current, progressRef.current);
        } else if (screen === 2) {
          drawScalingComparison(canvasRef.current, progressRef.current);
        } else if (screen === 3) {
          drawGateComplexity(canvasRef.current, progressRef.current);
        } else if (screen === 4) {
          drawShift(canvasRef.current, progressRef.current * TOTAL_STEPS);
        } else if (screen === 5) {
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
      const bounded = Math.max(0, Math.min(6, nextScreen));
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
  ] as const;
  const current = titles[screen];
  const legends =
    screen <= 3
      ? []
      : screen === 4
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
          ["state-dot", screen === 5 ? "captured wrap strip" : "module motion"],
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
          {["Classical bits", "Logical qubits", "Why qLDPC", "Gate tradeoff", "Fixed couplers", "Park ’n Ride", "Parallel column"].map((label, index) => (
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
              ? "Animated classical bit flip and seven-bit majority-vote repetition code"
              : screen === 1
                ? "Animated introduction to physical errors and logical qubit encoding with a color code"
                : screen === 2
                  ? "Animated comparison of surface, color, and bivariate bicycle code scaling"
                  : screen === 3
                    ? "Animated comparison of transversal CSS gates and BB logical-control complexity"
                    : screen === 4
                      ? "Animated fixed-coupler shift automorphism"
                      : screen === 5
                        ? "Animated Park-n-Ride AOD shift automorphism"
                        : "Three Park-n-Ride modules shifting in parallel"
          }
        />
        {legends.length > 0 && (
          <div className="present-legend" aria-hidden="true">
            {legends.map(([className, label]) => (
              <span key={label}><i className={className} />{label}</span>
            ))}
          </div>
        )}
        <div className="present-shift">
          <span>
            {screen === 0
              ? "one classical value"
              : screen === 1
                ? "one quantum state"
                : screen === 2
                  ? "topological patches vs qLDPC block"
                  : screen === 3
                    ? "logical entangling gate"
                    : screen === 6
                      ? "shared physical directions"
                      : "global permutation"}
          </span>
          <strong>
            {screen === 0
              ? "1 → 1111111"
              : screen === 1
                ? "|ψ⟩ → |ψ⟩ₗ"
                : screen === 2
                  ? "1 logical ↔ 12 logical"
                  : screen === 3
                    ? "direct layer ↔ control stack"
                    : screen === 6
                      ? "+x · +y"
                      : "+3x · −1y"}
          </strong>
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
          disabled={screen === 6}
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
