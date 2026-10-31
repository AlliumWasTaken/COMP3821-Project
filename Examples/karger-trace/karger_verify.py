"""Verification code for the guided problem "Tracing Karger's algorithm".

Run:  python3 karger_verify.py            (all checks, prints a report)
      python3 karger_verify.py --write-spec  (also regenerates karger_trace_spec.json)

What it checks
  1. Brute-force minimum cut over all 2^(n-1) - 1 cuts (unique? value k?).
  2. Exact single-run success probability, computed two independent ways:
       (a) exhaustive enumeration of every sequence of edge copies,
       (b) dynamic programming over vertex partitions.
  3. Monte Carlo simulation (100,000 runs) with an independent implementation.
  4. Replays traces A and B step by step and checks every multigraph and
     every probability against karger_trace_spec.json.
  5. exact >= 2/(n(n-1)).

Model (matches the site's definitions): G/e merges the endpoints of e into one
composite vertex, keeps parallel edges, removes self-loops. Each step picks an
edge uniformly at random from the CURRENT multigraph, counting parallel copies
separately.
"""

import itertools
import json
import math
import random
import sys
from collections import Counter
from fractions import Fraction
from functools import lru_cache
from pathlib import Path

SPEC_PATH = Path(__file__).with_name("karger_trace_spec.json")

# ---------------------------------------------------------------------------
# Graphs
# ---------------------------------------------------------------------------

# Main problem graph G.  The letter e is skipped (e denotes an edge) and w is
# never used (w(.) denotes edge weight elsewhere on the site).
G_VERTICES = ["a", "b", "c", "d", "f", "g", "h"]
G_EDGES = [("a", "b"), ("a", "c"), ("a", "d"), ("b", "g"),
           ("b", "h"), ("c", "f"), ("d", "f"), ("g", "h")]

# Follow-up graph H (unguided exercise).
H_VERTICES = ["p", "q", "r", "s", "t"]
H_EDGES = [("p", "q"), ("p", "r"), ("p", "s"), ("q", "r"),
           ("q", "s"), ("r", "s"), ("p", "t"), ("q", "t")]

# Traces: each step names the two (possibly composite) endpoints of the edge
# to contract. If the edge has several parallel copies, any copy gives the
# same result, so the step's probability is multiplicity / (current m).
TRACE_A = [({"c"}, {"f"}),
           ({"b"}, {"h"}),
           ({"b", "h"}, {"g"}),
           ({"a"}, {"d"}),
           ({"a", "d"}, {"c", "f"})]

TRACE_B = [({"g"}, {"h"}),
           ({"a"}, {"b"}),
           ({"c"}, {"f"}),
           ({"c", "f"}, {"d"}),
           ({"a", "b"}, {"g", "h"})]

TRACE_H = [({"r"}, {"s"}),
           ({"p"}, {"q"}),
           ({"p", "q"}, {"r", "s"})]

TRACE_H_FAIL = [({"p"}, {"t"}),
                ({"r"}, {"s"}),
                ({"p", "t"}, {"q"})]


# ---------------------------------------------------------------------------
# Brute-force minimum cut
# ---------------------------------------------------------------------------

def cut_value(edges, side):
    return sum((u in side) != (v in side) for u, v in edges)


def all_cuts(vertices, edges):
    """Every cut {S, V\\S} exactly once: fix vertices[0] outside S, S nonempty.
    That gives 2^(n-1) - 1 cuts."""
    first, rest = vertices[0], vertices[1:]
    cuts = []
    for r in range(1, len(rest) + 1):
        for combo in itertools.combinations(rest, r):
            side = frozenset(combo)
            cuts.append((side, cut_value(edges, side)))
    assert len(cuts) == 2 ** (len(vertices) - 1) - 1
    return cuts


def brute_force_min_cut(vertices, edges):
    cuts = all_cuts(vertices, edges)
    k = min(val for _, val in cuts)
    minimum = [side for side, val in cuts if val == k]
    return k, minimum, cuts


