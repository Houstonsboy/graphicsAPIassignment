// gameplay.js — Ghost release scheduler + BFS chase AI
//
// Depends on globals defined by drizzy.html before this script runs:
//   ROWS, COLS, maze, tileCenterX(), tileCenterY()
//
// Exposes:  window.GhostAI = { init({ ENTITIES, pacmanId }), update(dtSeconds) }

(function () {
  'use strict';

  // ── Constants ─────────────────────────────────────────────────────────────

  const TUNNEL_ROW = 10; // mirrors drizzy.html / entityrules.js

  // Ghost FSM states
  const CAGED    = 'caged';    // locked inside ghost house
  const EXITING  = 'exiting';  // navigating to the corridor above the house
  const CHASING  = 'chasing';  // BFS-hunting Pac-Man

  // Exit waypoint: first open corridor tile directly above the ghost-house door.
  // Row 8, col 10 is a path tile (T_PELLET after buildMaze) that every ghost
  // reaches before spreading out to chase.
  const EXIT_R = 8;
  const EXIT_C = 10;

  // Release order and stagger (ghost1 → ghost2 → ghost3 → ghost4).
  const RELEASE_ORDER = ['ghost1', 'ghost2', 'ghost3', 'ghost4'];
  const RELEASE_TIMES = [3, 7, 12, 17];

  // Speed multipliers relative to Pac-Man (entityrules.js: 6 tiles/s).
  const GHOST_SPEED_MULT = {
    ghost1: 0.75,
    ghost2: 0.7,
    ghost3: 0.9,
    ghost4: 0.8,
  };

  // Horizontal pixel gap between ghost draw centers on the same tile.
  const GHOST_SEPARATION_PX = 3;

  // Cardinal directions as { dr, dc } look-up table
  const DIRS = {
    up:    { dr: -1, dc:  0 },
    down:  { dr:  1, dc:  0 },
    left:  { dr:  0, dc: -1 },
    right: { dr:  0, dc:  1 },
  };
  const DIR_KEYS = ['up', 'down', 'left', 'right'];

  // ── Module state ──────────────────────────────────────────────────────────

  let ghosts    = [];
  let pac       = null;
  let totalTime = 0;
  let ghostCount = 0; // captured at init, reused by reset

  // ── Maze helpers ──────────────────────────────────────────────────────────

  // Horizontal wrap only on the tunnel row, otherwise clamp.
  function wrapCol(destRow, rawCol) {
    if (destRow === TUNNEL_ROW) {
      if (rawCol < 0)     return COLS - 1;
      if (rawCol >= COLS) return 0;
    }
    return rawCol;
  }

  // A tile is passable for a ghost if it is in-bounds and not T_WALL (1).
  // Ghost-house tiles (T_GHOST = 4) are intentionally passable so ghosts
  // can exit and re-enter the house if the path demands it.
  function passable(r, c) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
    return maze[r][c] !== 1; // 1 === T_WALL
  }

  // ── BFS — shortest-path first direction ───────────────────────────────────
  /**
   * bfsNextDir(startR, startC, goalR, goalC)
   *
   * Runs a breadth-first search on the current `maze` grid to find the
   * shortest walkable path from the ghost's tile to the target tile.
   *
   * Returns the *first direction* the ghost should move to begin that path,
   * or null when already at the goal or no path exists.
   *
   * Complexity: O(ROWS × COLS) — trivially fast on a 21 × 22 grid.
   */
  function bfsNextDir(startR, startC, goalR, goalC) {
    if (startR === goalR && startC === goalC) return null;

    // Flat visited bit-array avoids 2-D allocation overhead.
    const visited = new Uint8Array(ROWS * COLS);
    visited[startR * COLS + startC] = 1;

    // Queue entries: { r, c, firstDir }
    // firstDir stores the direction taken from startR/startC — the answer we want.
    const queue = [];
    let head = 0;

    // Seed: enqueue all valid neighbours of the start tile.
    for (const dir of DIR_KEYS) {
      const { dr, dc } = DIRS[dir];
      const nr = startR + dr;
      const nc = wrapCol(nr, startC + dc);
      if (!passable(nr, nc)) continue;
      if (visited[nr * COLS + nc]) continue;
      visited[nr * COLS + nc] = 1;
      queue.push({ r: nr, c: nc, firstDir: dir });
    }

    // BFS expansion
    while (head < queue.length) {
      const { r, c, firstDir } = queue[head++];

      if (r === goalR && c === goalC) return firstDir; // path found

      for (const dir of DIR_KEYS) {
        const { dr, dc } = DIRS[dir];
        const nr = r + dr;
        const nc = wrapCol(nr, c + dc);
        if (!passable(nr, nc)) continue;
        const idx = nr * COLS + nc;
        if (visited[idx]) continue;
        visited[idx] = 1;
        queue.push({ r: nr, c: nc, firstDir });
      }
    }

    return null; // no path
  }

  // ── Ghost initialisation ──────────────────────────────────────────────────

  function initGhost(g, releaseTime, slotIndex, totalGhosts) {
    const pacSpeed = pac?.speedTilesPerSecond ?? 6;
    const mult = GHOST_SPEED_MULT[g.id] ?? 1;

    // Mirror Pac-Man's smooth-movement fields so drawEntity() works identically.
    g.px = tileCenterX(g.c);
    g.py = tileCenterY(g.r);
    g.step = null;
    g.state = CAGED;
    g.releaseTime = releaseTime;
    g.speedTilesPerSecond = pacSpeed * mult;
    g.dir = null;

    // Spread draw centers so ghosts on the same tile don't fully stack.
    g.drawOffsetX =
      (slotIndex - (totalGhosts - 1) / 2) * GHOST_SEPARATION_PX;
    g.drawOffsetY = g.drawOffsetY ?? 0;
  }

  // ── Smooth tile-to-tile sliding ───────────────────────────────────────────

  // Attempt to start a one-tile slide in `dir`. Returns false if blocked.
  function beginGhostStep(g, dir) {
    const { dr, dc } = DIRS[dir];
    const nr = g.r + dr;
    const nc = wrapCol(nr, g.c + dc);
    if (!passable(nr, nc)) return false;

    g.step = {
      toR:      nr,
      toC:      nc,
      fromX:    tileCenterX(g.c),
      fromY:    tileCenterY(g.r),
      toX:      tileCenterX(nc),
      toY:      tileCenterY(nr),
      elapsed:  0,
      duration: 1 / g.speedTilesPerSecond,
    };
    g.dir = dir;
    return true;
  }

  // Advance the ghost's current sliding step by dt seconds, updating px/py.
  function advanceGhostStep(g, dt) {
    if (!g.step) return;

    g.step.elapsed += dt;
    const t = Math.min(g.step.elapsed / g.step.duration, 1);

    g.px = g.step.fromX + (g.step.toX - g.step.fromX) * t;
    g.py = g.step.fromY + (g.step.toY - g.step.fromY) * t;

    if (t >= 1) {
      // Snap exactly to destination tile centre.
      g.r   = g.step.toR;
      g.c   = g.step.toC;
      g.px  = g.step.toX;
      g.py  = g.step.toY;
      g.step = null;
    }
  }

  // ── Per-ghost AI update ───────────────────────────────────────────────────

  function updateGhost(g, dt) {
    // 1. Continue any in-progress slide.
    advanceGhostStep(g, dt);

    // 2. While mid-slide there is nothing to decide.
    if (g.step) return;

    // 3. FSM: decide next action based on current state.
    switch (g.state) {

      case CAGED:
        // Ghost waits inside the house until the release scheduler wakes it.
        return;

      case EXITING: {
        // Head for the corridor above the ghost house.
        // Once there, switch to full chase mode.
        if (g.r === EXIT_R && g.c === EXIT_C) {
          g.state = CHASING;
          return;
        }
        const exitDir = bfsNextDir(g.r, g.c, EXIT_R, EXIT_C);
        if (exitDir) beginGhostStep(g, exitDir);
        return;
      }

      case CHASING: {
        // BFS to Pac-Man's current tile every time the ghost arrives at a
        // new tile centre. Because the maze is tiny this is negligible cost.
        if (!pac) return;
        const chaseDir = bfsNextDir(g.r, g.c, pac.r, pac.c);
        if (chaseDir) beginGhostStep(g, chaseDir);
        return;
      }
    }
  }

  // ── Release scheduler ─────────────────────────────────────────────────────

  // Checks every frame whether a caged ghost has waited long enough.
  function checkRelease() {
    for (const g of ghosts) {
      if (g.state === CAGED && totalTime >= g.releaseTime) {
        g.state = EXITING;
      }
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * GhostAI.init({ ENTITIES, pacmanId })
   * Call once after ENTITIES is defined (drizzy.html inline script).
   */
  function init({ ENTITIES: entities, pacmanId = 'pacman' } = {}) {
    pac = entities.find(e => e.id === pacmanId) ?? null;

    // ghost1 releases first, then ghost2, ghost3, ghost4.
    const ghostEntities = entities
      .filter(e => e.kind === 'ghost')
      .sort((a, b) => RELEASE_ORDER.indexOf(a.id) - RELEASE_ORDER.indexOf(b.id));
    ghostCount = ghostEntities.length;

    ghosts = ghostEntities.map((g, i) => {
      const fallbackTime =
        RELEASE_TIMES[RELEASE_TIMES.length - 1] + (i - RELEASE_TIMES.length + 1) * 5;
      const releaseTime = i < RELEASE_TIMES.length ? RELEASE_TIMES[i] : fallbackTime;
      initGhost(g, releaseTime, i, ghostCount);
      return g;
    });

    totalTime = 0;
  }

  /**
   * GhostAI.update(dtSeconds)
   * Call every frame from the main game loop.
   */
  function update(dt) {
    totalTime += dt;
    checkRelease();
    for (const g of ghosts) updateGhost(g, dt);
  }

  /**
   * GhostAI.reset({ ENTITIES, pacmanId })
   * Re-cage all ghosts and restart release timers.
   * Call AFTER restoring each ghost's r/c/px/py from outside.
   */
  function reset({ ENTITIES: entities, pacmanId = 'pacman' } = {}) {
    pac = entities.find(e => e.id === pacmanId) ?? null;
    totalTime = 0;
    ghosts.forEach((g, i) => {
      const fallbackTime =
        RELEASE_TIMES[RELEASE_TIMES.length - 1] + (i - RELEASE_TIMES.length + 1) * 5;
      const releaseTime = i < RELEASE_TIMES.length ? RELEASE_TIMES[i] : fallbackTime;
      initGhost(g, releaseTime, i, ghostCount);
    });
  }

  window.GhostAI = { init, update, reset };
})();
