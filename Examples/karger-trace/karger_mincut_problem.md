# Guided Problem: Tracing Karger's Algorithm by Hand

> **What you will be able to do after this problem**
>
> 1. Trace Karger's algorithm by hand, correctly handling all three contraction cases: an ordinary edge, an edge whose contraction **creates parallel edges**, and contractions that **remove self-loops**.
> 2. Explain *why* a run succeeds or fails: it fails exactly when an edge crossing the minimum cut is contracted.
> 3. Compute the exact success probability of a single run on a concrete graph and compare it with the general lower bound $\frac{2}{n(n-1)}$.
> 4. Trace a similar graph on your own.

**Notation** (the same as the rest of the site). $n = |V|$, $m = |E|$, $k$ = size of a minimum cut, $G/e$ = the contraction of edge $e$. A composite vertex is written as the set of original vertices it contains, e.g. $\{c, f\}$. A vertex that has not been merged yet is written as a plain letter, e.g. $a$. We write $X\text{–}Y$ for an edge between (possibly composite) vertices $X$ and $Y$, and $X\text{–}Y \times 2$ for two parallel copies of it.

**Reminder of the definitions**
- *Contraction* $G/e$ for $e = \{u, v\}$: replace $u$ and $v$ by one composite vertex, redirect every edge incident to $u$ or $v$ to it, **remove self-loops**, and **keep parallel edges**.
- *Karger's algorithm*: while more than 2 vertices remain, pick an edge **uniformly at random from the current multigraph** (each parallel copy counts separately) and contract it. When 2 composite vertices remain, return the cut between them.
- Karger's algorithm is a **Monte Carlo** algorithm: its running time is fixed, but it may return a wrong (non-minimum) cut.

---

## 1. The problem

Let $G = (V, E)$ be the undirected, unweighted, simple graph with

$$
V = \{a, b, c, d, f, g, h\}, \qquad n = 7,
$$

$$
E = \{\, a\text{–}b,\; a\text{–}c,\; a\text{–}d,\; b\text{–}g,\; b\text{–}h,\; c\text{–}f,\; d\text{–}f,\; g\text{–}h \,\}, \qquad m = 8.
$$

(We skip the letter $e$, which denotes an edge, and never use $w$, which denotes edge weight elsewhere on the site.)

| vertex | a | b | c | d | f | g | h |
|---|---|---|---|---|---|---|---|
| neighbours | b, c, d | a, g, h | a, f | a, f | c, d | b, h | b, g |
| degree | 3 | 3 | 2 | 2 | 2 | 2 | 2 |

**Questions.**

1. **(Ground truth)** Find a minimum cut of $G$ and its value $k$. Is it unique?
2. **(Trace A)** Run Karger's algorithm by hand using the contraction sequence below. After every step, record the chosen edge, the probability of choosing it, the composite vertices, and the full edge multiset.
   $$c\text{–}f,\quad b\text{–}h,\quad \{b,h\}\text{–}g,\quad a\text{–}d,\quad \{a,d\}\text{–}\{c,f\}$$
3. **(Trace B)** Do the same for
   $$g\text{–}h,\quad a\text{–}b,\quad c\text{–}f,\quad \{c,f\}\text{–}d,\quad \{a,b\}\text{–}\{g,h\}$$
   Which cut is returned? Is it minimum? If not, at which step did the run go wrong?
4. **(Probability)** For trace A, compute at each step the probability that the step does not contract a minimum-cut edge, given that no earlier step did. Then find the **exact** probability that one run of Karger's algorithm on $G$ returns the minimum cut, and compare it with $\frac{2}{n(n-1)}$.

---

## 2. Ground truth: the minimum cut

