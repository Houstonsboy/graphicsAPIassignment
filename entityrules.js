// Entity rules: Pac-Man sliding movement + keyboard control


// Public API:
//   window.EntityRules.initEntityRules({ ENTITIES, pacmanId })
//   window.EntityRules.updateEntities(dtSeconds)

(function () {
  const DIRS = ["up", "down", "left", "right"];
  const TUNNEL_ROW = 10; // matches drizzy.html drawMaze()

  function dirToDelta(dir) {
    switch (dir) {
      case "up":
        return { dr: -1, dc: 0 };
      case "down":
        return { dr: 1, dc: 0 };
      case "left":
        return { dr: 0, dc: -1 };
      case "right":
        return { dr: 0, dc: 1 };
      default:
        return null;
    }
  }

  function clamp01(x) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function keyToDir(key) {
    switch (key) {
      case "ArrowUp":
        return "up";
      case "ArrowDown":
        return "down";
      case "ArrowLeft":
        return "left";
      case "ArrowRight":
        return "right";
      default:
        return null;
    }
  }

  function isTunnelEdgeOpen(r, c) {
    // drizzy.html visually opens the side tunnels by painting PATH_COLOR
    // at (0, tunnelRow) and (W-TILE, tunnelRow), even if MAZE_TEMPLATE has walls.
    return r === TUNNEL_ROW && (c === 0 || c === COLS - 1);
  }

  function calcNextTile(r, c, dir) {
    const delta = dirToDelta(dir);
    if (!delta) return null;

    let nr = r + delta.dr;
    let nc = c + delta.dc;

    // Bounds (vertical): no wrapping.
    if (nr < 0 || nr >= ROWS) return null;

    // Horizontal wrapping only in the tunnel row.
    if (nr === TUNNEL_ROW) {
      if (nc < 0) nc = COLS - 1;
      if (nc >= COLS) nc = 0;
    }

    if (nc < 0 || nc >= COLS) return null;

    // Tunnel edges are considered walkable.
    if (isTunnelEdgeOpen(nr, nc)) return { r: nr, c: nc };

    // Wall collision: everything except T_WALL is passable.
    if (maze[nr][nc] === T_WALL) return null;
    return { r: nr, c: nc };
  }

  let pacman = null;
  let initialized = false;

  function initPacman(ent) {
    ent.dir = ent.dir ?? null;
    ent.desiredDir = null;

    // Smooth movement: keep a pixel center separate from tile coords.
    ent.px = tileCenterX(ent.c);
    ent.py = tileCenterY(ent.r);

    // One "slide" is moving from the current tile center to the next tile center.
    ent.step = null;

    // Tweak for feel: tiles per second.
    ent.speedTilesPerSecond = 6;
  }

  function beginStep(ent, dir) {
    const next = calcNextTile(ent.r, ent.c, dir);
    if (!next) return false;

    const fromR = ent.r;
    const fromC = ent.c;
    const toR = next.r;
    const toC = next.c;

    // Ensure starting coordinates are snapped to the current tile center.
    ent.px = tileCenterX(fromC);
    ent.py = tileCenterY(fromR);

    ent.dir = dir;
    ent.step = {
      fromR,
      fromC,
      toR,
      toC,
      fromX: tileCenterX(fromC),
      fromY: tileCenterY(fromR),
      toX: tileCenterX(toC),
      toY: tileCenterY(toR),
      elapsed: 0,
      duration: 1 / ent.speedTilesPerSecond, // seconds
    };

    return true;
  }

  function updatePacman(ent, dtSeconds) {
    if (!ent) return;

    if (ent.step) {
      ent.step.elapsed += dtSeconds;
      const t = clamp01(ent.step.elapsed / ent.step.duration);

      ent.px = lerp(ent.step.fromX, ent.step.toX, t);
      ent.py = lerp(ent.step.fromY, ent.step.toY, t);

      if (t >= 1) {
        // Land exactly on the next tile center.
        ent.r = ent.step.toR;
        ent.c = ent.step.toC;
        ent.px = ent.step.toX;
        ent.py = ent.step.toY;
        ent.step = null;
      }

      return;
    }

    // At tile centers: optionally turn if the requested direction is valid.
    if (ent.desiredDir) {
      const turnNext = calcNextTile(ent.r, ent.c, ent.desiredDir);
      if (turnNext) {
        ent.dir = ent.desiredDir;
      }
    }

    const dirToTry = ent.dir || ent.desiredDir;
    if (!dirToTry) return;

    // Start moving if the adjacent tile is walkable (wall-blocking).
    beginStep(ent, dirToTry);
  }

  function onKeyDown(e) {
    const dir = keyToDir(e.key);
    if (!dir) return;
    if (!pacman) return;

    e.preventDefault();
    // Store desired direction; applied at the next tile center.
    pacman.desiredDir = dir;
  }

  function initEntityRules({ ENTITIES, pacmanId = "pacman" } = {}) {
    if (initialized) return;
    if (!ENTITIES) throw new Error("EntityRules.initEntityRules requires { ENTITIES }");

    pacman = ENTITIES.find((ent) => ent.id === pacmanId) || null;
    if (!pacman) throw new Error(`Pacman entity not found (id=${pacmanId})`);

    initPacman(pacman);

    document.addEventListener("keydown", onKeyDown, { passive: false });

    initialized = true;
  }

  function updateEntities(dtSeconds) {
    // dtSeconds can be ~0.016 on a typical 60fps loop.
    updatePacman(pacman, dtSeconds);
  }

  window.EntityRules = {
    initEntityRules,
    updateEntities,
  };
})();

