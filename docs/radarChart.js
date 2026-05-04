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

  /** Update fill/stroke/dot opacity only — keeps DOM nodes alive for tooltips */
  function refreshEmphasis(transition) {
    const t = transition ?? d3.transition().duration(0);

    polyGroup
      .selectAll(".poly-a")
      .transition(t)
      .attr("fill-opacity", state.emphasis === "B" ? 0.06 : 0.22)
      .attr("stroke-opacity", state.emphasis === "B" ? 0.35 : 1);

    polyGroup
      .selectAll(".poly-b")
      .transition(t)
      .attr("fill-opacity", state.emphasis === "A" ? 0.06 : 0.22)
      .attr("stroke-opacity", state.emphasis === "A" ? 0.35 : 1);

    dotGroup.selectAll(".vertex").each(function () {
      const tag = d3.select(this).attr("data-tag");
      const dim = state.emphasis && state.emphasis !== tag;
      d3.select(this).attr("opacity", dim ? 0.35 : 1);
    });
  }

  function wireHitHandlers(hitSel, tag) {
    hitSel
      .style("pointer-events", "visiblePainted")
      .style("cursor", "pointer")
      .on("mouseenter.hit", () => {
        state.emphasis = tag;
        refreshEmphasis(d3.transition().duration(120));
      })
      .on("mouseleave.hit", () => {
        state.emphasis = null;
        refreshEmphasis(d3.transition().duration(120));
      });
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
          .html(
            `<strong>${escapeHtml(meta.label ?? "")}</strong><br/>
            <span class="tt-key">${escapeHtml(meta.key ?? "")}</span><br/>
            <span class="tt-player">${escapeHtml(meta.playerName ?? "")}</span><br/>
            Raw: <strong>${escapeHtml(String(meta.rawExact ?? "—"))}</strong><br/>
            Score: <strong>${escapeHtml(String(meta.scoreExact ?? "—"))}</strong><br/>
            Dataset range: <strong>${escapeHtml(String(meta.rangeExact ?? "—"))}</strong>`
          )
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
        refreshEmphasis(d3.transition().duration(120));
        tooltip.style("opacity", 0);
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
    destroy() {
      tooltip.remove();
      svg.remove();
    },
  };
}
