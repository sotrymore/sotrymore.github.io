import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAssistant } from "./useAssistant";
import type { VoiceCommand } from "./useAssistant";

// ── Константы 

const ROWS = 6;
const COLS = 7;
const EMPTY = 0;

// ── Игровая логика

function createBoard(): number[][] {
  return Array(ROWS).fill(null).map(() => Array(COLS).fill(EMPTY));
}

interface WinResult {
  player: number;
  cells: [number, number][];
}

function checkWinner(board: number[][]): WinResult | null {
  const dirs: [number, number][] = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!board[r][c]) continue;
      for (const [dr, dc] of dirs) {
        const cells: [number, number][] = [[r, c]];
        for (let i = 1; i < 4; i++) {
          const nr = r + dr * i, nc = c + dc * i;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;
          if (board[nr][nc] !== board[r][c]) break;
          cells.push([nr, nc]);
        }
        if (cells.length === 4) return { player: board[r][c], cells };
      }
    }
  }
  return null;
}

function isDraw(board: number[][]): boolean {
  return board[0].every(c => c !== EMPTY);
}

function getLowestEmpty(board: number[][], col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r][col] === EMPTY) return r;
  }
  return -1;
}

function getAvailableCols(board: number[][]): number[] {
  return Array.from({ length: COLS }, (_, c) => c).filter(c => board[0][c] === EMPTY);
}

function scoreWindow(win: number[], player: number): number {
  const opp = player === 1 ? 2 : 1;
  const p = win.filter(x => x === player).length;
  const e = win.filter(x => x === EMPTY).length;
  const o = win.filter(x => x === opp).length;
  if (p === 4) return 100;
  if (p === 3 && e === 1) return 5;
  if (p === 2 && e === 2) return 2;
  if (o === 3 && e === 1) return -4;
  return 0;
}

function scoreBoard(board: number[][], player: number): number {
  let score = 0;
  const mid = Math.floor(COLS / 2);
  score += board.map(r => r[mid]).filter(x => x === player).length * 3;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      score += scoreWindow(board[r].slice(c, c + 4), player);
  for (let c = 0; c < COLS; c++)
    for (let r = 0; r <= ROWS - 4; r++)
      score += scoreWindow([0, 1, 2, 3].map(i => board[r + i][c]), player);
  for (let r = 3; r < ROWS; r++)
    for (let c = 0; c <= COLS - 4; c++)
      score += scoreWindow([0, 1, 2, 3].map(i => board[r - i][c + i]), player);
  for (let r = 0; r <= ROWS - 4; r++)
    for (let c = 0; c <= COLS - 4; c++)
      score += scoreWindow([0, 1, 2, 3].map(i => board[r + i][c + i]), player);
  return score;
}

function minimax(
  board: number[][], depth: number, alpha: number, beta: number,
  maximizing: boolean, ai: number
): { score: number; col?: number } {
  const human = ai === 1 ? 2 : 1;
  const result = checkWinner(board);
  if (result) return { score: result.player === ai ? 100000 + depth : -100000 - depth };
  if (isDraw(board) || depth === 0) return { score: scoreBoard(board, ai) };
  const cols = getAvailableCols(board);
  let best: { score: number; col?: number } = { score: maximizing ? -Infinity : Infinity, col: cols[0] };
  for (const col of cols) {
    const row = getLowestEmpty(board, col);
    const nb = board.map(r => [...r]);
    nb[row][col] = maximizing ? ai : human;
    const { score } = minimax(nb, depth - 1, alpha, beta, !maximizing, ai);
    if (maximizing ? score > best.score : score < best.score) best = { score, col };
    if (maximizing) alpha = Math.max(alpha, best.score);
    else beta = Math.min(beta, best.score);
    if (alpha >= beta) break;
  }
  return best;
}

function getBotMove(board: number[][], level: number): number | null {
  const cols = getAvailableCols(board);
  if (!cols.length) return null;
  if (level === 1) return cols[Math.floor(Math.random() * cols.length)];
  if (level === 2) {
    for (const col of cols) {
      const r = getLowestEmpty(board, col);
      const t = board.map(x => [...x]); t[r][col] = 2;
      if (checkWinner(t)) return col;
    }
    for (const col of cols) {
      const r = getLowestEmpty(board, col);
      const t = board.map(x => [...x]); t[r][col] = 1;
      if (checkWinner(t)) return col;
    }
    return cols[Math.floor(Math.random() * cols.length)];
  }
  return minimax(board, 6, -Infinity, Infinity, true, 2).col ?? cols[0];
}

// ── Конфиг игроков 

const PC: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: "Игрок 1", color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
  2: { label: "Игрок 2", color: "#3b82f6", bg: "rgba(59,130,246,0.08)" },
};

const BOT_LEVELS = [
  { level: 1, label: "Лёгкий",  color: "#22c55e", desc: "Случайные ходы" },
  { level: 2, label: "Средний", color: "#f59e0b", desc: "Блокирует и атакует" },
  { level: 3, label: "Сложный", color: "#ef4444", desc: "Почти непобедим" },
];

// ── Хук для отслеживания размера экрана