# ---------------------------------------------------------------------------
# Multigraph representation shared by exact computation and trace replay.
#
# State = a partition of V into blocks (composite vertices).  Because every
# original edge keeps its identity through contractions, the current
# multigraph is exactly the set of ORIGINAL edges whose endpoints lie in
# different blocks; edges inside a block are the removed self-loops.
# ---------------------------------------------------------------------------

def block_of(partition, x):
    for blk in partition:
        if x in blk:
            return blk
    raise KeyError(x)


def live_edges(partition, edges):
    """Original edges that are not self-loops in the current multigraph."""
    return [(u, v) for u, v in edges
            if block_of(partition, u) != block_of(partition, v)]


def multigraph(partition, edges):
    """Counter {frozenset({X, Y}): multiplicity} over composite vertices."""
    return Counter(frozenset({block_of(partition, u), block_of(partition, v)})
                   for u, v in live_edges(partition, edges))


def contract(partition, X, Y):
    return frozenset([blk for blk in partition if blk not in (X, Y)] + [X | Y])


def final_cut(partition):
    """Canonical name of a 2-block partition: the side not containing the
    alphabetically first vertex."""
    first = min(min(blk) for blk in partition)
    return next(blk for blk in partition if first not in blk)


# ---------------------------------------------------------------------------
# Exact success probability
# ---------------------------------------------------------------------------

def exact_by_sequence_enumeration(vertices, edges, target):
    """Enumerate EVERY sequence of edge copies the algorithm could choose.
    Returns (P(success), number of sequences, number of successful ones)."""
    start = frozenset(frozenset([v]) for v in vertices)
    total_seq = 0
    good_seq = 0

    def rec(partition, prob):
        nonlocal total_seq, good_seq
        if len(partition) == 2:
            total_seq += 1
            ok = final_cut(partition) == target
            good_seq += ok
            return prob if ok else Fraction(0)
        live = live_edges(partition, edges)
        acc = Fraction(0)
        for u, v in live:  # one branch per edge copy
            nxt = contract(partition, block_of(partition, u), block_of(partition, v))
            acc += rec(nxt, prob / len(live))
        return acc

    p = rec(start, Fraction(1))
    return p, total_seq, good_seq


def exact_by_random_order(vertices, edges, target):
    """Third method: Karger == scan a uniformly random ORDER of the original
    edges, contracting each one unless it is already a self-loop, until two
    vertices remain. Enumerates all m! orders."""
    good = 0
    total = 0
    for order in itertools.permutations(edges):
        partition = frozenset(frozenset([v]) for v in vertices)
        for u, v in order:
            if len(partition) == 2:
                break
            X, Y = block_of(partition, u), block_of(partition, v)
            if X != Y:
                partition = contract(partition, X, Y)
        total += 1
        good += final_cut(partition) == target
    return Fraction(good, total)


def outcome_distribution_dp(vertices, edges):
    """DP over partitions: distribution of the returned cut (exact Fractions)."""
    start = frozenset(frozenset([v]) for v in vertices)

    @lru_cache(maxsize=None)
    def dist(partition):
        if len(partition) == 2:
            return ((final_cut(partition), Fraction(1)),)
        mg = multigraph(partition, edges)
        m = sum(mg.values())
        out = Counter()
        for pair, mult in mg.items():
            X, Y = tuple(pair)
            for cut, p in dist(contract(partition, X, Y)):
                out[cut] += Fraction(mult, m) * p
        return tuple(out.items())

    d = dict(dist(start))
    assert sum(d.values()) == 1
    return d, dist.cache_info().currsize


# ---------------------------------------------------------------------------
# Monte Carlo (independent implementation: union-find + rejection sampling).
# Drawing an original edge uniformly and redrawing when it is a self-loop is
# the same as drawing uniformly from the non-loop edges of the current
# multigraph, parallel copies counted separately.
# ---------------------------------------------------------------------------

