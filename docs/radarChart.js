/**
 * D3 radar chart: six fixed axes, two polygons, transitions, tooltips, hover emphasis.
 * Vertex tooltips must NOT rebuild dots on hover (that breaks mouseenter / tooltip).
 */

export function createRadarChart(containerEl, options = {}) {
  const width = options.width ?? 440;
  const height = options.height ?? 440;
  const margin = options.margin ?? 56;
  const innerW = width - margin * 2;
  const innerH = height - margin * 2;
  const radius = Math.min(innerW, innerH) / 2;
  const cx = width / 2;
  const cy = height / 2;

  const svg = d3
    .select(containerEl)
    .append("svg")
    .attr("role", "img")
    .attr("aria-label", "Radar chart comparing two players across six statistics")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g").attr("transform", `translate(${cx},${cy})`);

  // Transparent full-SVG rect sitting below every other element.
  // Clicking empty space clears the radar lock without interfering with
  // polygon / dot click handlers (those call stopPropagation).
  svg
    .insert("rect", ":first-child")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "transparent")
    .style("cursor", "default")
    .on("click.bg", clearLock);

  const levels = 5;
  const levelGroup = g.append("g").attr("class", "radar-levels");

  for (let i = 1; i <= levels; i++) {
    const r = (radius * i) / levels;
    levelGroup
      .append("circle")
      .attr("r", r)
      .attr("fill", "none")
      .attr("stroke", "var(--radar-grid)")
      .attr("stroke-width", 1);
  }

  const axisGroup = g.append("g").attr("class", "radar-axes");
  const polyGroup = g.append("g").attr("class", "radar-polygons");
  const hitGroup = g.append("g").attr("class", "radar-hit-areas");
  const dotGroup = g.append("g").attr("class", "radar-dots");
  const labelGroup = g.append("g").attr("class", "radar-axis-labels");

  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "radar-tooltip")
    .style("position", "fixed")
    .style("pointer-events", "none")
    .style("opacity", 0)
    .style("z-index", 1000);

  const angleSlice = (Math.PI * 2) / 6;

  /**
   * SCALE LABELS (Feature 1)
   * Render a numeric score label on every concentric ring so users can
   * read approximate values before hovering.  Labels are placed at the
   * midpoint between axis 0 (top, –90°) and axis 1 (upper-right, –30°),
   * i.e. at –60° from vertical, which is clean empty space between the
   * two uppermost axes and never conflicts with axis-label text.
   *
   * The CSS `paint-order: stroke fill` trick creates a dark halo around
   * each character, guaranteeing readability even when a polygon is drawn
   * across the label position.
   *
   * Labels are aria-hidden because exact values are already exposed via
   * the interactive vertex tooltips.
   */
  {
    const SCALE_ANGLE = -Math.PI / 2 + angleSlice * 0.5; // –60° from vertical
    for (let i = 1; i <= levels; i++) {
      const r   = (radius * i) / levels;
      const score = (100 * i) / levels; // 20 · 40 · 60 · 80 · 100
      levelGroup
        .append("text")
        .attr("x", Math.cos(SCALE_ANGLE) * r)
        .attr("y", Math.sin(SCALE_ANGLE) * r)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("class", "scale-label")
        .attr("aria-hidden", "true")
        .text(String(Math.round(score)));
    }
  }

  function angleForIndex(i) {
    return -Math.PI / 2 + i * angleSlice;
  }

  function pointFor(value, i) {
    const a = angleForIndex(i);
    const r = (Math.min(100, Math.max(0, value)) / 100) * radius;
    return [Math.cos(a) * r, Math.sin(a) * r];
  }

  const line = d3
    .line()
    .x((d) => d[0])
    .y((d) => d[1])
    .curve(d3.curveLinearClosed);

  const state = {
    axisKeys: [],
    labels: [],
    playerA: { name: "Player A", color: "var(--player-a)", values: [], meta: [] },
    playerB: { name: "Player B", color: "var(--player-b)", values: [], meta: [] },
    emphasis: null,
    /**
     * RADAR LOCK — null means no lock, "A" or "B" means that player's
     * radar is "focused": the other polygon is heavily dimmed and its
     * dots have pointer-events disabled so tooltips never mis-fire.
     */
    lockedTag: null,
  };

  function drawAxes(keys, labels) {
    axisGroup.selectAll("*").remove();
    labelGroup.selectAll("*").remove();

    keys.forEach((_, i) => {
      const a = angleForIndex(i);
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      axisGroup
        .append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", x)
        .attr("y2", y)
        .attr("stroke", "var(--radar-axis)")
        .attr("stroke-width", 1);

      const lx = Math.cos(a) * (radius + 22);
      const ly = Math.sin(a) * (radius + 22);
      const text = labels[i] || keys[i];
      const shortText = text.length > 22 ? text.slice(0, 20) + "…" : text;
      const control = labelGroup
        .append("g")
        .attr("class", "axis-label-control")
        .attr("role", "button")
        .attr("tabindex", 0)
        .attr("aria-label", `Change ${text}`)
        .style("cursor", "pointer")
        .on("click", function (event) {
          options.onAxisLabelClick?.({
            event,
            index: i,
            key: keys[i],
            label: text,
            target: this,
          });
        })
        .on("keydown", function (event) {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          options.onAxisLabelClick?.({
            event,
            index: i,
            key: keys[i],
            label: text,
            target: this,
          });
        });

      const te = control
        .append("text")
        .attr("x", lx)
        .attr("y", ly)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("class", "axis-label")
        .attr("fill", "var(--text)")
        .text(`${shortText} ▾`);

      const box = te.node().getBBox();
      control
        .insert("rect", "text")
        .attr("class", "axis-label-hit")
        .attr("x", box.x - 8)
        .attr("y", box.y - 4)
        .attr("width", box.width + 16)
        .attr("height", box.height + 8)
        .attr("rx", 2);
      control.append("title").text(`Change ${text}`);
    });
  }

  function polygonPath(values) {
    const pts = values.map((v, i) => pointFor(v ?? 0, i));
    return line(pts);
  }

  /**
   * Update fill / stroke / dot opacity only — keeps DOM nodes alive for tooltips.
   *
   * When a lock is active the "effective emphasis" comes from lockedTag (not
   * just the transient hover state), and dimming is much stronger so the
   * focused radar stands out clearly.
   */
  function refreshEmphasis(transition) {
    const t = transition ?? d3.transition().duration(0);

    // Lock takes priority over hover emphasis; when locked the contrast is
    // cranked up so it's obvious which player is focused.
    const locked   = state.lockedTag !== null;
    const effective = state.lockedTag ?? state.emphasis;

    const dimFill   = locked ? 0.03 : 0.06;
    const dimStroke = locked ? 0.12 : 0.35;
    const dimDot    = locked ? 0.10 : 0.35;

    polyGroup
      .selectAll(".poly-a")
      .transition(t)
      .attr("fill-opacity",   effective === "B" ? dimFill   : 0.22)
      .attr("stroke-opacity", effective === "B" ? dimStroke : 1);

    polyGroup
      .selectAll(".poly-b")
      .transition(t)
      .attr("fill-opacity",   effective === "A" ? dimFill   : 0.22)
      .attr("stroke-opacity", effective === "A" ? dimStroke : 1);

    dotGroup.selectAll(".vertex").each(function () {
      const tag = d3.select(this).attr("data-tag");
      const dim = effective && effective !== tag;
      d3.select(this).attr("opacity", dim ? dimDot : 1);
    });
  }

  /**
   * Disable pointer-events on dots belonging to the dimmed / locked-out player
   * so they cannot accidentally capture hover events through the active layer.
   * Called whenever lockedTag changes and after every renderDots() rebuild.
   */
  function updateDotPointerEvents() {
    dotGroup.selectAll(".vertex").each(function () {
      const tag     = d3.select(this).attr("data-tag");
      const blocked = state.lockedTag !== null && tag !== state.lockedTag;
      d3.select(this).style("pointer-events", blocked ? "none" : "all");
    });
  }

  /**
   * Toggle the radar lock for the given tag:
   *   - If that player is already locked → clear the lock.
   *   - If the other player is locked, or nothing is locked → lock this player.
   * Fires the optional onLockChange(lockedTag) callback so the host page
   * (main.js) can update legend styling.
   */
  function toggleLock(tag) {
    state.lockedTag = state.lockedTag === tag ? null : tag;
    const t = d3.transition().duration(180).ease(d3.easeCubicOut);
    refreshEmphasis(t);
    updateDotPointerEvents();
    options.onLockChange?.(state.lockedTag);
  }

  /** Clear the lock entirely (background click). */
  function clearLock() {
    if (state.lockedTag === null) return;
    state.lockedTag = null;
    const t = d3.transition().duration(180).ease(d3.easeCubicOut);
    refreshEmphasis(t);
    updateDotPointerEvents();
    options.onLockChange?.(null);
  }

  function wireHitHandlers(hitSel, tag) {
    hitSel
      .style("pointer-events", "visiblePainted")
      .style("cursor", "pointer")
      .on("mouseenter.hit", () => {
        state.emphasis = tag;
        // Don't override a lock with transient hover emphasis
        if (!state.lockedTag) refreshEmphasis(d3.transition().duration(120));
      })
      .on("mouseleave.hit", () => {
        state.emphasis = null;
        if (!state.lockedTag) refreshEmphasis(d3.transition().duration(120));
      })
      // Clicking the polygon BOTH locks/highlights the radar (so you can hover
      // individual dots cleanly) AND fires the ranking-popup callback.
      // The lock stays active after the popup closes, so users can immediately
      // hover the highlighted dots without re-clicking.
      // Dot clicks (wireDotHandlers) also toggle the lock independently.
      // stopPropagation prevents the background-clear rect from also firing.
      .on("click.hit", (event) => {
        event.stopPropagation();
        toggleLock(tag);
        options.onPolygonClick?.(tag);
      });
  }

  /**
   * DIFFERENTIAL TOOLTIP (Feature 2)
   * Builds the inner HTML for a vertex tooltip.
   * When the datum carries rawDiffStr / scoreDiffStr (populated by buildMeta
   * in main.js when a second player is selected), an extra section is appended
   * that shows signed raw and score differentials vs. the other player.
   * Positive diffs get the "tt-pos" class (green), negatives get "tt-neg" (red).
   */
  function buildTooltipHtml(meta) {
    const esc = escapeHtml;

    // Core rows — always present
    let html = `
      <strong class="tt-stat-name">${esc(meta.label ?? "")}</strong>
      <span class="tt-key">${esc(meta.key ?? "")}</span>
      <span class="tt-player">${esc(meta.playerName ?? "")}</span>
      <div class="tt-section">
        <div class="tt-row">Raw&nbsp;<strong>${esc(String(meta.rawExact ?? "—"))}</strong></div>
        <div class="tt-row">Score&nbsp;<strong>${esc(String(meta.scoreExact ?? "—"))}</strong></div>
      </div>`;

    // Differential section — only when comparison data is available
    if (meta.rawDiffStr != null || meta.scoreDiffStr != null) {
      const rawClass   = (meta.rawDiff   ?? 0) >= 0 ? "tt-pos" : "tt-neg";
      const scoreClass = (meta.scoreDiff ?? 0) >= 0 ? "tt-pos" : "tt-neg";

      html += `<div class="tt-section tt-section--diff">`;
      if (meta.rawDiffStr != null) {
        html += `<div class="tt-row">Raw diff&nbsp;<strong class="${rawClass}">${esc(meta.rawDiffStr)}</strong></div>`;
      }
      if (meta.scoreDiffStr != null) {
        html += `<div class="tt-row">Score diff&nbsp;<strong class="${scoreClass}">${esc(meta.scoreDiffStr)}</strong></div>`;
      }
      html += `</div>`;
    }

    // Range footer
    html += `<div class="tt-range">Range&nbsp;${esc(String(meta.rangeExact ?? "—"))}</div>`;

    return html;
  }

  function wireDotHandlers(circle, tag) {
    circle
      .style("cursor", "crosshair")
      .style("pointer-events", "all")
      .on("mouseenter.dot", function (event) {
        event.stopPropagation();
        state.emphasis = tag;
        refreshEmphasis(d3.transition().duration(120));
        const meta = d3.select(this).datum();
        tooltip
          .html(buildTooltipHtml(meta))
          .style("left", `${event.clientX + 14}px`)
          .style("top", `${event.clientY + 14}px`)
          .style("opacity", 1);
      })
      .on("mousemove.dot", (event) => {
        tooltip.style("left", `${event.clientX + 14}px`).style("top", `${event.clientY + 14}px`);
      })
      .on("mouseleave.dot", function (event) {
        event.stopPropagation();
        state.emphasis = null;
        if (!state.lockedTag) refreshEmphasis(d3.transition().duration(120));
        tooltip.style("opacity", 0);
      })
      // Clicking a dot also locks the radar to that player
      .on("click.dot", (event) => {
        event.stopPropagation();
        toggleLock(tag);
      });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderGeometry(transition) {
    const t = transition ?? d3.transition().duration(0);

    let pathA = polyGroup.selectAll(".poly-a").data([0]);
    pathA = pathA.enter().append("path").attr("class", "poly-a").merge(pathA);

    pathA
      .style("pointer-events", "none")
      .transition(t)
      .attr("d", polygonPath(state.playerA.values))
      .attr("fill", state.playerA.color)
      .attr("fill-opacity", state.emphasis === "B" ? 0.06 : 0.22)
      .attr("stroke", state.playerA.color)
      .attr("stroke-width", 2.5)
      .attr("stroke-opacity", state.emphasis === "B" ? 0.35 : 1);

    let pathB = polyGroup.selectAll(".poly-b").data([0]);
    pathB = pathB.enter().append("path").attr("class", "poly-b").merge(pathB);

    pathB
      .style("pointer-events", "none")
      .transition(t)
      .attr("d", polygonPath(state.playerB.values))
      .attr("fill", state.playerB.color)
      .attr("fill-opacity", state.emphasis === "A" ? 0.06 : 0.22)
      .attr("stroke", state.playerB.color)
      .attr("stroke-width", 2.5)
      .attr("stroke-dasharray", "8 7")
      .attr("stroke-opacity", state.emphasis === "A" ? 0.35 : 1);

    let hitA = hitGroup.selectAll(".hit-a").data([0]);
    hitA = hitA.enter().append("path").attr("class", "hit-a").merge(hitA);
    hitA.transition(t).attr("d", polygonPath(state.playerA.values)).attr("fill", "transparent").attr("stroke", "none");
    hitA.on(".hit", null);
    wireHitHandlers(hitA, "A");

    let hitB = hitGroup.selectAll(".hit-b").data([0]);
    hitB = hitB.enter().append("path").attr("class", "hit-b").merge(hitB);
    hitB.transition(t).attr("d", polygonPath(state.playerB.values)).attr("fill", "transparent").attr("stroke", "none");
    hitB.on(".hit", null);
    wireHitHandlers(hitB, "B");

    renderDots();
    // Re-apply lock state to freshly created dot elements after every rebuild
    updateDotPointerEvents();
  }

  function renderDots() {
    dotGroup.selectAll("*").remove();

    const players = [
      { pl: state.playerA, tag: "A" },
      { pl: state.playerB, tag: "B" },
    ];

    players.forEach(({ pl, tag }) => {
      pl.values.forEach((v, i) => {
        const [x, y] = pointFor(v ?? 0, i);
        const m = pl.meta[i] || {};
        const datum = {
          ...m,
          key: m.key ?? state.axisKeys[i],
          playerName: pl.name,
          label: m.label ?? state.labels[i],
        };

        const circle = dotGroup
          .append("circle")
          .datum(datum)
          .attr("class", "vertex")
          .attr("data-tag", tag)
          .attr("cx", x)
          .attr("cy", y)
          .attr("r", 7)
          .attr("fill", pl.color)
          .attr("stroke", "var(--text)")
          .attr("stroke-width", 1.25)
          .attr("stroke-dasharray", tag === "B" ? "3 3" : null)
          .attr(
            "opacity",
            state.emphasis && state.emphasis !== tag ? 0.35 : 1
          );

        wireDotHandlers(circle, tag);
      });
    });
  }

  return {
    update(config) {
      const dur = config.transitionMs ?? 450;
      const trans = d3.transition().duration(dur).ease(d3.easeCubicOut);

      state.axisKeys = config.axisKeys;
      state.labels = config.labels;
      state.playerA = {
        ...state.playerA,
        ...config.playerA,
        values: config.playerA.values.slice(0, 6),
        meta: config.playerA.meta ?? [],
      };
      state.playerB = {
        ...state.playerB,
        ...config.playerB,
        values: config.playerB.values.slice(0, 6),
        meta: config.playerB.meta ?? [],
      };

      drawAxes(state.axisKeys, state.labels);
      renderGeometry(trans);
    },

    /**
     * Programmatically set the radar lock from outside the chart (e.g. a
     * legend click in main.js).  Pass "A", "B", or null to clear.
     */
    setLock(tag) {
      if (tag === null) {
        clearLock();
      } else {
        toggleLock(tag);
      }
    },

    destroy() {
      tooltip.remove();
      svg.remove();
    },
  };
}