> ### ✅ Checkpoint 1: guess first
> Every vertex of $G$ has degree at least 2. Does cutting off one vertex of smallest degree, say $\{c\}$, give a minimum cut? Can you find a cut whose value is **less than 2**?
>
> <details><summary>Hint</summary>
> A cut of value 1 is a single edge whose removal disconnects the graph. Look for an edge that lies on no cycle.
> </details>
>
> <details><summary>Model answer</summary>
>
> Cutting off $\{c\}$ gives value $\deg(c) = 2$, but that is **not** the minimum. The edge $a\text{–}b$ lies on no cycle: the vertices $a, c, f, d$ form a 4-cycle $a\text{–}c\text{–}f\text{–}d\text{–}a$, and $b, g, h$ form a triangle, and $a\text{–}b$ is the only edge between them. Removing it disconnects the graph, so
> $$S = \{b, g, h\},\quad V \setminus S = \{a, c, d, f\},\quad \text{cut edges} = \{a\text{–}b\},\quad k = 1.$$
> </details>

**Brute-force verification.** A cut is an unordered pair $\{S, V\setminus S\}$ with $\emptyset \ne S \ne V$. Fixing $a \notin S$ lists every cut exactly once, which gives $2^{n-1} - 1 = 63$ cuts. Enumerating all of them (`brute_force_min_cut` in `karger_verify.py`) gives:

| cut value | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| number of cuts | **1** | 9 | 9 | 19 | 19 | 3 | 3 |

So $k = 1$, and the minimum cut $\{b, g, h\} \mid \{a, c, d, f\}$ is **unique**. The 9 cuts of value 2 are: $\{c\}, \{d\}, \{f\}, \{c,f\}, \{d,f\}, \{c,d,f\}$ (splitting the 4-cycle side) and $\{g\}, \{h\}, \{g,h\}$ (splitting the triangle side). Remember these, because every failed run will return one of them.

The guess "cut off a vertex of smallest degree" gives 2, not 1. A careless answer is wrong here.

**Common misconceptions at this stage**
- *"The minimum cut is the smallest degree."* The smallest degree is only an **upper bound** on $k$. Here it is 2 but $k = 1$.
- *"There are $2^n$ cuts."* $S$ and $V \setminus S$ are the same cut, and $S = \emptyset$ or $S = V$ is not a cut. That leaves $2^{n-1} - 1$.
- *"Min cut means min $s$–$t$ cut."* Karger finds a **global** minimum cut. No source or sink is given.

---

## 3. Worked trace A: a run that succeeds

**How to do one step.** Before contracting $X\text{–}Y$, check two things:
1. **Multiplicity of $X\text{–}Y$.** If there are $\mu$ parallel copies, the step's probability is $\mu/m$ (any copy gives the same result), and after contracting one copy the other $\mu - 1$ copies become **self-loops, which are removed**. So $m$ drops by $\mu$.
2. **Common neighbours of $X$ and $Y$.** If both are adjacent to some $Z$, the edges $X\text{–}Z$ and $Y\text{–}Z$ both become $\{X \cup Y\}\text{–}Z$: **parallel edges are created** (kept, not merged).

If $\mu = 1$ and there is no common neighbour, the contraction is **ordinary**: only the one edge disappears and nothing else changes shape.

The minimum-cut edge is $a\text{–}b$. It is marked **bold** wherever it appears.

### Step A1: contract $c\text{–}f$ (ordinary)
- Before: $n = 7$, $m = 8$. Edges: **$a\text{–}b$**, $a\text{–}c$, $a\text{–}d$, $b\text{–}g$, $b\text{–}h$, $c\text{–}f$, $d\text{–}f$, $g\text{–}h$.
- $P(\text{choose } c\text{–}f) = 1/8$.
- Neighbours of $c$: $a, f$. Neighbours of $f$: $c, d$. No common neighbour, one copy. This is the **ordinary** case.
- New vertex $\{c, f\}$. The edge $a\text{–}c$ becomes $a\text{–}\{c,f\}$, and $d\text{–}f$ becomes $\{c,f\}\text{–}d$.
- After: $n = 6$, $m = 7$.
  $$\mathbf{a\text{–}b},\; a\text{–}\{c,f\},\; a\text{–}d,\; b\text{–}g,\; b\text{–}h,\; \{c,f\}\text{–}d,\; g\text{–}h$$