def karger_once(vertices, edges, rng):
    parent = {v: v for v in vertices}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    components = len(vertices)
    while components > 2:
        u, v = rng.choice(edges)
        ru, rv = find(u), find(v)
        if ru == rv:
            continue  # self-loop: not an edge of the current multigraph
        parent[ru] = rv
        components -= 1
    root0 = find(vertices[0])
    return frozenset(x for x in vertices if find(x) != root0)


def monte_carlo(vertices, edges, target, runs, seed):
    rng = random.Random(seed)
    hits = sum(karger_once(vertices, edges, rng) == target for _ in range(runs))
    return hits / runs


# ---------------------------------------------------------------------------
# Trace replay
# ---------------------------------------------------------------------------

def fmt_block(blk):
    return "{" + ", ".join(sorted(blk)) + "}"


def fmt_frac(fr):
    return f"{fr.numerator}/{fr.denominator}"


def edge_record(pair, mult):
    X, Y = sorted(pair, key=lambda b: sorted(b))
    return {"u": sorted(X), "v": sorted(Y), "multiplicity": mult}


def multigraph_records(mg):
    recs = [edge_record(pair, mult) for pair, mult in mg.items()]
    return sorted(recs, key=lambda r: (r["u"], r["v"]))


def classify(mg, X, Y, nxt_mg):
    """Which contraction cases occur when contracting {X, Y}."""
    cases = []
    loops = mg[frozenset({X, Y})] - 1
    if loops:
        cases.append("self_loops_removed")
    # Parallel edges are created when X and Y share a neighbour Z: the edges
    # X-Z and Y-Z both become (X|Y)-Z.
    nbrs = lambda A: {B for pair in mg for B in pair if A in pair and B != A}
    common = (nbrs(X) & nbrs(Y)) - {X, Y}
    if common:
        cases.append("parallel_edges_created")
    if not cases:
        cases.append("ordinary")
    return cases, loops, sorted(common, key=sorted)


def replay(vertices, edges, trace, target):
    partition = frozenset(frozenset([v]) for v in vertices)
    steps = []
    p_avoid_product = Fraction(1)
    p_sequence = Fraction(1)
    doomed_at = None
    for i, (Xs, Ys) in enumerate(trace, start=1):
        X, Y = frozenset(Xs), frozenset(Ys)
        mg = multigraph(partition, edges)
        m, n = sum(mg.values()), len(partition)
        assert X in partition and Y in partition, (i, Xs, Ys)
        mult = mg[frozenset({X, Y})]
        assert mult >= 1, f"step {i}: {Xs}-{Ys} is not an edge"
        nxt = contract(partition, X, Y)
        nxt_mg = multigraph(nxt, edges)
        cases, loops, common = classify(mg, X, Y, nxt_mg)
        # Edges of the min cut still present in the current multigraph:
        cut_edges_now = sum(1 for u, v in live_edges(partition, edges)
                            if (u in target) != (v in target))
        crosses = (X <= target) != (Y <= target) if doomed_at is None else None
        if doomed_at is None:
            p_avoid = Fraction(m - cut_edges_now, m)
            p_avoid_product *= p_avoid
            if crosses:
                doomed_at = i
        else:
            p_avoid = None
        p_sequence *= Fraction(mult, m)
        steps.append({
            "step": i,
            "before": {"n": n, "m": m},
            "contract": {"u": sorted(X), "v": sorted(Y)},
            "multiplicity": mult,
            "probability": fmt_frac(Fraction(mult, m)),
            "probability_per_copy": fmt_frac(Fraction(1, m)),
            "contracts_min_cut_edge": bool(crosses) if crosses is not None else None,
            "p_avoid_min_cut_this_step": fmt_frac(p_avoid) if p_avoid is not None else None,
            "cases": cases,
            "self_loops_removed": loops,
            "parallel_created_via_common_neighbours": [sorted(b) for b in common],
            "new_vertex": sorted(X | Y),
            "after": {
                "n": len(nxt),
                "m": sum(nxt_mg.values()),
                "vertices": sorted([sorted(b) for b in nxt]),
                "edges": multigraph_records(nxt_mg),
            },
        })
        partition = nxt
    assert len(partition) == 2
    returned = final_cut(partition)
    value = cut_value(edges, returned)
    return {
        "steps": steps,
        "returned_cut": {"S": sorted(returned),
                         "V_minus_S": sorted(set(vertices) - returned),
                         "value": value},
        "success": returned == target,
        "min_cut_edge_contracted_at_step": doomed_at,
        "probability_of_this_exact_sequence": fmt_frac(p_sequence),
    }