function useBreakpoint() {
  const [bp, setBp] = useState(() => {
    const w = window.innerWidth;
    if (w < 480) return "xs";
    if (w < 768) return "sm";
    if (w < 1024) return "md";
    return "lg";
  });

  useEffect(() => {
    const handler = () => {
      const w = window.innerWidth;
      if (w < 480) setBp("xs");
      else if (w < 768) setBp("sm");
      else if (w < 1024) setBp("md");
      else setBp("lg");
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return bp;
}

// ── Disc 

function Disc({ player, winning }: { player: number; winning: boolean }) {
  const cfg = PC[player];
  return (
    <motion.div
      initial={{ y: -180, opacity: 0, scale: 0.4 }}
      animate={{ y: 0, opacity: 1, scale: 0.82 }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      style={{
        width: "100%", height: "100%", borderRadius: "50%",
        background: cfg.color,
        boxShadow: winning ? `0 0 0 3px #ffffff, 0 0 0 6px ${cfg.color}` : "none",
      }}
    />
  );
}

// ── Cell

function Cell({
  value, winning, hovered, onClick, disabled,
}: {
  value: number; winning: boolean; hovered: number | null;
  onClick: () => void; disabled: boolean;
}) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        width: "100%", aspectRatio: "1", background: "#0b1422",
        border: "2px solid #0a1020", borderRadius: "50%",
        cursor: value === EMPTY && !disabled ? "pointer" : "default",
        position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {hovered && value === EMPTY && !disabled && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 0.18, scale: 1 }}
          style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: PC[hovered].color, pointerEvents: "none",
          }}
        />
      )}
      {value !== EMPTY && (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Disc player={value} winning={winning} />
        </div>
      )}
    </div>
  );
}

// ── Голосовая подсказка 