### Step A2: contract $b\text{–}h$ (parallel edges created)
- Before: $n = 6$, $m = 7$. $P(\text{choose } b\text{–}h) = 1/7$.
- Neighbours of $b$: $a, g, h$. Neighbours of $h$: $b, g$. **Common neighbour $g$.** So $b\text{–}g$ and $h\text{–}g$ both become $\{b,h\}\text{–}g$, which gives **two parallel edges**. Keep both.
- The edge $a\text{–}b$ becomes $a\text{–}\{b,h\}$. It is still the one minimum-cut edge, just with a new endpoint name.
- After: $n = 5$, $m = 6$.
  $$\mathbf{a\text{–}\{b,h\}},\; a\text{–}\{c,f\},\; a\text{–}d,\; \{b,h\}\text{–}g \times 2,\; \{c,f\}\text{–}d$$

> ### ✅ Checkpoint 2: probabilities in the current multigraph
> Using the multigraph after step A2, what is the probability that step A3 contracts **some copy** of $\{b,h\}\text{–}g$? What is the probability that it contracts the minimum-cut edge?
>
> <details><summary>Hint</summary>
> Count $m$ for the <em>current</em> multigraph, with each parallel copy counted separately. Do not use the original $m = 8$.
> </details>
>
> <details><summary>Model answer</summary>
>
> $m = 6$, and $\{b,h\}\text{–}g$ has 2 copies, so $P = 2/6 = 1/3$ (each copy alone has probability $1/6$). The minimum-cut edge $a\text{–}\{b,h\}$ has one copy, so it is chosen with probability $1/6$.
> </details>

### Step A3: contract $\{b,h\}\text{–}g$ (self-loop removed)
- Before: $n = 5$, $m = 6$. $P(\text{choose a copy of } \{b,h\}\text{–}g) = 2/6 = 1/3$.
- We contract one copy. The **other copy now joins $\{b,g,h\}$ to itself, so it is a self-loop, and it is removed.**
- After: $n = 4$, $m = 4$. Two edges disappeared: the contracted copy and the self-loop.
  $$\mathbf{a\text{–}\{b,g,h\}},\; a\text{–}\{c,f\},\; a\text{–}d,\; \{c,f\}\text{–}d$$

> ### ✅ Checkpoint 3: counting edges
> Why did $m$ drop from 6 to 4 in step A3, when steps A1 and A2 each reduced $m$ by only 1?
>
> <details><summary>Hint</summary>
> What happens to a parallel copy of the edge you contract?
> </details>
>
> <details><summary>Model answer</summary>
>
> Contracting a pair with multiplicity $\mu$ removes all $\mu$ copies: one is contracted, and the other $\mu - 1$ become self-loops, which are removed. Here $\mu = 2$, so $m$ drops by 2. In general $m_{\text{after}} = m_{\text{before}} - \mu$. Parallel edges created by a common neighbour do **not** change $m$; they only relabel endpoints.
> </details>

### Step A4: contract $a\text{–}d$ (parallel edges created)
- Before: $n = 4$, $m = 4$. $P(\text{choose } a\text{–}d) = 1/4$.
- Neighbours of $a$: $\{b,g,h\}, \{c,f\}, d$. Neighbours of $d$: $a, \{c,f\}$. **Common neighbour $\{c,f\}$**, so $a\text{–}\{c,f\}$ and $d\text{–}\{c,f\}$ become $\{a,d\}\text{–}\{c,f\} \times 2$.
- After: $n = 3$, $m = 3$.
  $$\mathbf{\{a,d\}\text{–}\{b,g,h\}},\; \{a,d\}\text{–}\{c,f\} \times 2$$

### Step A5: contract $\{a,d\}\text{–}\{c,f\}$ (self-loop removed)
- Before: $n = 3$, $m = 3$. $P(\text{choose a copy of } \{a,d\}\text{–}\{c,f\}) = 2/3$.
- One copy is contracted and the other becomes a self-loop, which is removed.
- After: $n = 2$, $m = 1$.
  $$\mathbf{\{a,c,d,f\}\text{–}\{b,g,h\}}$$

**Result.** The algorithm stops at 2 vertices and returns the cut $\{a,c,d,f\} \mid \{b,g,h\}$ with **one** crossing edge (the original $a\text{–}b$). This is the minimum cut, so the run **succeeds**.

**Where the three cases occur in trace A:** ordinary in A1; parallel edges created in A2 and A4; self-loops removed in A3 and A5.