def print_trace(name, vertices, edges, result):
    print(f"\n--- Trace {name} ---")
    for s in result["steps"]:
        print(f" step {s['step']}: n={s['before']['n']} m={s['before']['m']}  "
              f"contract {fmt_block(s['contract']['u'])}-{fmt_block(s['contract']['v'])}"
              f"  x{s['multiplicity']}  P={s['probability']}  cases={s['cases']}"
              f"  P(avoid)={s['p_avoid_min_cut_this_step']}")
        es = ", ".join(f"{fmt_block(e['u'])}{fmt_block(e['v'])}"
                       + (f" x{e['multiplicity']}" if e['multiplicity'] > 1 else "")
                       for e in s["after"]["edges"])
        print(f"          -> n={s['after']['n']} m={s['after']['m']}: {es}")
    rc = result["returned_cut"]
    print(f" returns {fmt_block(rc['S'])} | {fmt_block(rc['V_minus_S'])}, value {rc['value']}"
          f"; success={result['success']}; min-cut edge contracted at step "
          f"{result['min_cut_edge_contracted_at_step']}; "
          f"P(this exact sequence)={result['probability_of_this_exact_sequence']}")


# ---------------------------------------------------------------------------
# Main report
# ---------------------------------------------------------------------------

def analyse(name, vertices, edges, runs=100_000, seed=3821):
    n, m = len(vertices), len(edges)
    print(f"\n================ Graph {name}: n={n}, m={m} ================")
    k, minimum, cuts = brute_force_min_cut(vertices, edges)
    print(f"Brute force over {len(cuts)} cuts: k = {k}; minimum cuts = "
          + ", ".join(fmt_block(s) + " | " + fmt_block(set(vertices) - s) for s in minimum))
    hist = Counter(val for _, val in cuts)
    print("Cut-value histogram:", dict(sorted(hist.items())))
    assert len(minimum) == 1, "minimum cut must be unique"
    target = minimum[0]

    p_enum, nseq, ngood = exact_by_sequence_enumeration(vertices, edges, target)
    dist, nstates = outcome_distribution_dp(vertices, edges)
    p_dp = dist.get(target, Fraction(0))
    print(f"Exact (enumeration of {nseq} edge-copy sequences, {ngood} succeed): "
          f"{p_enum} = {float(p_enum):.6f}")
    print(f"Exact (DP over {nstates} partitions): {p_dp} = {float(p_dp):.6f}")
    assert p_enum == p_dp
    p_order = exact_by_random_order(vertices, edges, target)
    print(f"Exact (all {math.factorial(m)} random edge orders): {p_order}")
    assert p_order == p_dp

    bound = Fraction(2, n * (n - 1))
    print(f"Bound 2/(n(n-1)) = {bound} = {float(bound):.6f};  exact/bound = {float(p_dp / bound):.2f}")
    assert p_dp >= bound

    print("Distribution of the returned cut (exact):")
    for cut, p in sorted(dist.items(), key=lambda kv: (-kv[1], sorted(kv[0]))):
        print(f"   {fmt_block(cut):>14} | {fmt_block(set(vertices) - cut):<16}"
              f" value {cut_value(edges, cut)}   P = {fmt_frac(p):>10} = {float(p):.6f}")

    phat = monte_carlo(vertices, edges, target, runs, seed)
    se = math.sqrt(float(p_dp) * (1 - float(p_dp)) / runs)
    z = (phat - float(p_dp)) / se
    print(f"Monte Carlo ({runs} runs, seed {seed}): {phat:.5f}; "
          f"std. error {se:.5f}; z = {z:+.2f}")
    assert abs(z) < 4, "Monte Carlo disagrees with exact value"
    return target, p_dp, dist


