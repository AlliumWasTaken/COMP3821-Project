(function () {
  'use strict';

  const BOW = 26;
  const GAP = 30;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
  const centroid = (vertices, pos) => [0, 1].map(axis => mean(vertices.map(v => pos[v][axis])));
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (t, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, t));
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(2 - 2 * t, 3) / 2);
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);

  const braces = members => '{' + members.join(', ') + '}';
  const setName = members => (members.length === 1 ? members[0] : braces(members));
  const ordered = (u, v) => (u.join() < v.join() ? [u, v] : [v, u]).map(setName);
  const edgeName = (u, v) => ordered(u, v).join('–');
  const listText = items => (items.length < 2 ? items.join('') : items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1]);
  const counter = (word, i, total) => word + ' ' + (i + 1) + ' of ' + total + ': ';
  const fraction = (a, b) => a + '/' + b + (a === b ? ' = 1' : gcd(a, b) > 1 ? ' = ' + a / gcd(a, b) + '/' + b / gcd(a, b) : '');

  const cls = (base, ...marks) => [base].concat(marks.filter(Boolean).map(mark => 'is-' + mark)).join(' ');

  function layoutFor(vertices, edges, given) {
    if (given && vertices.every(v => given[v])) return given;
    const pos = {};
    vertices.forEach((v, i) => {
      const angle = 2 * Math.PI * i / vertices.length - Math.PI / 2;
      pos[v] = [280 + 200 * Math.cos(angle), 160 + 110 * Math.sin(angle)];
    });
    const ideal = Math.sqrt(420 * 220 / vertices.length);
    for (let heat = 50; heat > 1; heat *= 0.97) {
      const force = {};
      vertices.forEach(v => { force[v] = [0, 0]; });
      const push = (u, v, strength) => {
        const dx = pos[u][0] - pos[v][0], dy = pos[u][1] - pos[v][1], d = Math.hypot(dx, dy) || 1;
        force[u][0] += dx / d * strength(d);
        force[u][1] += dy / d * strength(d);
      };
      vertices.forEach(u => vertices.forEach(v => { if (u !== v) push(u, v, d => ideal * ideal / d); }));
      edges.forEach(([u, v]) => {
        push(u, v, d => -d * d / ideal);
        push(v, u, d => -d * d / ideal);
      });
      vertices.forEach(v => {
        const size = Math.hypot(force[v][0], force[v][1]) || 1, step = Math.min(size, heat) / size;
        pos[v] = [clamp(pos[v][0] + force[v][0] * step, 70, 490), clamp(pos[v][1] + force[v][1] * step, 50, 270)];
      });
    }
    for (let round = 0; round < 3; round++) {
      edges.forEach(([u, v]) => vertices.forEach(w => {
        if (w === u || w === v) return;
        const [ax, ay] = pos[u], [px, py] = pos[w];
        const dx = pos[v][0] - ax, dy = pos[v][1] - ay, len = Math.hypot(dx, dy) || 1;
        const along = ((px - ax) * dx + (py - ay) * dy) / (len * len);
        if (along <= 0 || along >= 1) return;
        const nx = px - (ax + along * dx), ny = py - (ay + along * dy), gap = Math.hypot(nx, ny);
        if (gap >= 30) return;
        const [sx, sy] = gap > 0.5 ? [nx / gap, ny / gap] : [-dy / len, dx / len];
        pos[w] = [clamp(px + sx * (30 - gap), 52, 508), clamp(py + sy * (30 - gap), 32, 288)];
      }));
    }
    return pos;
  }

  function kargerRun(graph) {
    let sets = graph.vertices.map(v => [v]);
    const setOf = v => sets.find(set => set.includes(v));
    const run = [];
    while (sets.length > 2) {
      const live = graph.edges.filter(([u, v]) => setOf(u) !== setOf(v));
      if (!live.length) break;
      const [u, v] = live[Math.floor(Math.random() * live.length)];
      const U = setOf(u), W = setOf(v);
      run.push([U, W]);
      sets = sets.filter(set => set !== U && set !== W).concat([U.concat(W)]);
    }
    return run;
  }

  function stoerWagner(graph) {
    const between = (X, Y) => graph.edges.filter(([u, v]) => (X.includes(u) && Y.includes(v)) || (X.includes(v) && Y.includes(u))).length;
    const phases = [];
    let sets = graph.vertices.map(v => [v]);
    while (sets.length > 1) {
      const order = [{ set: sets[0], w: 0 }];
      while (order.length < sets.length) {
        const A = order.map(added => added.set), rest = sets.filter(set => !A.includes(set));
        const weights = rest.map(set => A.reduce((sum, X) => sum + between(X, set), 0));
        const w = Math.max(...weights);
        order.push({ set: rest[weights.indexOf(w)], w, tied: weights.filter(x => x === w).length > 1 });
      }
      const s = order[order.length - 2].set, t = order[order.length - 1].set;
      phases.push({ order, s, t, value: order[order.length - 1].w });
      sets = sets.map(set => (set === s ? s.concat(t).sort() : set)).filter(set => set !== t);
    }
    return phases;
  }

  const minCutValue = graph => Math.min(...stoerWagner(graph).map(phase => phase.value));

  function replay(graph, merges, layout) {
    const vertices = graph.vertices, pos = layoutFor(vertices, graph.edges, layout);

    const groups = [];
    const groupOf = members => {
      const sorted = members.slice().sort();
      const label = sorted.length === 1 ? sorted[0] : '{' + sorted.join(',') + '}';
      let id = groups.findIndex(g => g.label === label);
      if (id < 0) {
        const [x, y] = centroid(sorted, pos);
        const half = Math.max(20, label.length * 4.5 + 12);
        id = groups.push({ members: sorted, label, half, x: clamp(x, 32 + half, 528 - half), y }) - 1;
      }
      return id;
    };
    const room = (g, at, others) => Math.min(...others.map(o => Math.max(Math.abs(at.x - o.x) - g.half - o.half, Math.abs(at.y - o.y) - 40)));

    let owner = {};
    vertices.forEach(v => { owner[v] = groupOf([v]); });
    const edges = graph.edges.map(([u, v], id) => ({ id, u, v, a: owner[u], b: owner[v] }));
    const alive = e => owner[e.u] !== owner[e.v];
    const bows = edges.map(() => 0);
    const frames = [];

    const selfLoops = edges.filter(e => e.u === e.v);
    let loopsShown = true;
    selfLoops.forEach(e => {
      const [x, y] = pos[e.u];
      const near = graph.edges.filter(pair => pair.includes(e.u) && pair[0] !== pair[1]).map(pair => pos[pair[0] === e.u ? pair[1] : pair[0]]);
      const from = near.length ? [mean(near.map(p => p[0])), mean(near.map(p => p[1]))] : [280, 160];
      const fits = angle => Math.abs(x + 70 * Math.cos(angle) - 280) < 246 && Math.abs(y + 70 * Math.sin(angle) - 160) < 146;
      e.angle = Math.atan2(y - from[1], x - from[0]);
      for (let turn = 0; turn < 3 && !fits(e.angle); turn++) e.angle += Math.PI / 2;
      bows[e.id] = selfLoops.filter(other => other.u === e.u && other.id < e.id).length;
    });

    const addFrame = (edgeMarks, nodeMarks) => {
      const bundles = new Map();
      edges.filter(alive).forEach(e => {
        const a = owner[e.u], b = owner[e.v], key = a < b ? a + ':' + b : b + ':' + a;
        if (!bundles.has(key)) bundles.set(key, []);
        bundles.get(key).push(e);
      });
      bundles.forEach(list => list.forEach((e, i) => {
        const sameWay = owner[e.u] === owner[list[0].u];
        bows[e.id] = (sameWay ? 1 : -1) * (i - (list.length - 1) / 2) * BOW;
      }));
      const shown = e => alive(e) || (loopsShown && e.u === e.v);
      const frame = { owner, edgeMarks, nodeMarks, scene: { edges: edges.map(e => ({ bow: bows[e.id], o: shown(e) ? 1 : 0 })) } };
      frames.push(frame);
      return frame;
    };

    addFrame({}, []);
    if (selfLoops.length) {
      loopsShown = false;
      Object.assign(addFrame(Object.fromEntries(selfLoops.map(e => [e.id, 'loop'])), []), {
        hold: 1500,
        title: 'Remove self-loops',
        text: selfLoops.length === 1 ? 'A self-loop never crosses a cut, so it is removed.' : 'Self-loops never cross a cut, so they are removed.'
      });
    }
    const intro = frames.slice();
    const steps = merges.map(([u, v]) => {
      const gu = groupOf(u), gv = groupOf(v);
      const copies = edges.filter(e => (owner[e.u] === gu && owner[e.v] === gv) || (owner[e.u] === gv && owner[e.v] === gu));
      const choose = addFrame(Object.fromEntries(copies.map(e => [e.id, 'chosen'])), [gu, gv]);

      const touching = [];
      edges.forEach(e => {
        if (!alive(e) || copies.includes(e)) return;
        const a = owner[e.u], b = owner[e.v];
        if (a === gu || a === gv) touching.push({ e, end: a, other: b });
        else if (b === gu || b === gv) touching.push({ e, end: b, other: a });
      });
      const marks = Object.fromEntries(copies.map((e, j) => [e.id, j ? 'loop' : 'chosen']));
      const common = new Set();
      touching.forEach(t => {
        if (!touching.some(t2 => t2.other === t.other && t2.end !== t.end)) return;
        marks[t.e.id] = 'parallel';
        common.add(t.other);
      });

      const merged = groupOf(groups[gu].members.concat(groups[gv].members));
      const m = groups[merged];
      const others = Array.from(new Set(Object.values(owner))).filter(id => id !== gu && id !== gv).map(id => groups[id]);
      if (room(m, m, others) < 12) {
        const spot = [m, groups[gu], groups[gv]].reduce((best, at) => (room(m, at, others) > room(m, best, others) ? at : best));
        Object.assign(m, { x: clamp(spot.x, 32 + m.half, 528 - m.half), y: spot.y });
      }
      owner = { ...owner };
      groups[merged].members.forEach(x => { owner[x] = merged; });
      const after = addFrame(marks, [merged]);

      return {
        u: groups[gu].members, v: groups[gv].members, merged: groups[merged].members,
        copies: copies.length,
        common: Array.from(common, id => groups[id].members),
        choose, after
      };
    });

    frames.forEach(frame => {
      frame.scene.nodes = groups.map((g, id) => {
        const first = frame.owner[g.members[0]];
        const together = g.members.every(v => frame.owner[v] === first);
        const at = together ? groups[first] : g;
        return { x: at.x, y: at.y, o: together && first === id ? 1 : 0 };
      });
    });
    return { pos, edges, groups, frames, intro, steps, moveMs: 900 };
  }

  function cutFrame(model, vertices, members) {
    const side = new Set(members), n = vertices.length;
    const A = vertices.filter(v => side.has(v)), B = vertices.filter(v => !side.has(v));
    const a = centroid(A, model.pos), b = centroid(B, model.pos);
    const len = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
    const ux = (a[0] - b[0]) / len, uy = (a[1] - b[1]) / len;
    const shift = v => (side.has(v) ? GAP * B.length / n : -GAP * A.length / n);
    const crossing = model.edges.filter(e => side.has(e.u) !== side.has(e.v));
    return {
      A, B, crossing,
      edgeMarks: Object.fromEntries(crossing.map(e => [e.id, 'cut'])),
      nodeMarks: A.map(v => vertices.indexOf(v)),
      scene: {
        edges: model.intro[model.intro.length - 1].scene.edges,
        nodes: model.groups.map((g, i) => (i < n
          ? { x: clamp(g.x + ux * shift(vertices[i]), 52, 508), y: clamp(g.y + uy * shift(vertices[i]), 32, 288), o: 1 }
          : { x: g.x, y: g.y, o: 0 }))
      }
    };
  }

  const merging = info => ordered(info.u, info.v).join(' and ') + ' merge into ' + setName(info.merged);

  function sideEffects(info) {
    let text = '';
    info.common.forEach(z => {
      text += ' ' + setName(z) + ' was connected to both, so its edges become parallel and connect ' + edgeName(info.merged, z) + '.';
    });
    if (info.copies === 2) {
      text += ' The other copy becomes a self-loop and is removed.';
    } else if (info.copies > 2) {
      text += ' The other ' + (info.copies - 1) + ' copies become self-loops and are removed.';
    }
    if (!info.common.length && info.copies === 1) {
      text += ' Nothing else changes.';
    }
    return text;
  }

  function contractionModel(spec, layout) {
    const model = replay(spec, spec.contract, layout);
    Object.assign(model.frames[0], {
      hold: 1200,
      title: 'Start: the graph',
      text: 'A graph with ' + spec.vertices.length + ' vertices and ' + spec.edges.length + ' edges. Each step contracts one edge.'
    });
    model.steps.forEach((info, i) => {
      const name = edgeName(info.u, info.v), prefix = counter('Step', i, model.steps.length);
      Object.assign(info.choose, {
        hold: 1500,
        title: prefix + 'select ' + name,
        text: 'Contract ' + name + (info.copies > 1 ? ', which has ' + info.copies + ' parallel copies.' : '.')
      });
      Object.assign(info.after, {
        hold: 2000,
        title: prefix + 'contract ' + name,
        text: merging(info) + ', which inherits their edges.' + sideEffects(info)
      });
    });
    return model;
  }

  function cutsModel(spec, layout) {
    const model = replay(spec, [], layout);
    const k = minCutValue(spec);
    Object.assign(model.frames[0], {
      hold: 1500,
      title: 'Start: the graph',
      text: 'A graph with ' + spec.vertices.length + ' vertices and ' + spec.edges.length + ' edges. A cut splits the vertices into sets A and B; ' +
        'its value is the number of edges between them.'
    });

    let minimumSeen = false;
    spec.cuts.forEach((members, i) => {
      const frame = cutFrame(model, spec.vertices, members), value = frame.crossing.length;
      let text = (value === 1 ? '1 edge crosses' : value + ' edges cross') + ' the cut: ' +
        listText(frame.crossing.map(e => edgeName([e.u], [e.v]))) + '.';
      if (value === k) {
        text += minimumSeen ? ' This is a minimum cut too, so the minimum cut is not unique.'
          : ' No cut has fewer, so this is a minimum cut.';
        minimumSeen = true;
      }
      model.frames.push(Object.assign(frame, {
        hold: 2600,
        title: counter('Cut', i, spec.cuts.length) + 'A = ' + braces(frame.A),
        text
      }));
    });
    model.moveMs = 700;
    return model;
  }

  function kargerModel(graph, contractions, layout, extra) {
    const model = replay(graph, contractions, layout);
    const k = minCutValue(graph);
    extra = extra || {};
    model.edges.forEach(e => { e.cut = (extra.cutEdges || []).some(c => c.includes(e.u) && c.includes(e.v)); });

    Object.assign(model.frames[0], {
      hold: 900,
      title: 'Start: the input graph',
      text: 'G has ' + graph.vertices.length + ' vertices and ' + graph.edges.length + ' edges.' +
        (extra.start || ' Each step contracts a random edge, until two vertices remain.')
    });
    model.steps.forEach((info, i) => {
      const name = edgeName(info.u, info.v), prefix = counter('Step', i, model.steps.length);
      const m = info.choose.scene.edges.filter(s => s.o).length;
      Object.assign(info.choose, {
        hold: 1300,
        title: prefix + 'choose a random edge',
        text: 'This run picks ' + name + ' with probability ' + fraction(info.copies, m) +
          (info.copies > 1 ? ', since it has ' + info.copies + ' parallel copies.' : '.') + (extra.choose ? extra.choose(i) : '')
      });
      Object.assign(info.after, {
        hold: 1500,
        title: prefix + 'contract ' + name,
        text: merging(info) + '.' + sideEffects(info)
      });
    });

    const last = model.frames[model.frames.length - 1];
    const sides = Array.from(new Set(Object.values(last.owner))).map(id => model.groups[id]);
    if (sides.length !== 2) return model;
    const value = last.scene.edges.filter(s => s.o).length;
    model.minCut = k;
    model.success = value === k;
    model.frames.push({
      scene: last.scene, edgeMarks: {}, nodeMarks: [], overlay: true,
      title: 'Result: the run ' + (model.success ? 'succeeds' : 'fails'),
      text: 'The run returns ' + setName(sides[1].members) + ' | ' + setName(sides[0].members) +
        (model.success ? ', ' + (extra.unique ? 'the' : 'a') + ' minimum cut.' : ', a cut of value ' + value + ', not the minimum ' + k + '.') +
        (extra.result || '')
    });
    const dx = sides[1].x - sides[0].x, dy = sides[1].y - sides[0].y, len = Math.hypot(dx, dy) || 1;
    const mx = (sides[0].x + sides[1].x) / 2, my = (sides[0].y + sides[1].y) / 2;
    const px = -dy / len, py = dx / len, up = py < 0 ? 1 : -1;
    model.overlay = {
      tone: model.success ? 'ok' : 'fail',
      x1: mx - px * 78, y1: my - py * 78, x2: mx + px * 78, y2: my + py * 78,
      tx: mx + up * px * 94, ty: my + up * py * 94,
      text: 'Returned cut: ' + value + (value === 1 ? ' edge' : ' edges') + (model.success ? ', the minimum' : ', but the minimum is ' + k)
    };
    return model;
  }

  function kargerTrace(spec, trace, layout) {
    const cut = spec.min_cut, odds = spec.success_probability;
    return kargerModel(spec.graph, trace.steps.map(s => [s.contract.u, s.contract.v]), layout, {
      cutEdges: cut.cut_edges,
      unique: cut.unique,
      start: ' The minimum cut is the orange ' + (cut.k === 1 ? 'edge ' : 'edges ') + listText(cut.cut_edges.map(e => e[0] + '–' + e[1])) +
        '. A run finds it only if no orange edge is ever contracted.',
      choose: i => {
        const s = trace.steps[i];
        return s.contracts_min_cut_edge === true ? ' That is a minimum-cut edge, so this run can no longer succeed.' :
          s.contracts_min_cut_edge === false ? ' A random pick avoids the orange edge with probability ' + s.p_avoid_min_cut_this_step + '.' :
          ' The run already failed at step ' + trace.min_cut_edge_contracted_at_step + '.';
      },
      result: ' This sequence has probability ' + trace.steps.map(s => s.probability).join(' × ') + ' = ' +
        trace.probability_of_this_exact_sequence + '. Overall, a run succeeds with probability ' + odds.exact +
        ' (the 2 / (n(n − 1)) bound guarantees ' + odds.bound_2_over_n_n_minus_1 + ').'
    });
  }

  function stoerWagnerModel(graph, layout) {
    const V = graph.vertices, phases = stoerWagner(graph);
    const model = replay(graph, phases.map(phase => [phase.s, phase.t]), layout);
    const frames = model.intro.slice();
    Object.assign(frames[0], {
      hold: 1500,
      title: 'Start: the input graph',
      text: 'G has ' + V.length + ' vertices and ' + graph.edges.length + ' edges. Each phase grows a set A from ' + V[0] +
        ', adding the vertex with the most edges into A.'
    });

    let best = phases[0];
    phases.forEach((phase, p) => {
      const step = model.steps[p], owner = step.choose.owner, prefix = counter('Phase', p, phases.length);
      if (phase.value < best.value) best = phase;
      phase.order.forEach((added, j) => {
        const node = owner[added.set[0]], name = setName(added.set), last = j === phase.order.length - 1;
        const A = phase.order.slice(0, j).map(earlier => owner[earlier.set[0]]);
        const links = model.edges.filter(e => (owner[e.u] === node && A.includes(owner[e.v])) || (owner[e.v] === node && A.includes(owner[e.u])));
        frames.push({
          scene: step.choose.scene,
          nodeMarks: last ? A : A.concat(node),
          edgeMarks: Object.fromEntries(links.map(e => [e.id, last ? 'cut' : 'chosen'])),
          hold: last ? 2000 : 1100,
          title: prefix + (j === 0 ? 'start from ' + name : last ? 'cut of the phase' : 'add ' + name),
          text: j === 0 ? 'A starts with ' + name + '.' :
            last ? name + ' is added last. Cutting it off is the cut of the phase: value ' + phase.value + '. Best so far: ' + best.value + '.' :
            name + (added.tied ? ' is tied for' : ' has') + ' the most edges into A: ' + added.w + '.'
        });
      });
      frames.push(Object.assign(step.after, {
        hold: 1500,
        nodeMarks: [],
        title: prefix + 'merge ' + setName(phase.s) + ' and ' + setName(phase.t),
        text: setName(phase.s) + ' and ' + setName(phase.t) + ' were added last, so they merge into ' + setName(step.merged) + '.' + sideEffects(step)
      }));
    });

    const cut = cutFrame(model, V, best.t);
    frames.push(Object.assign(cut, {
      title: 'Result: a minimum cut of value ' + best.value,
      text: 'The lightest cut came in phase ' + (phases.indexOf(best) + 1) + ': ' + braces(cut.A) + ' | ' + braces(cut.B) +
        ', value ' + best.value + '. That is a minimum cut.'
    }));
    model.frames = frames;
    model.minCut = best.value;
    return model;
  }

  let players = 0;

  function player(host, variants, legend) {
    const swatch = item => (item.shape === 'node'
      ? '<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><g class="' + cls('ga-node', item.mark) +
        '"><rect x="2" y="2" width="16" height="16" rx="8"/></g></svg>'
      : '<svg width="34" height="10" viewBox="0 0 34 10" aria-hidden="true"><path class="' + cls('ga-edge', item.mark) +
        '" d="M3,5 H31"/></svg>');

    host.innerHTML = `
      <div class="ga-controls" role="group" aria-label="Playback">
        <button type="button">Reset</button>
        <button type="button">Back</button>
        <button type="button" class="ga-play">Play</button>
        <button type="button">Next</button>
        <label>Speed <select><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label>
      </div>
      <input type="range" class="ga-scrub" aria-label="Position in the animation">
      <div class="ga-panel">
        <div class="ga-title"></div>
        <svg class="ga-svg" viewBox="30 10 500 300" role="img" aria-label="Animated graph. The text below it describes each step.">
          <g></g><g><line/><text></text></g><g></g>
        </svg>
        <div class="ga-caption"><p aria-live="polite"></p></div>
      </div>
      <ul class="ga-legend" aria-label="Legend">${legend.map(item => '<li>' + swatch(item) + item.label + '</li>').join('')}</ul>`;

    const [resetBtn, backBtn, playBtn, nextBtn] = host.querySelectorAll('button');
    const speedSelect = host.querySelector('select'), scrub = host.querySelector('.ga-scrub');
    const title = host.querySelector('.ga-title');
    const [edgeLayer, overlay, nodeLayer] = host.querySelectorAll('.ga-svg > g');
    const captionBox = host.querySelector('.ga-caption'), caption = captionBox.querySelector('p');
    const html = (tag, text) => Object.assign(document.createElement(tag), { textContent: text || '' });

    let model, edgeEls, nodeEls;
    let shown;
    let index = 0;
    let run = null;
    const speed = () => Number(speedSelect.value);

    function mount() {
      edgeLayer.innerHTML = '<path/>'.repeat(model.edges.length);
      nodeLayer.innerHTML = '<g><rect y="-20" height="40" rx="20"/><text dy="0.35em"></text></g>'.repeat(model.groups.length);
      edgeEls = Array.from(edgeLayer.children);
      nodeEls = Array.from(nodeLayer.children);
      nodeEls.forEach((node, i) => {
        const [rect, text] = node.children, label = model.groups[i].label;
        text.textContent = label;
        const width = Math.max(40, (text.getComputedTextLength() || label.length * 9) + 24);
        rect.setAttribute('x', -width / 2);
        rect.setAttribute('width', width);
      });

      const cutLine = model.overlay, [line, text] = overlay.children;
      overlay.setAttribute('class', cls('ga-overlay', cutLine && cutLine.tone));
      if (cutLine) {
        ['x1', 'y1', 'x2', 'y2'].forEach(name => line.setAttribute(name, cutLine[name]));
        text.setAttribute('x', cutLine.tx);
        text.setAttribute('y', cutLine.ty);
        text.textContent = cutLine.text;
      }

      captionBox.replaceChildren(caption, ...model.frames.map(frame => html('span', frame.text)));
      scrub.max = model.frames.length - 1;
    }

    function draw(scene) {
      scene.edges.forEach((s, i) => {
        const e = model.edges[i], el = edgeEls[i], p = scene.nodes[e.a], q = scene.nodes[e.b];
        const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy);
        const selfLoop = e.a === e.b;
        if (s.o < 0.01 || (len < 1 && !selfLoop)) { el.style.display = 'none'; return; }
        el.style.display = '';
        el.style.opacity = s.o;
        if (selfLoop) {
          const reach = 75 + 24 * s.bow;
          const tip = turn => (p.x + reach * Math.cos(e.angle + turn)).toFixed(1) + ',' + (p.y + reach * Math.sin(e.angle + turn)).toFixed(1);
          el.setAttribute('d', 'M' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ' C' + tip(-0.5) + ' ' + tip(0.5) + ' ' + p.x.toFixed(1) + ',' + p.y.toFixed(1));
          return;
        }
        const cx = (p.x + q.x) / 2 - dy / len * 2 * s.bow;
        const cy = (p.y + q.y) / 2 + dx / len * 2 * s.bow;
        el.setAttribute('d', 'M' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ' Q' + cx.toFixed(1) + ',' + cy.toFixed(1) +
          ' ' + q.x.toFixed(1) + ',' + q.y.toFixed(1));
      });
      scene.nodes.forEach((s, i) => {
        const el = nodeEls[i];
        if (s.o < 0.01) { el.style.display = 'none'; return; }
        el.style.display = '';
        el.style.opacity = s.o;
        el.setAttribute('transform', 'translate(' + s.x.toFixed(1) + ',' + s.y.toFixed(1) + ')');
      });
    }

    function blend(a, b, t, direction) {
      const p = ease(t);
      const fade = direction > 0 ? clamp((t - 0.55) / 0.35) : clamp(t / 0.35);
      return {
        edges: a.edges.map((s, i) => ({ bow: lerp(s.bow, b.edges[i].bow, p), o: lerp(s.o, b.edges[i].o, fade) })),
        nodes: a.nodes.map((s, i) => ({ x: lerp(s.x, b.nodes[i].x, p), y: lerp(s.y, b.nodes[i].y, p), o: lerp(s.o, b.nodes[i].o, fade) }))
      };
    }

    let raf = 0, settle = null;

    function moveTo(scene, ms, direction) {
      cancelAnimationFrame(raf);
      if (settle) settle();
      if (ms <= 0) {
        shown = scene;
        draw(shown);
        return Promise.resolve();
      }
      const from = shown, began = performance.now();
      return new Promise(resolve => {
        settle = () => { settle = null; resolve(); };
        const tick = now => {
          const t = clamp((now - began) / ms);
          shown = t < 1 ? blend(from, scene, t, direction) : scene;
          draw(shown);
          if (t < 1) raf = requestAnimationFrame(tick); else settle();
        };
        raf = requestAnimationFrame(tick);
      });
    }

    function refresh() {
      const frame = model.frames[index], last = model.frames.length - 1;
      title.textContent = frame.title;
      caption.textContent = frame.text;
      model.edges.forEach((e, i) => edgeEls[i].setAttribute('class', cls('ga-edge', e.cut && 'cut', frame.edgeMarks[i])));
      nodeEls.forEach((el, i) => el.setAttribute('class', cls('ga-node', frame.nodeMarks.includes(i) && 'lit')));
      overlay.classList.toggle('is-shown', Boolean(frame.overlay));

      scrub.value = index;
      scrub.setAttribute('aria-valuetext', frame.title);
      resetBtn.disabled = backBtn.disabled = index === 0;
      nextBtn.disabled = index === last;
      playBtn.textContent = run ? 'Pause' : index === last ? 'Replay' : 'Play';
    }

    function show(target, animate) {
      const from = index;
      index = clamp(target, 0, model.frames.length - 1);
      refresh();
      const scene = model.frames[index].scene, direction = index - from;
      const moves = Math.abs(direction) === 1 && JSON.stringify(scene) !== JSON.stringify(model.frames[from].scene);
      return moveTo(scene, animate && moves && !reduceMotion.matches ? model.moveMs / speed() : 0, direction);
    }

    const stop = () => { run = null; };

    async function play() {
      const mine = run = {}, last = model.frames.length - 1;
      if (index === last) {
        show(0, false);
        await wait(model.frames[0].hold / speed());
      } else {
        refresh();
      }
      while (run === mine && index < last && title.isConnected) {
        await show(index + 1, true);
        if (run === mine && index < last) await wait(model.frames[index].hold / speed());
      }
      if (run === mine) {
        stop();
        refresh();
      }
    }

    function load(variant) {
      stop();
      model = variant.build();
      mount();
      index = 0;
      show(0, false);
    }

    resetBtn.addEventListener('click', () => { stop(); show(0, false); });
    backBtn.addEventListener('click', () => { stop(); show(index - 1, true); });
    nextBtn.addEventListener('click', () => { stop(); show(index + 1, true); });
    scrub.addEventListener('input', () => { stop(); show(Number(scrub.value), true); });
    playBtn.addEventListener('click', () => {
      if (run) { stop(); refresh(); } else play();
    });

    if (variants.length > 1) {
      const picker = html('fieldset'), name = 'ga-variant-' + (++players);
      picker.className = 'ga-variants';
      picker.append(html('legend', 'Trace'));
      variants.forEach((variant, i) => {
        const radio = Object.assign(html('input'), { type: 'radio', name, checked: i === 0 });
        radio.addEventListener('change', () => load(variant));
        picker.appendChild(html('label')).append(radio, ' ' + variant.label);
      });
      host.prepend(picker);
    }
    load(variants[0]);
    return model;
  }

  const EDGE = { shape: 'edge', label: 'edge' };
  const CONTRACTING = [
    { shape: 'edge', mark: 'chosen', label: 'chosen edge' },
    { shape: 'edge', mark: 'parallel', label: 'new parallel edges' },
    { shape: 'edge', mark: 'loop', label: 'removed self-loop' }
  ];
  const graphOf = spec => spec.graph || spec;

  const KINDS = {
    'cuts': (spec, layout) => ({
      variants: [{ build: () => cutsModel(spec, layout) }],
      legend: [
        EDGE,
        { shape: 'edge', mark: 'cut', label: 'crossing edge' },
        { shape: 'node', mark: 'lit', label: 'vertex in A' },
        { shape: 'node', label: 'vertex in B' }
      ]
    }),
    'contraction': (spec, layout) => ({
      variants: [{ build: () => contractionModel(spec, layout) }],
      legend: [EDGE].concat(CONTRACTING)
    }),
    'karger': (spec, layout) => ({
      variants: [{ build: () => kargerModel(graphOf(spec), kargerRun(graphOf(spec)), layout) }],
      legend: [EDGE].concat(CONTRACTING)
    }),
    'stoer-wagner': (spec, layout) => ({
      variants: [{ build: () => stoerWagnerModel(graphOf(spec), layout) }],
      legend: [
        EDGE,
        { shape: 'edge', mark: 'chosen', label: 'edges into A' },
        { shape: 'edge', mark: 'cut', label: 'cut of the phase' },
        { shape: 'node', mark: 'lit', label: 'vertex in A' }
      ]
    }),
    'karger-trace': (spec, layout) => ({
      variants: Object.keys(spec).filter(key => key.startsWith('trace_')).map(key => ({
        label: key.replace('trace_', 'Trace ') + (spec[key].success ? ' (succeeds)' : ' (fails)'),
        build: () => kargerTrace(spec, spec[key], layout)
      })),
      legend: [EDGE, { shape: 'edge', mark: 'cut', label: 'minimum-cut edge' }].concat(CONTRACTING)
    })
  };

  function mount(host, kind, spec, layout) {
    const setup = KINDS[kind](spec, layout);
    return player(host, setup.variants, setup.legend);
  }
  window.graphAnimation = { mount };

  document.querySelectorAll('figure.graph-animation[data-kind]').forEach(host => {
    const inline = host.querySelector('script[type="application/json"]');
    const source = window[host.dataset.source] || {};
    mount(host, host.dataset.kind, inline ? JSON.parse(inline.textContent) : source.spec,
      host.dataset.layout ? JSON.parse(host.dataset.layout) : source.layout);
  });
})();