The probability of following exactly this sequence of choices is $\frac18 \cdot \frac17 \cdot \frac13 \cdot \frac14 \cdot \frac23 = \frac{1}{1008}$. This is **not** the success probability. Many other sequences also succeed (§5).

---

## 4. Worked trace B: a run that fails

### Step B1: contract $g\text{–}h$ (parallel edges created)
- Before: $n = 7$, $m = 8$. $P = 1/8$.
- Common neighbour of $g$ and $h$: $b$. So $b\text{–}g$ and $b\text{–}h$ become $b\text{–}\{g,h\} \times 2$.
- After: $n = 6$, $m = 7$.
  $$\mathbf{a\text{–}b},\; a\text{–}c,\; a\text{–}d,\; b\text{–}\{g,h\} \times 2,\; c\text{–}f,\; d\text{–}f$$

### Step B2: contract $a\text{–}b$ (ordinary). ⚠️ This is the minimum-cut edge
- Before: $n = 6$, $m = 7$. $P(\text{choose } a\text{–}b) = 1/7$.
- Neighbours of $a$: $b, c, d$. Neighbours of $b$: $a, \{g,h\}$. No common neighbour, one copy. This is the **ordinary** case. (The edges $b\text{–}\{g,h\} \times 2$ were already parallel. They are carried over as $\{a,b\}\text{–}\{g,h\} \times 2$, not newly created.)
- After: $n = 5$, $m = 6$.
  $$\{a,b\}\text{–}c,\; \{a,b\}\text{–}d,\; \{a,b\}\text{–}\{g,h\} \times 2,\; c\text{–}f,\; d\text{–}f$$
- **The run is now doomed.** Vertices $a$ and $b$ are inside the same composite vertex, and composite vertices only ever grow. So $a$ and $b$ end up on the same side of the final cut, and the final cut can never be $\{a,c,d,f\} \mid \{b,g,h\}$.

> ### ✅ Checkpoint 4: when is a run lost?
> After step B2, is there **any** way to finish the run (any choice of the remaining 3 contractions) that returns the minimum cut? Which kind of cut must be returned instead?
>
> <details><summary>Hint</summary>
> Where can $a$ and $b$ end up in the final 2-vertex graph?
> </details>
>
> <details><summary>Model answer</summary>
>
> No. Every remaining sequence returns a cut with $a$ and $b$ on the same side, so it never returns the unique minimum cut. The run **failed at step B2**, the moment the cut edge was contracted. Nothing after that matters for success. Conversely, a run that **never** contracts $a\text{–}b$ must end with $\{a,c,d,f\}$ and $\{b,g,h\}$ as its two vertices, because contractions inside one side never merge the two sides, and the algorithm stops at 2 vertices. So:
> $$\text{run succeeds} \iff \text{no minimum-cut edge is ever contracted.}$$
> </details>

### Step B3: contract $c\text{–}f$ (ordinary)
- Before: $n = 5$, $m = 6$. $P = 1/6$.
- Neighbours of $c$: $\{a,b\}, f$. Neighbours of $f$: $c, d$. No common neighbour, one copy, so this is **ordinary**.
- After: $n = 4$, $m = 5$.
  $$\{a,b\}\text{–}\{c,f\},\; \{a,b\}\text{–}d,\; \{a,b\}\text{–}\{g,h\} \times 2,\; \{c,f\}\text{–}d$$

### Step B4: contract $\{c,f\}\text{–}d$ (parallel edges created)
- Before: $n = 4$, $m = 5$. $P = 1/5$.
- Common neighbour $\{a,b\}$, so $\{a,b\}\text{–}\{c,f\}$ and $\{a,b\}\text{–}d$ become $\{a,b\}\text{–}\{c,d,f\} \times 2$.
- After: $n = 3$, $m = 4$.
  $$\{a,b\}\text{–}\{c,d,f\} \times 2,\; \{a,b\}\text{–}\{g,h\} \times 2$$