function VoiceHint({ lastCmd, visible }: { lastCmd: string | null; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && lastCmd && (
        <motion.div
          key={lastCmd}
          initial={{ opacity: 0, y: 6, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          style={{
            position: "fixed", bottom: 16, left: "50%",
            transform: "translateX(-50%)", zIndex: 9999,
            background: "rgba(99,102,241,0.95)", backdropFilter: "blur(8px)",
            border: "1.5px solid rgba(99,102,241,0.5)",
            borderRadius: 40, padding: "8px 20px",
            color: "#fff", fontSize: 13, fontWeight: 700,
            letterSpacing: 0.5, pointerEvents: "none",
            display: "flex", alignItems: "center", gap: 8,
            boxShadow: "0 4px 24px rgba(99,102,241,0.4)",
            whiteSpace: "nowrap",
          }}
        >
          <span></span>
          <span>{lastCmd}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Панель голосовых команд

function VoiceCommandsHelp({ mode, compact = false }: { mode: "menu" | "game"; compact?: boolean }) {
  const menuCmds = [
    "Скажите «Два игрока», чтобы начать игру вдвоём.",
    "Скажите «Лёгкий», «Средний» или «Сложный», чтобы начать игру против бота.",
  ];

  const gameCmds = [
    "Назовите номер столбца от 1 до 7, чтобы сделать ход.",
    "«Заново» — начать новую игру.",
    "«В главное меню/Вернись в начало» — выйти из текущей игры.",
  ];

  const cmds = mode === "menu" ? menuCmds : gameCmds;

  return (
    <div style={{
      background: "rgba(99,102,241,0.08)",
      border: "2px solid rgba(99,102,241,0.25)",
      borderRadius: 16,
      padding: compact ? "12px 14px" : "20px 22px",
      marginTop: 8,
      marginBottom: 10,
    }}>
      <div style={{
        fontSize: compact ? 11 : 15,
        fontWeight: 800,
        letterSpacing: 2,
        color: "#6366f1",
        textTransform: "uppercase",
        marginBottom: compact ? 8 : 12,
      }}>
        Голосовые команды
      </div>

      {cmds.map((cmd, i) => (
        <div key={i} style={{
          fontSize: compact ? 12 : 18,
          color: "#cbd5f5",
          fontWeight: 600,
          padding: "4px 0",
          lineHeight: 1.5,
        }}>
          • {cmd}
        </div>
      ))}
    </div>
  );
}

// ── Меню 

function MenuScreen({
  onStartPvP, onStartBot, onVoiceCmd,
}: {
  onStartPvP: () => void;
  onStartBot: (level: number) => void;
  onVoiceCmd: (handler: (cmd: VoiceCommand) => void) => void;
}) {
  const [showLevels, setShowLevels] = useState(false);
  const bp = useBreakpoint();
  const isMobile = bp === "xs" || bp === "sm";
  const isTablet = bp === "md";

  useEffect(() => {
    onVoiceCmd((cmd) => {
      if (cmd.type === "START_PVP") onStartPvP();
      if (cmd.type === "START_BOT") onStartBot(cmd.level);
    });
  }, [onVoiceCmd, onStartPvP, onStartBot, showLevels]);

  // Мобильный вид — вертикальная колонка
  if (isMobile) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          width: "100%", height: "100%", display: "flex",
          flexDirection: "column", alignItems: "center",
          padding: "24px 20px", overflowY: "auto", gap: 16,
        }}
      >
        <motion.h1
          initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          style={{
            fontSize: "clamp(32px, 10vw, 52px)", fontWeight: 900,
            color: "#f8fafc", letterSpacing: -2, lineHeight: 1.05,
            textAlign: "center", marginBottom: 0,
          }}
        >
          ЧЕТЫРЕ <span style={{ color: "#6366f1" }}>В РЯД</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.16 }}
          style={{
            color: "#334155", fontSize: 10, fontWeight: 700,
            letterSpacing: 3, textTransform: "uppercase",
          }}
        >
          выбери режим игры
        </motion.p>

        <AnimatePresence mode="wait">
          {!showLevels ? (
            <motion.div
              key="main"
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}
              style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}
            >
              <motion.button
                whileHover={{ scale: 1.025 }} whileTap={{ scale: 0.975 }}
                onClick={onStartPvP}
                style={{
                  background: "#6366f1", border: "none", borderRadius: 14,
                  padding: "18px 24px", color: "#fff",
                  fontSize: 14, fontWeight: 700,
                  letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
                  width: "100%", textAlign: "left",
                }}
              >
                <div style={{ marginBottom: 4 }}>Два игрока</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>
                  Играйте вдвоём на одном экране
                </div>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.025 }} whileTap={{ scale: 0.975 }}
                onClick={() => setShowLevels(true)}
                style={{
                  background: "#8b5cf6", border: "none", borderRadius: 14,
                  padding: "18px 24px", color: "#fff",
                  fontSize: 14, fontWeight: 700,
                  letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
                  width: "100%", textAlign: "left",
                }}
              >
                <div style={{ marginBottom: 4 }}>Против бота</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>
                  Сразитесь с искусственным интеллектом
                </div>
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="levels"
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}
              style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}
            >
              <p style={{ color: "#334155", fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 6 }}>
                Уровень сложности
              </p>
              {BOT_LEVELS.map(({ level, label, color, desc }) => (
                <motion.button
                  key={level}
                  whileHover={{ scale: 1.025 }} whileTap={{ scale: 0.975 }}
                  onClick={() => onStartBot(level)}
                  style={{
                    background: `${color}12`, border: `2px solid ${color}40`,
                    borderRadius: 14, padding: "16px 20px", color: "#fff",
                    cursor: "pointer", width: "100%", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 14,
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>{desc}</div>
                  </div>
                </motion.button>
              ))}
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => setShowLevels(false)}
                style={{
                  background: "transparent", border: "2px solid #1e293b",
                  borderRadius: 12, padding: "12px", color: "#334155",
                  fontSize: 12, fontWeight: 700, cursor: "pointer", marginTop: 4, letterSpacing: 1,
                }}
              >
                Назад
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.24 }}
          style={{ width: "100%" }}
        >
          <VoiceCommandsHelp mode="menu" compact />
        </motion.div>
      </motion.div>
    );
  }

  // Планшетный вид — вертикальная колонка, чуть просторнее
  if (isTablet) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          width: "100%", height: "100%", display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "32px 40px", gap: 20, overflowY: "auto",
        }}
      >
        <motion.h1
          initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          style={{
            fontSize: "clamp(40px, 7vw, 64px)", fontWeight: 900,
            color: "#f8fafc", letterSpacing: -2, lineHeight: 1.05,
            textAlign: "center",
          }}
        >
          ЧЕТЫРЕ <span style={{ color: "#6366f1" }}>В РЯД</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.16 }}
          style={{ color: "#334155", fontSize: 11, fontWeight: 700, letterSpacing: 3.5, textTransform: "uppercase" }}
        >
          выбери режим игры
        </motion.p>

        <AnimatePresence mode="wait">
          {!showLevels ? (
            <motion.div
              key="main"
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}
              style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", maxWidth: 480 }}
            >
              <motion.button
                whileHover={{ scale: 1.025 }} whileTap={{ scale: 0.975 }}
                onClick={onStartPvP}
                style={{
                  background: "#6366f1", border: "none", borderRadius: 14,
                  padding: "20px 28px", color: "#fff",
                  fontSize: 15, fontWeight: 700,
                  letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
                  width: "100%", textAlign: "left",
                }}
              >
                <div style={{ marginBottom: 5 }}>Два игрока</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>
                  Играйте вдвоём на одном экране
                </div>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.025 }} whileTap={{ scale: 0.975 }}
                onClick={() => setShowLevels(true)}
                style={{
                  background: "#8b5cf6", border: "none", borderRadius: 14,
                  padding: "20px 28px", color: "#fff",
                  fontSize: 15, fontWeight: 700,
                  letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
                  width: "100%", textAlign: "left",
                }}
              >
                <div style={{ marginBottom: 5 }}>Против бота</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>
                  Сразитесь с искусственным интеллектом
                </div>
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="levels"
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}
              style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 480 }}
            >
              <p style={{ color: "#334155", fontSize: 11, fontWeight: 700, letterSpacing: 3.5, textTransform: "uppercase", marginBottom: 6 }}>
                Уровень сложности
              </p>
              {BOT_LEVELS.map(({ level, label, color, desc }) => (
                <motion.button
                  key={level}
                  whileHover={{ scale: 1.025 }} whileTap={{ scale: 0.975 }}
                  onClick={() => onStartBot(level)}
                  style={{
                    background: `${color}12`, border: `2px solid ${color}40`,
                    borderRadius: 14, padding: "18px 24px", color: "#fff",
                    cursor: "pointer", width: "100%", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 16,
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>{desc}</div>
                  </div>
                </motion.button>
              ))}
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => setShowLevels(false)}
                style={{
                  background: "transparent", border: "2px solid #1e293b",
                  borderRadius: 12, padding: "14px", color: "#334155",
                  fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 6, letterSpacing: 1,
                }}
              >
                Назад
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.24 }}
          style={{ width: "100%", maxWidth: 480 }}
        >
          <VoiceCommandsHelp mode="menu" compact />
        </motion.div>
      </motion.div>
    );
  }

  // Десктоп 
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{ width: "100%", height: "100%", display: "flex" }}
    >
      {/* Левая колонка */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "60px 48px", borderRight: "2px solid #1e293b",
        gap: 24,
      }}>
        <motion.h1
          initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          style={{
            fontSize: "clamp(48px, 5.5vw, 88px)", fontWeight: 900,
            color: "#f8fafc", letterSpacing: -3, lineHeight: 1.05,
            textAlign: "center",
          }}
        >
          ЧЕТЫРЕ<br /><span style={{ color: "#6366f1" }}>В РЯД</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.16 }}
          style={{
            color: "#334155", fontSize: "clamp(10px, 1vw, 13px)",
            fontWeight: 700, letterSpacing: 4, textTransform: "uppercase",
          }}
        >
          выбери режим игры
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.24 }}
          style={{ width: "100%", maxWidth: 320 }}
        >
          <VoiceCommandsHelp mode="menu" />
        </motion.div>
      </div>

      {/* Правая колонка */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: "60px",
      }}>
        <AnimatePresence mode="wait">
          {!showLevels ? (
            <motion.div
              key="main"
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}
              style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 400 }}
            >
              <p style={{ color: "#334155", fontSize: 11, fontWeight: 700, letterSpacing: 3.5, textTransform: "uppercase", marginBottom: 10 }}>
                Выбери режим игры
              </p>
              <motion.button
                whileHover={{ scale: 1.025 }} whileTap={{ scale: 0.975 }}
                onClick={onStartPvP}
                style={{
                  background: "#6366f1", border: "none", borderRadius: 14,
                  padding: "20px 28px", color: "#fff",
                  fontSize: "clamp(13px, 1.3vw, 16px)", fontWeight: 700,
                  letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
                  width: "100%", textAlign: "left",
                }}
              >
                <div style={{ marginBottom: 5 }}>Два игрока</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>
                  Играйте вдвоём на одном экране
                </div>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.025 }} whileTap={{ scale: 0.975 }}
                onClick={() => setShowLevels(true)}
                style={{
                  background: "#8b5cf6", border: "none", borderRadius: 14,
                  padding: "20px 28px", color: "#fff",
                  fontSize: "clamp(13px, 1.3vw, 16px)", fontWeight: 700,
                  letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
                  width: "100%", textAlign: "left",
                }}
              >
                <div style={{ marginBottom: 5 }}>Против бота</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>
                  Сразитесь с искусственным интеллектом
                </div>
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="levels"
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }}
              style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 400 }}
            >
              <p style={{ color: "#334155", fontSize: 11, fontWeight: 700, letterSpacing: 3.5, textTransform: "uppercase", marginBottom: 10 }}>
                Уровень сложности
              </p>
              {BOT_LEVELS.map(({ level, label, color, desc }) => (
                <motion.button
                  key={level}
                  whileHover={{ scale: 1.025 }} whileTap={{ scale: 0.975 }}
                  onClick={() => onStartBot(level)}
                  style={{
                    background: `${color}12`, border: `2px solid ${color}40`,
                    borderRadius: 14, padding: "18px 24px", color: "#fff",
                    cursor: "pointer", width: "100%", textAlign: "left",
                    display: "flex", alignItems: "center", gap: 16,
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>{desc}</div>
                  </div>
                </motion.button>
              ))}
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => setShowLevels(false)}
                style={{
                  background: "transparent", border: "2px solid #1e293b",
                  borderRadius: 12, padding: "14px", color: "#334155",
                  fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 6, letterSpacing: 1,
                }}
              >
                Назад
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ── Игра 

function GameScreen({
  mode, botLevel, onMenu, onVoiceCmd,
}: {
  mode: string;
  botLevel: number;
  onMenu: () => void;
  onVoiceCmd: (handler: (cmd: VoiceCommand) => void) => void;
}) {
  const [board, setBoard] = useState(createBoard());
  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [winner, setWinner] = useState<WinResult | null>(null);
  const [draw, setDraw] = useState(false);
  const [scores, setScores] = useState<Record<number, number>>({ 1: 0, 2: 0 });
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [locked, setLocked] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const [shaking, setShaking] = useState(false);

  const bp = useBreakpoint();
  const isMobile = bp === "xs" || bp === "sm";
  const isTablet = bp === "md";

  const stateRef = useRef({ board, currentPlayer, winner, draw, locked, scores });
  stateRef.current = { board, currentPlayer, winner, draw, locked, scores };

  const boardRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shake = useCallback(() => {
    setShaking(true);
    setTimeout(() => setShaking(false), 440);
  }, []);

  const applyMove = useCallback((
    col: number,
    snap: typeof stateRef.current
  ) => {
    const { board: b, currentPlayer: cp, scores: sc } = snap;
    const row = getLowestEmpty(b, col);
    if (row === -1) { shake(); setLocked(false); return; }
    const nb = b.map(r => [...r]);
    nb[row][col] = cp;
    setBoard(nb);
    setMoveCount(m => m + 1);
    const win = checkWinner(nb);
    if (win) {
      setWinner(win);
      setScores({ ...sc, [win.player]: sc[win.player] + 1 });
      setLocked(false); setBotThinking(false); return;
    }
    if (isDraw(nb)) { setDraw(true); setLocked(false); setBotThinking(false); return; }
    setCurrentPlayer(cp === 1 ? 2 : 1);
    setLocked(false);
  }, [shake]);

  useEffect(() => {
    if (mode !== "bot") return;
    if (stateRef.current.winner || stateRef.current.draw) return;
    if (stateRef.current.locked || botThinking) return;
    if (currentPlayer !== 2) return;
    const snap = { ...stateRef.current };
    setBotThinking(true); setLocked(true);
    const delay = botLevel === 3 ? 750 : botLevel === 2 ? 450 : 280;
    timerRef.current = setTimeout(() => {
      const col = getBotMove(snap.board, botLevel);
      setBotThinking(false);
      if (col !== null) applyMove(col, snap);
      else setLocked(false);
    }, delay);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [currentPlayer, mode]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleDrop = useCallback((col: number) => {
    const s = stateRef.current;
    if (s.winner || s.draw || s.locked) return;
    if (mode === "bot" && s.currentPlayer === 2) return;
    if (getLowestEmpty(s.board, col) === -1) { shake(); return; }
    setLocked(true);
    applyMove(col, s);
  }, [mode, shake, applyMove]);

  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setBoard(createBoard()); setCurrentPlayer(1); setWinner(null);
    setDraw(false); setMoveCount(0); setHoveredCol(null);
    setLocked(false); setBotThinking(false);
  }, []);

  useEffect(() => {
    onVoiceCmd((cmd) => {
      if (cmd.type === "DROP_COLUMN") handleDrop(cmd.col - 1);
      if (cmd.type === "NEW_GAME") reset();
      if (cmd.type === "MENU") onMenu();
    });
  }, [onVoiceCmd, handleDrop, reset, onMenu]);

  const winSet = new Set(winner ? winner.cells.map(([r, c]) => `${r}-${c}`) : []);

  const getCol = useCallback((e: React.MouseEvent | React.TouchEvent): number | null => {
    if (!boardRef.current) return null;
    const rect = boardRef.current.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const x = clientX - rect.left;
    const col = Math.floor((x / rect.width) * COLS);
    return col >= 0 && col < COLS ? col : null;
  }, []);

  const canInteract = !winner && !draw && !locked && !(mode === "bot" && currentPlayer === 2);
  const botInfo = BOT_LEVELS.find(b => b.level === botLevel);
  const p2Label = mode === "bot" ? `Бот (${botInfo?.label})` : "Игрок 2";

  // ── Мобильный игровой вид 
  if (isMobile) {
    return (
      <motion.div
        animate={{ x: shaking ? [0, -10, 10, -6, 6, -2, 2, 0] : 0 }}
        transition={{ x: { duration: 0.44, ease: "linear" } }}
        style={{
          width: "100%", height: "100%", display: "flex",
          flexDirection: "column", overflowY: "auto",
        }}
      >
        {/* Шапка */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderBottom: "2px solid #1e293b", flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#f8fafc", letterSpacing: -0.5 }}>
              ЧЕТЫРЕ В РЯД
            </div>
            <div style={{ fontSize: 10, color: "#334155", fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}>
              {mode === "bot" ? botInfo?.label : "Два игрока"} · Ход {moveCount}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <motion.button
              whileTap={{ scale: 0.95 }} onClick={reset}
              style={{
                background: "#6366f1", border: "none", borderRadius: 8,
                padding: "8px 14px", color: "#fff", fontSize: 11, fontWeight: 700,
                letterSpacing: 1, textTransform: "uppercase", cursor: "pointer",
              }}
            >
              Заново
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }} onClick={onMenu}
              style={{
                background: "transparent", border: "2px solid #1e293b",
                borderRadius: 8, padding: "8px 12px", color: "#334155",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}
            >
              Меню
            </motion.button>
          </div>
        </div>

        {/* Счёт */}
        <div style={{
          display: "flex", gap: 8, padding: "10px 16px",
          flexShrink: 0,
        }}>
          {[1, 2].map(pl => {
            const cfg = PC[pl];
            const active = !winner && !draw && currentPlayer === pl;
            return (
              <motion.div
                key={pl}
                animate={{ scale: active ? 1.03 : 1 }}
                style={{
                  flex: 1,
                  background: active ? cfg.bg : "rgba(255,255,255,0.02)",
                  border: `2px solid ${active ? cfg.color : "#1e293b"}`,
                  borderRadius: 10, padding: "8px 12px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: active ? cfg.color : "#334155", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 2 }}>
                    {pl === 1 ? "Игрок 1" : p2Label}
                  </div>
                  {active && (
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ repeat: Infinity, duration: 1.1 }}
                      style={{ fontSize: 9, color: cfg.color, fontWeight: 700 }}
                    >
                      Ход
                    </motion.div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: cfg.color }} />
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#f8fafc", lineHeight: 1 }}>{scores[pl]}</div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Статус / победитель */}
        <AnimatePresence>
          {(winner || draw) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              style={{
                margin: "0 16px 8px",
                background: winner ? PC[winner.player].bg : "rgba(234,179,8,0.08)",
                border: `2px solid ${winner ? PC[winner.player].color : "#f59e0b"}`,
                borderRadius: 10, padding: "10px 14px", textAlign: "center",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: "#f8fafc" }}>
                {winner ? `${winner.player === 1 ? "Игрок 1" : p2Label} победил!` : "Ничья!"}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Номера столбцов + доска */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 12px 12px" }}>
          {/* Номера столбцов */}
          <div style={{
            width: "100%",
            display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gap: 5, marginBottom: 4, paddingInline: 10,
          }}>
            {Array.from({ length: COLS }, (_, c) => {
              const isHovered = hoveredCol === c && canInteract;
              return (
                <div key={c} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <div style={{ height: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {isHovered && <div style={{ width: 6, height: 6, borderRadius: "50%", background: PC[currentPlayer].color }} />}
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 800,
                    color: isHovered ? PC[currentPlayer].color : "#ffffff",
                    transition: "color 0.15s", lineHeight: 1,
                  }}>
                    {c + 1}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Доска */}
          <motion.div
            ref={boardRef}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 26 }}
            style={{ transformOrigin: "top", width: "100%" }}
            onClick={e => { const c = getCol(e); if (c !== null && canInteract) handleDrop(c); }}
            onMouseMove={e => setHoveredCol(canInteract ? getCol(e) : null)}
            onMouseLeave={() => setHoveredCol(null)}
            onTouchStart={e => { const c = getCol(e); if (c !== null && canInteract) handleDrop(c); }}
            onTouchMove={e => setHoveredCol(canInteract ? getCol(e) : null)}
          >
            <div style={{
              background: "#060e1c", border: "3px solid #0d1a2d",
              borderRadius: 14, padding: "8px 10px",
              display: "grid", gridTemplateRows: `repeat(${ROWS}, 1fr)`,
              gap: 5, cursor: canInteract ? "pointer" : "default",
            }}>
              {board.map((row, r) => (
                <div key={r} style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 5 }}>
                  {row.map((cell, c) => (
                    <Cell
                      key={c} value={cell}
                      winning={winSet.has(`${r}-${c}`)}
                      hovered={hoveredCol === c && canInteract ? currentPlayer : null}
                      onClick={() => canInteract && handleDrop(c)}
                      disabled={!canInteract}
                    />
                  ))}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Статус хода */}
          <div style={{ marginTop: 8, height: 20 }}>
            <AnimatePresence mode="wait">
              {!winner && !draw && (
                <motion.div
                  key={`turn-${currentPlayer}`}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}
                  style={{
                    color: botThinking ? PC[2].color : PC[currentPlayer].color,
                    fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase",
                  }}
                >
                  {botThinking ? "Бот думает..." : `${currentPlayer === 1 ? "Игрок 1" : p2Label} ходит`}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  }

  // ── Планшетный 
  if (isTablet) {
    return (
      <motion.div
        animate={{ x: shaking ? [0, -10, 10, -6, 6, -2, 2, 0] : 0 }}
        transition={{ x: { duration: 0.44, ease: "linear" } }}
        style={{
          width: "100%", height: "100%", display: "flex",
          flexDirection: "column", overflowY: "auto",
        }}
      >
        {/* Шапка */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 24px", borderBottom: "2px solid #1e293b", flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#f8fafc", letterSpacing: -0.5 }}>
              ЧЕТЫРЕ В РЯД
            </div>
            <div style={{ fontSize: 10, color: "#334155", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
              {mode === "bot" ? botInfo?.label : "Два игрока"} · Ход {moveCount}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <motion.button
              whileTap={{ scale: 0.95 }} onClick={reset}
              style={{
                background: "#6366f1", border: "none", borderRadius: 10,
                padding: "10px 18px", color: "#fff", fontSize: 12, fontWeight: 700,
                letterSpacing: 1.5, textTransform: "uppercase", cursor: "pointer",
              }}
            >
              Заново
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }} onClick={onMenu}
              style={{
                background: "transparent", border: "2px solid #1e293b",
                borderRadius: 10, padding: "10px 16px", color: "#334155",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              Меню
            </motion.button>
          </div>
        </div>

        {/* Счёт */}
        <div style={{ display: "flex", gap: 12, padding: "14px 24px", flexShrink: 0 }}>
          {[1, 2].map(pl => {
            const cfg = PC[pl];
            const active = !winner && !draw && currentPlayer === pl;
            return (
              <motion.div
                key={pl}
                animate={{ scale: active ? 1.03 : 1 }}
                style={{
                  flex: 1,
                  background: active ? cfg.bg : "rgba(255,255,255,0.02)",
                  border: `2px solid ${active ? cfg.color : "#1e293b"}`,
                  borderRadius: 12, padding: "12px 16px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: active ? cfg.color : "#334155", letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>
                    {pl === 1 ? "Игрок 1" : p2Label}
                  </div>
                  {active && (
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ repeat: Infinity, duration: 1.1 }}
                      style={{ fontSize: 10, color: cfg.color, fontWeight: 700 }}
                    >
                      Ход
                    </motion.div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: cfg.color }} />
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#f8fafc", lineHeight: 1 }}>{scores[pl]}</div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Победитель / ничья */}
        <AnimatePresence>
          {(winner || draw) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              style={{
                margin: "0 24px 8px",
                background: winner ? PC[winner.player].bg : "rgba(234,179,8,0.08)",
                border: `2px solid ${winner ? PC[winner.player].color : "#f59e0b"}`,
                borderRadius: 12, padding: "12px 16px", textAlign: "center",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800, color: "#f8fafc" }}>
                {winner ? `${winner.player === 1 ? "Игрок 1" : p2Label} победил!` : "Ничья!"}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Доска */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "0 24px 16px" }}>
          {/* Номера */}
          <div style={{
            width: "100%", maxWidth: 640,
            display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gap: 6, marginBottom: 6, paddingInline: 12,
          }}>
            {Array.from({ length: COLS }, (_, c) => {
              const isHovered = hoveredCol === c && canInteract;
              return (
                <div key={c} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ height: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {isHovered && <div style={{ width: 7, height: 7, borderRadius: "50%", background: PC[currentPlayer].color }} />}
                  </div>
                  <div style={{
                    fontSize: 15, fontWeight: 800,
                    color: isHovered ? PC[currentPlayer].color : "#ffffff",
                    transition: "color 0.15s", lineHeight: 1,
                  }}>
                    {c + 1}
                  </div>
                </div>
              );
            })}
          </div>

          <motion.div
            ref={boardRef}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 180, damping: 26 }}
            style={{ transformOrigin: "top", width: "100%", maxWidth: 640 }}
            onClick={e => { const c = getCol(e); if (c !== null && canInteract) handleDrop(c); }}
            onMouseMove={e => setHoveredCol(canInteract ? getCol(e) : null)}
            onMouseLeave={() => setHoveredCol(null)}
            onTouchStart={e => { const c = getCol(e); if (c !== null && canInteract) handleDrop(c); }}
            onTouchMove={e => setHoveredCol(canInteract ? getCol(e) : null)}
          >
            <div style={{
              background: "#060e1c", border: "3px solid #0d1a2d",
              borderRadius: 16, padding: "12px 14px",
              display: "grid", gridTemplateRows: `repeat(${ROWS}, 1fr)`,
              gap: 7, cursor: canInteract ? "pointer" : "default",
            }}>
              {board.map((row, r) => (
                <div key={r} style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 7 }}>
                  {row.map((cell, c) => (
                    <Cell
                      key={c} value={cell}
                      winning={winSet.has(`${r}-${c}`)}
                      hovered={hoveredCol === c && canInteract ? currentPlayer : null}
                      onClick={() => canInteract && handleDrop(c)}
                      disabled={!canInteract}
                    />
                  ))}
                </div>
              ))}
            </div>
          </motion.div>

          <div style={{ marginTop: 12, height: 22 }}>
            <AnimatePresence mode="wait">
              {!winner && !draw && (
                <motion.div
                  key={`turn-${currentPlayer}`}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}
                  style={{
                    color: botThinking ? PC[2].color : PC[currentPlayer].color,
                    fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase",
                  }}
                >
                  {botThinking ? "Бот думает..." : `${currentPlayer === 1 ? "Игрок 1" : p2Label} ходит`}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Голосовые команды внизу */}
        <div style={{ padding: "0 24px 16px", flexShrink: 0 }}>
          <VoiceCommandsHelp mode="game" compact />
        </div>
      </motion.div>
    );
  }

  // ── Десктоп GameScreen 
  return (
    <motion.div
      animate={{ x: shaking ? [0, -10, 10, -6, 6, -2, 2, 0] : 0 }}
      transition={{ x: { duration: 0.44, ease: "linear" } }}
      style={{ width: "100%", height: "100%", display: "flex" }}
    >
      {/* Левая панель */}
      <div style={{
        width: 260, flexShrink: 0, display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: "32px 24px",
        borderRight: "2px solid #1e293b",
      }}>
        <div>
          <h1 style={{ fontSize: "clamp(20px, 1.8vw, 28px)", fontWeight: 900, color: "#f8fafc", letterSpacing: -1, marginBottom: 4 }}>
            ЧЕТЫРЕ В РЯД
          </h1>
          <p style={{ color: "#1e293b", fontSize: 11, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 28 }}>
            {mode === "bot" ? botInfo?.label : "Два игрока"} · Ход {moveCount}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {[1, 2].map(pl => {
              const cfg = PC[pl];
              const active = !winner && !draw && currentPlayer === pl;
              return (
                <motion.div
                  key={pl}
                  animate={{ scale: active ? 1.03 : 1, x: active ? 3 : 0 }}
                  transition={{ type: "spring", stiffness: 360, damping: 24 }}
                  style={{
                    background: active ? cfg.bg : "rgba(255,255,255,0.02)",
                    border: `2px solid ${active ? cfg.color : "#1e293b"}`,
                    borderRadius: 12, padding: "12px 16px",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: active ? cfg.color : "#334155", letterSpacing: 2, textTransform: "uppercase", marginBottom: 3 }}>
                      {pl === 1 ? "Игрок 1" : p2Label}
                    </div>
                    {active && (
                      <motion.div
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ repeat: Infinity, duration: 1.1 }}
                        style={{ fontSize: 10, color: cfg.color, fontWeight: 700, letterSpacing: 1 }}
                      >
                        Ход
                      </motion.div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 14, height: 14, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
                    <div style={{ fontSize: 32, fontWeight: 900, color: "#f8fafc", lineHeight: 1 }}>{scores[pl]}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <AnimatePresence>
            {botThinking && (
              <motion.div
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{
                  background: PC[2].bg, border: `2px solid ${PC[2].color}30`,
                  borderRadius: 10, padding: "10px 14px", marginBottom: 10,
                }}
              >
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 0.85 }}
                  style={{ color: PC[2].color, fontSize: 12, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" }}
                >
                  Бот думает...
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {(winner || draw) && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                style={{
                  background: winner ? PC[winner.player].bg : "rgba(234,179,8,0.08)",
                  border: `2px solid ${winner ? PC[winner.player].color : "#f59e0b"}`,
                  borderRadius: 12, padding: "16px 18px", textAlign: "center", marginBottom: 10,
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 800, color: "#f8fafc", marginBottom: 5 }}>
                  {winner ? `${winner.player === 1 ? "Игрок 1" : p2Label} победил!` : "Ничья!"}
                </div>
                <div style={{ fontSize: 12, color: "#475569", fontWeight: 600 }}>
                  {winner ? 'Скажите «Заново»' : 'Скажите «Заново» или «Меню»'}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <VoiceCommandsHelp mode="game" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={reset}
            style={{
              background: "#6366f1", border: "none", borderRadius: 11,
              padding: "13px", color: "#fff", fontSize: 13, fontWeight: 700,
              letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
            }}
          >
            Заново
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={onMenu}
            style={{
              background: "transparent", border: "2px solid #1e293b",
              borderRadius: 11, padding: "12px", color: "#334155",
              fontSize: 13, fontWeight: 700, letterSpacing: 2,
              textTransform: "uppercase", cursor: "pointer",
            }}
          >
            Меню
          </motion.button>
        </div>
      </div>

      {/* Центр — доска */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", padding: "24px 28px",
      }}>
        {/* Номера столбцов */}
        <div style={{
          width: "100%", maxWidth: 700,
          display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gap: 8, marginBottom: 8, paddingInline: 16,
        }}>
          {Array.from({ length: COLS }, (_, c) => {
            const isHovered = hoveredCol === c && canInteract;
            return (
              <div key={c} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <div style={{ height: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isHovered && <div style={{ width: 8, height: 8, borderRadius: "50%", background: PC[currentPlayer].color }} />}
                </div>
                <div style={{
                  fontSize: 17, fontWeight: 800,
                  color: isHovered ? PC[currentPlayer].color : "#ffffff",
                  transition: "color 0.15s", lineHeight: 1,
                }}>
                  {c + 1}
                </div>
              </div>
            );
          })}
        </div>

        {/* Доска */}
        <motion.div
          ref={boardRef}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 180, damping: 26 }}
          style={{ transformOrigin: "top", width: "100%", maxWidth: 700 }}
          onClick={e => { const c = getCol(e); if (c !== null && canInteract) handleDrop(c); }}
          onMouseMove={e => setHoveredCol(canInteract ? getCol(e) : null)}
          onMouseLeave={() => setHoveredCol(null)}
          onTouchStart={e => { const c = getCol(e); if (c !== null && canInteract) handleDrop(c); }}
          onTouchMove={e => setHoveredCol(canInteract ? getCol(e) : null)}
        >
          <div style={{
            background: "#060e1c", border: "3px solid #0d1a2d",
            borderRadius: 18, padding: "14px 16px",
            display: "grid", gridTemplateRows: `repeat(${ROWS}, 1fr)`,
            gap: 8, cursor: canInteract ? "pointer" : "default",
          }}>
            {board.map((row, r) => (
              <div key={r} style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 8 }}>
                {row.map((cell, c) => (
                  <Cell
                    key={c} value={cell}
                    winning={winSet.has(`${r}-${c}`)}
                    hovered={hoveredCol === c && canInteract ? currentPlayer : null}
                    onClick={() => canInteract && handleDrop(c)}
                    disabled={!canInteract}
                  />
                ))}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Статус */}
        <div style={{ marginTop: 16, height: 24 }}>
          <AnimatePresence mode="wait">
            {!winner && !draw && (
              <motion.div
                key={`turn-${currentPlayer}`}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}
                style={{
                  color: botThinking ? PC[2].color : PC[currentPlayer].color,
                  fontSize: 12, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase",
                }}
              >
                {botThinking
                  ? "Бот думает..."
                  : `${currentPlayer === 1 ? "Игрок 1" : p2Label} ходит`}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ── Root 

export default function App() {
  const [screen, setScreen] = useState<"menu" | "game">("menu");
  const [mode, setMode] = useState("pvp");
  const [botLevel, setBotLevel] = useState(1);

  const [lastVoiceMsg, setLastVoiceMsg] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const voiceCmdHandlerRef = useRef<((cmd: VoiceCommand) => void) | null>(null);

  const showToast = useCallback((msg: string) => {
    setLastVoiceMsg(msg);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500);
  }, []);

  const getState = useCallback(() => ({
    screen,
    mode,
    botLevel,
  }), [screen, mode, botLevel]);

  const handleVoiceCommand = useCallback((cmd: VoiceCommand) => {
    console.info("[Голос] Команда:", cmd);
    showToast(getCommandLabel(cmd));

    switch (cmd.type) {
      case "MENU":
        setScreen("menu");
        break;
      case "START_PVP":
        setMode("pvp");
        setScreen("game");
        break;
      case "START_BOT":
        setMode("bot");
        setBotLevel(cmd.level);
        setScreen("game");
        break;
      case "NEW_GAME":
        voiceCmdHandlerRef.current?.(cmd);
        break;
      case "DROP_COLUMN":
        voiceCmdHandlerRef.current?.(cmd);
        break;
      default:
        voiceCmdHandlerRef.current?.(cmd);
        break;
    }
  }, [showToast]);

  const registerVoiceHandler = useCallback((handler: (cmd: VoiceCommand) => void) => {
    voiceCmdHandlerRef.current = handler;
  }, []);

  useAssistant({ getState, onCommand: handleVoiceCommand });

  const bp = useBreakpoint();
  const isMobile = bp === "xs" || bp === "sm";
  const isTablet = bp === "md";


  const containerStyle: React.CSSProperties = isMobile
    ? {
        width: "100vw",
        height: "100dvh",
        borderRadius: 0,
        border: "none",
      }
    : isTablet
    ? {
        width: "min(900px, 97vw)",
        height: "min(700px, 96vh)",
        borderRadius: 20,
        border: "2px solid #1a2540",
      }
    : {
        width: "min(1380px, 95vw)",
        height: "min(800px, 88vh)",
        borderRadius: 24,
        border: "2px solid #1a2540",
      };

  return (
    <div style={{
      width: "100vw", height: "100dvh", background: "#080f1e",
      display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
    }}>
      <motion.div
        key={screen}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        style={{
          position: "relative", zIndex: 1,
          background: "#0c1424",
          overflow: "hidden", display: "flex",
          ...containerStyle,
        }}
      >
        <AnimatePresence mode="wait">
          {screen === "menu" ? (
            <MenuScreen
              key="menu"
              onStartPvP={() => { setMode("pvp"); setScreen("game"); }}
              onStartBot={lvl => { setMode("bot"); setBotLevel(lvl); setScreen("game"); }}
              onVoiceCmd={registerVoiceHandler}
            />
          ) : (
            <GameScreen
              key={`game-${mode}-${botLevel}`}
              mode={mode}
              botLevel={botLevel}
              onMenu={() => setScreen("menu")}
              onVoiceCmd={registerVoiceHandler}
            />
          )}
        </AnimatePresence>
      </motion.div>

      <VoiceHint lastCmd={lastVoiceMsg} visible={toastVisible} />
    </div>
  );
}

function getCommandLabel(cmd: VoiceCommand): string {
  switch (cmd.type) {
    case "DROP_COLUMN": return ` Ход в столбец ${cmd.col}`;
    case "NEW_GAME": return " Новая игра";
    case "MENU": return " Главное меню";
    case "START_PVP": return " Два игрока";
    case "START_BOT": {
      const lvlName = ["", "Лёгкий", "Средний", "Сложный"][cmd.level] ?? "Средний";
      return ` Против бота — ${lvlName}`;
    }
    case "UNKNOWN": return ` ${cmd.text}`;
  }
}