def main():
    target_G, p_G, dist_G = analyse("G", G_VERTICES, G_EDGES)
    trace_a = replay(G_VERTICES, G_EDGES, TRACE_A, target_G)
    trace_b = replay(G_VERTICES, G_EDGES, TRACE_B, target_G)
    print_trace("A", G_VERTICES, G_EDGES, trace_a)
    print_trace("B", G_VERTICES, G_EDGES, trace_b)
    assert trace_a["success"] and not trace_b["success"]
    seen = {c for t in (trace_a, trace_b) for s in t["steps"] for c in s["cases"]}
    assert seen == {"ordinary", "parallel_edges_created", "self_loops_removed"}, seen

    target_H, p_H, _ = analyse("H (follow-up)", H_VERTICES, H_EDGES)
    trace_h = replay(H_VERTICES, H_EDGES, TRACE_H, target_H)
    print_trace("H", H_VERTICES, H_EDGES, trace_h)
    trace_h_fail = replay(H_VERTICES, H_EDGES, TRACE_H_FAIL, target_H)
    print_trace("H (failing example)", H_VERTICES, H_EDGES, trace_h_fail)
    assert trace_h["success"] and not trace_h_fail["success"]

    n = len(G_VERTICES)
    spec = {
        "title": "Tracing Karger's algorithm on G",
        "conventions": {
            "contraction": "G/e merges the endpoints of e into one composite vertex "
                           "(written as a sorted list of original vertices), keeps "
                           "parallel edges, removes self-loops.",
            "edge_choice": "uniform over the edges of the current multigraph, "
                           "parallel copies counted separately; 'probability' is "
                           "multiplicity/m (any copy of this pair), "
                           "'probability_per_copy' is 1/m.",
            "edges": "each edge is listed once with u < v (lexicographic on the "
                     "sorted vertex lists) and a multiplicity",
            "nulls": "once a min-cut edge has been contracted (trace B from that "
                     "step on), 'contracts_min_cut_edge' and "
                     "'p_avoid_min_cut_this_step' are null: the run is already "
                     "doomed, so these quantities no longer apply",
        },
        "graph": {
            "vertices": G_VERTICES,
            "edges": [list(e) for e in G_EDGES],
            "n": n,
            "m": len(G_EDGES),
        },
        "min_cut": {
            "S": sorted(target_G),
            "V_minus_S": sorted(set(G_VERTICES) - target_G),
            "k": cut_value(G_EDGES, target_G),
            "cut_edges": [list(e) for e in G_EDGES
                          if (e[0] in target_G) != (e[1] in target_G)],
            "unique": True,
        },
        "success_probability": {
            "exact": fmt_frac(p_G),
            "decimal": round(float(p_G), 6),
            "bound_2_over_n_n_minus_1": fmt_frac(Fraction(2, n * (n - 1))),
        },
        "trace_A": trace_a,
        "trace_B": trace_b,
    }

    if "--write-spec" in sys.argv:
        SPEC_PATH.write_text(json.dumps(spec, indent=2) + "\n")
        print(f"\nWrote {SPEC_PATH.name}")
    if SPEC_PATH.exists():
        on_disk = json.loads(SPEC_PATH.read_text())
        assert on_disk == json.loads(json.dumps(spec)), \
            f"{SPEC_PATH.name} does not match the replayed traces"
        print(f"\n{SPEC_PATH.name} matches the replayed traces.")
    print("\nALL CHECKS PASSED")


if __name__ == "__main__":
    main()