### Step B5: contract $\{a,b\}\text{–}\{g,h\}$ (self-loop removed)
- Before: $n = 3$, $m = 4$. $P(\text{choose a copy}) = 2/4 = 1/2$.
- One copy is contracted and the other becomes a self-loop, which is removed.
- After: $n = 2$, $m = 2$.
  $$\{a,b,g,h\}\text{–}\{c,d,f\} \times 2$$

**Result.** The algorithm returns $\{c,d,f\} \mid \{a,b,g,h\}$. Its crossing edges in the original graph are $a\text{–}c$ and $a\text{–}d$, so its **value is 2**, the number of parallel copies left at the end. This is a valid cut, but not a minimum one ($k = 1$), so the run **fails**. That is the Monte Carlo behaviour: the running time is fixed, and the answer can be wrong.

(Had step B5 contracted a copy of $\{a,b\}\text{–}\{c,d,f\}$ instead, the result would have been $\{g,h\} \mid \{a,b,c,d,f\}$, also of value 2. Either way the run fails.)

**Where the three cases occur in trace B:** ordinary in B2 and B3; parallel edges created in B1 and B4; self-loops removed in B5.

The probability of this exact sequence is $\frac18 \cdot \frac17 \cdot \frac16 \cdot \frac15 \cdot \frac12 = \frac{1}{3360}$.

**Common misconceptions while tracing**
- **Merging parallel edges into one.** This changes every later probability, and it can make a failed run look successful. In trace B, merging would leave a single edge $\{a,b,g,h\}\text{–}\{c,d,f\}$ at the end, and you would wrongly report a cut of value 1. The true value is 2. In trace A, step A3 would be computed as $1/5$ instead of the correct $2/6$.
- **Keeping self-loops.** In trace A after step A3, a kept loop on $\{b,g,h\}$ would give $m = 5$ and $P(a\text{–}d) = 1/5$ instead of $1/4$. A self-loop is not a choosable edge, because contracting it would not reduce $n$.
- **Using the original graph's probabilities.** The probability is $\mu/m$ for the **current** $m$. It is not $1/8$ at every step.
- **Choosing uniformly among vertex *pairs* instead of edges.** In step A5 there are two adjacent pairs, but $P(\{a,d\}\text{–}\{c,f\}) = 2/3$, not $1/2$, because it has two copies.
- **Confusing contracted edges with cut edges.** The edges you contract end up **inside** the two sides. The cut is formed by the edges **left over** at the end. In trace A we contracted 5 edges (and removed 2 self-loops), and the cut is the 1 remaining edge.
- **"The run failed at the last step."** In trace B the failure happened at step B2. Steps B3 to B5 only decided *which* wrong cut came out.

---

## 5. Probability analysis

### 5.1 Step-by-step along trace A

Let $n_i$ and $m_i$ be the number of vertices and edges **just before** step $i$. As long as no cut edge has been contracted, all $k$ minimum-cut edges are still present (here, the single edge $a\text{–}b$ under its current name). So

$$
P(\text{step } i \text{ avoids the min cut} \mid \text{steps } 1..i-1 \text{ avoided it}) = 1 - \frac{k}{m_i}.
$$

> ### ✅ Checkpoint 5: compare with the general bound
> Fill in the column $1 - k/m_i$ for trace A, and compare it with $1 - \frac{2}{n_i}$. Why is every entry at least $1 - \frac{2}{n_i}$?
>
> <details><summary>Hint</summary>
> In any multigraph reached without contracting a minimum-cut edge, the degree of a composite vertex $X$ is the value of the cut $\{X, V\setminus X\}$ in $G$. How small can that be?
> </details>
>
> <details><summary>Model answer</summary>
>
> | step $i$ | $n_i$ | $m_i$ | $P(\text{avoid}) = 1 - \frac{k}{m_i}$ | general bound $1 - \frac{2}{n_i}$ | this graph: $1 - \frac{1}{n_i}$ |
> |---|---|---|---|---|---|
> | A1 | 7 | 8 | $7/8$ | $5/7$ | $6/7$ |
> | A2 | 6 | 7 | $6/7$ | $4/6$ | $5/6$ |
> | A3 | 5 | 6 | $5/6$ | $3/5$ | $4/5$ |
> | A4 | 4 | 4 | $3/4$ | $2/4$ | $3/4$ |
> | A5 | 3 | 3 | $2/3$ | $1/3$ | $2/3$ |
> | product | | | $\frac{5}{16} \approx 0.313$ | $\frac{2}{7\cdot 6} = \frac{1}{21} \approx 0.048$ | $\frac{2}{7} \approx 0.286$ |
>
> **Why $\ge 1 - 2/n_i$ (the known result from the proof section).** Every vertex $X$ of the current multigraph has degree equal to the value of a cut of $G$, so $\deg X \ge k$. Summing over $n_i$ vertices gives $m_i \ge k n_i / 2$, hence $1 - k/m_i \ge 1 - 2/n_i$. Multiplying over $n_i = n, n-1, \dots, 3$ gives the telescoping bound $\frac{2}{n(n-1)}$.
>
> **Why this graph does better.** Every cut of $G$ other than the minimum one has value $\ge 2 = 2k$. Before the last step, at most one vertex can have degree 1 (the composite vertex $\{b,g,h\}$ or $\{a,c,d,f\}$, once a whole side has merged). Every other vertex has degree $\ge 2$. So $2m_i \ge 2(n_i - 1) + 1$, i.e. $m_i \ge n_i$, and $P(\text{avoid}) \ge 1 - 1/n_i$. This bound is attained in A4 and A5.
> </details>

Note that the product $5/16$ is the probability of avoiding $a\text{–}b$ **along the multigraphs of trace A**. Different runs pass through different multigraphs with different $m_i$, so the true success probability averages over all of them (next subsection).

### 5.2 The exact single-run success probability

**Method 1 (computer, exhaustive).** `karger_verify.py` computes it in two independent ways:
- **Exhaustive enumeration** of every possible sequence of edge-copy choices (5040 sequences, each weighted by its probability $\prod \frac{1}{m_i}$).
- **Dynamic programming** over the 119 reachable partitions of $V$. From each partition, every pair $X\text{–}Y$ with multiplicity $\mu$ is taken with probability $\mu/m$.

Both give

$$
\boxed{\;P(\text{one run returns the minimum cut}) = \frac{9}{28} \approx 0.3214\;}
$$

**Method 2 (by hand, optional).** There is an equivalent way to run Karger's algorithm: shuffle the 8 original edges into a uniformly random order, then go through the list. Contract each edge unless it has already become a self-loop (then skip it), and stop at 2 vertices. This is the same process because at every moment the edges not yet looked at are in uniformly random order. So the next one that is not a self-loop is uniformly distributed over the non-loop unseen edges, and those are exactly the edges of the current multigraph.

In this view, the run succeeds exactly when, by the time $a\text{–}b$ comes up in the list, both sides are already single vertices (so the algorithm has stopped). The 4-cycle side is connected by any 3 of its 4 edges, and the triangle side by any 2 of its 3 edges. Let $j$ be the number of edges before $a\text{–}b$ in the shuffled list. Then $j$ is uniform on $\{0, \dots, 7\}$, and the $j$ edges before it are a uniformly random $j$-subset of the other 7:
- $j \le 4$: impossible (we need $3 + 2 = 5$ edges).
- $j = 5$: we need exactly 3 cycle edges and 2 triangle edges: $\binom43\binom32 / \binom75 = 12/21 = 4/7$.
- $j = 6$ or $7$: always fine.

$$
P = \frac18\left(\frac47 + 1 + 1\right) = \frac{18}{56} = \frac{9}{28}. \checkmark
$$

**Where the failures go.** The exact output distribution (from the DP) is:

| returned cut | value | probability |
|---|---|---|
| $\{b,g,h\} \mid \{a,c,d,f\}$ (minimum) | 1 | $9/28 \approx 0.321$ |
| $\{g\}$, $\{h\}$, $\{g,h\}$ vs the rest | 2 | $1/12$ each, so $1/4$ in total |
| $\{c\}$, $\{d\}$, $\{f\}$, $\{c,f\}$, $\{d,f\}$, $\{c,d,f\}$ vs the rest | 2 | $1/14$ each, so $3/7$ in total |

Every failed run returns a cut of value 2, never more.

**Monte Carlo check.** 100,000 simulated runs (seed 3821) succeeded with frequency $0.32116$. The standard error is $\sqrt{p(1-p)/N} \approx 0.0015$, so this is $0.18$ standard errors from $9/28$. It agrees.

### 5.3 Comparison with $\frac{2}{n(n-1)}$

$$
\frac{2}{n(n-1)} = \frac{2}{42} = \frac{1}{21} \approx 0.048 \quad\le\quad \frac{2}{7} \approx 0.286 \quad\le\quad \frac{9}{28} \approx 0.321.
$$

The exact value is about $6.75\times$ the general bound. The bound is a **worst case over all graphs**. Its proof assumes every vertex might have degree exactly $k$ at every step, i.e. $m_i$ as small as $k n_i / 2$. (That worst case really happens: on a cycle $C_n$, every vertex has degree $k = 2$ and each particular minimum cut is found with probability exactly $\frac{2}{n(n-1)}$.) In $G$:
1. every non-minimum cut has value $\ge 2k$, so almost every vertex has degree $\ge 2k$ and $m_i \ge n_i$, twice the worst case. This alone raises the guarantee to $\frac{2}{7}$;
2. many reachable multigraphs have even more edges than $n_i$ (e.g. $m = 8 > 7$ at the start), so the true value $\frac{9}{28}$ is higher still.

**Common misconceptions in the probability analysis**
- *"$5/16$ (the product along trace A) is the success probability."* It is only for one particular path of multigraphs. The answer must average over all runs: $9/28$.
- *"$1/1008$ is the success probability."* That is the probability of one exact sequence of choices.
- *"$\frac{2}{n(n-1)}$ is the success probability."* It is a lower bound valid for **every** graph. A specific graph can (and usually does) do much better.
- *"$P(\text{avoid at step } i) = 1 - k/m$ with the original $m$."* It must use the **current** $m_i$, which shrinks, so later steps are riskier.

### 5.4 Looking ahead

A single run succeeds only with probability $9/28$. Since runs are independent, repeating the algorithm and keeping the smallest cut found drives the failure probability down quickly. How many repetitions are needed in general is the topic of the following part

---

## 6. Unguided follow-up (try it yourself)

Let $H$ have vertices $p, q, r, s, t$ and edges

$$
p\text{–}q,\; p\text{–}r,\; p\text{–}s,\; q\text{–}r,\; q\text{–}s,\; r\text{–}s,\; p\text{–}t,\; q\text{–}t \qquad (n = 5,\ m = 8).
$$

1. Find the minimum cut of $H$ and $k$. Is it unique?
2. Trace Karger's algorithm with the sequence $r\text{–}s,\ p\text{–}q,\ \{p,q\}\text{–}\{r,s\}$. At each step give the probability of the choice, the new multigraph, and the contraction case(s). Does the run succeed?
3. Give $P(\text{avoid})$ at each step of your trace, multiply them, and compare with $\frac{2}{n(n-1)}$.
4. Find a 3-step sequence that fails, and state the cut it returns and its value.
5. *(Challenge)* Find the exact single-run success probability. (Hint: use the random-order view from §5.2. $K_4$ has 16 spanning trees.)

Answers are in the appendix at the end. Try first!

---

## 7. Sources

1. D. R. Karger and C. Stein, "A new approach to the minimum cut problem", *Journal of the ACM* 43(4):601–640, 1996. doi:10.1145/234533.234534. Source of the contraction algorithm's analysis and the $\binom{n}{2}^{-1} = \frac{2}{n(n-1)}$ bound.
2. H. Yu, *COS 521: Advanced Algorithm Design, Lecture 1: Karger's Min Cut Algorithm*, Princeton University, Fall 2025. <https://www.cs.princeton.edu/~hy2/teaching/fall25-cos521/notes/mincut.pdf>. Contraction keeps multi-edges and drops self-loops; Lemma 1 ($|E| \ge nk/2$), Corollary 2 ($1 - 2/n$ per step), Theorem 3 ($\ge \frac{2}{n(n-1)}$).
3. D. R. Karger, "Global min-cuts in RNC, and other ramifications of a simple min-cut algorithm", *Proc. 4th ACM-SIAM SODA*, 1993. The original contraction algorithm (cited as "Karger 1993" in [2]).
4. J. Kleinberg and É. Tardos, *Algorithm Design*, Pearson, 2006, §13.2 "Finding the Global Minimum Cut". Background reading at an undergraduate level.
5. R. Motwani and P. Raghavan, *Randomized Algorithms*, Cambridge University Press, 1995, §1.1. The min-cut example as an introduction to Monte Carlo algorithms.

All numbers in this problem are generated and checked by `karger_verify.py`. The step-by-step data for the simulation is in `karger_trace_spec.json`.

---
---

## Appendix: answers to the follow-up (§6)

<details><summary>Show answers</summary>

**1.** $\deg t = 2$, while $p, q$ have degree 4 and $r, s$ have degree 3. Brute force over $2^4 - 1 = 15$ cuts gives values $\{2{:}\,1,\ 3{:}\,2,\ 4{:}\,5,\ 5{:}\,6,\ 6{:}\,1\}$. The unique minimum cut is $\{t\} \mid \{p,q,r,s\}$ with $k = 2$ (cut edges $p\text{–}t$, $q\text{–}t$). Unlike $G$, here the minimum cut **is** a single vertex. Compare the two!

**2.**

| step | before ($n$, $m$) | contract | $P$ | case(s) | after |
|---|---|---|---|---|---|
| 1 | 5, 8 | $r\text{–}s$ | $1/8$ | parallel created (common neighbours $p$ and $q$) | $p\text{–}q,\ p\text{–}\{r,s\}\times2,\ p\text{–}t,\ q\text{–}\{r,s\}\times2,\ q\text{–}t$ ($m = 7$) |
| 2 | 4, 7 | $p\text{–}q$ | $1/7$ | parallel created (common neighbours $\{r,s\}$ and $t$) | $\{p,q\}\text{–}\{r,s\}\times4,\ \{p,q\}\text{–}t\times2$ ($m = 6$) |
| 3 | 3, 6 | $\{p,q\}\text{–}\{r,s\}$ | $4/6 = 2/3$ | self-loops removed (3 of them) | $\{p,q,r,s\}\text{–}t\times2$ ($m = 2$) |

It returns $\{t\} \mid \{p,q,r,s\}$ with value 2, so it **succeeds**. (There is no ordinary step: every edge of $H$ lies in a triangle.)

**3.** $P(\text{avoid}) = 1 - 2/m_i$: $\frac68, \frac57, \frac46$. The product is $\frac{5}{14} \approx 0.357$. The bound is $\frac{2}{5\cdot4} = \frac{1}{10}$.

**4.** For example $p\text{–}t$ ($1/8$; this contracts a cut edge, so the run fails here; common neighbour $q$ gives $\{p,t\}\text{–}q\times2$), then $r\text{–}s$ ($1/7$; gives $\{p,t\}\text{–}\{r,s\}\times2$, $q\text{–}\{r,s\}\times2$), then $\{p,t\}\text{–}q$ ($2/6$; one self-loop removed, and since $\{r,s\}$ is a common neighbour, $\{p,t\}\text{–}\{r,s\}\times2$ and $q\text{–}\{r,s\}\times2$ all become $\{p,q,t\}\text{–}\{r,s\}$, giving $\times4$; both self-loop and parallel cases at once). It returns $\{r,s\} \mid \{p,q,t\}$ with **value 4**.

**5.** $\dfrac{23}{70} \approx 0.329$ (DP, enumeration and Monte Carlo agree; $\ge 1/10$ ✓). By hand: in a random order of the 8 edges, the run succeeds iff the $K_4$ edges appearing before the **first** of $p\text{–}t, q\text{–}t$ already connect $\{p,q,r,s\}$. If exactly $j$ $K_4$-edges come first, the probability of that is $\frac{7-j}{28}$, and the $j$ edges connect $K_4$ with probability $\frac{16}{20}$ for $j = 3$ and $1$ for $j \ge 4$ ($K_4$ is 3-edge-connected). So $P = \frac{4}{28}\cdot\frac{16}{20} + \frac{3+2+1}{28} = \frac{23}{70}$.

</details>

