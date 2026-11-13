"""Verification data for Problem 2, Karger probability amplification.

Run:  python3 karger_amplification.py
          prints a report and checks karger_amplification_data.json
      python3 karger_amplification.py --write-spec
          also regenerates karger_amplification_data.json

Place this script beside Austin's karger_verify.py. It reuses his graph,
minimum-cut and exact-probability functions, and his karger_once sampler.
Only the Python standard library and karger_verify.py are required.

The exact single-run probability is inherited from the tracing problem and
checked with Austin's DP. For each T, exact failure is (1-p)^T and the
general upper bound is (1-2/(n(n-1)))^T.

Monte Carlo uses 100,000 independent trials and seed 3821, matching Austin's
sample-size and seed conventions. Each trial contains 20 complete runs on
the original G, retaining the minimum cut size after each run. Different T
share trial prefixes, while trials for any fixed T are independent.

Checks
  1. The minimum cut and exact single-run probability on G.
  2. Exact failure probabilities and the general upper bound.
  3. Monte Carlo failure frequencies against the exact probabilities.
  4. Nonincreasing prefix failure counts.
  5. Saved JSON against regenerated data.
"""

import json
import math
import random
import sys
from fractions import Fraction
from pathlib import Path

from karger_verify import (
    G_EDGES,
    G_VERTICES,
    brute_force_min_cut,
    cut_value,
    fmt_frac,
    karger_once,
    outcome_distribution_dp,
)

SPEC_PATH = Path(__file__).with_name("karger_amplification_data.json")


# ---------------------------------------------------------------------------
# Monte Carlo: repeat complete runs and keep the smallest cut size.
# ---------------------------------------------------------------------------

def monte_carlo_amplification(vertices, edges, k, trials, max_repetitions, seed):
    """Return the number of failed trials at T = 1, ..., max_repetitions.

    Every call to karger_once starts from the original graph. The RNG
    advances across calls, as in Austin's monte_carlo function.
    """
    if trials < 1 or max_repetitions < 1:
        raise ValueError("trials and max_repetitions must be positive")
    rng = random.Random(seed)
    failed_trials = [0] * max_repetitions
    for _ in range(trials):
        best_value = len(edges) + 1
        for index in range(max_repetitions):
            returned_cut = karger_once(vertices, edges, rng)
            value = cut_value(edges, returned_cut)
            assert value >= k, "A returned cut is smaller than the minimum"
            best_value = min(best_value, value)
            if best_value > k:
                failed_trials[index] += 1
    assert all(a >= b for a, b in zip(failed_trials, failed_trials[1:])), \
        "Keeping the best cut must make failure counts nonincreasing"
    return failed_trials


# ---------------------------------------------------------------------------
# Main report: exact probabilities, Monte Carlo and JSON generation.
# ---------------------------------------------------------------------------

def analyse(name, vertices, edges, trials=100_000, max_repetitions=20, seed=3821):
    n, m = len(vertices), len(edges)
    print(f"\n================ Graph {name}: n={n}, m={m} ================")
    k, minimum, _ = brute_force_min_cut(vertices, edges)
    assert len(minimum) == 1, "The guided-problem graph has a unique minimum cut"
    target = minimum[0]
    distribution, states = outcome_distribution_dp(vertices, edges)
    p = distribution.get(target, Fraction(0))
    bound = Fraction(2, n * (n - 1))
    assert 0 < bound <= p < 1
    print(f"Minimum cut: k={k}; exact single-run success {p} "
          f"(DP over {states} partitions)")
    print(f"{trials:,} trials, {max_repetitions} runs per trial, seed {seed}")

    failures = monte_carlo_amplification(
        vertices, edges, k, trials, max_repetitions, seed
    )
    points = []
    print(f"{'T':>3} {'exact failure':>15} {'failed trials':>15} "
          f"{'MC frequency':>15} {'upper bound':>15} {'z':>9}")
    for repetitions, failed in enumerate(failures, start=1):
        theory = (1 - p) ** repetitions
        upper = (1 - bound) ** repetitions
        empirical = failed / trials
        assert 0 <= failed <= trials
        assert theory <= upper
        standard_error = math.sqrt(float(theory) * (1 - float(theory)) / trials)
        z = (empirical - float(theory)) / standard_error
        print(f"{repetitions:3d} {float(theory):15.8f} "
              f"{failed:15d} {empirical:15.8f} {float(upper):15.8f} {z:+9.2f}")
        assert abs(z) < 4, \
            f"Monte Carlo disagrees with the exact probability at T={repetitions}"
        points.append({
            "repetitions": repetitions,
            "theory_failure": float(theory),
            "theory_failure_exact": fmt_frac(theory),
            "failed_trials": failed,
            "empirical_failure": empirical,
            "failure_upper_bound": float(upper),
            "failure_upper_bound_exact": fmt_frac(upper),
        })
    print("z is the deviation divided by the theoretical standard error, "
          "as in karger_verify.py.")
    return target, p, points


def main():
    trials, max_repetitions, seed = 100_000, 20, 3821
    target, p, points = analyse(
        "G", G_VERTICES, G_EDGES, trials, max_repetitions, seed
    )
    n = len(G_VERTICES)
    spec = {
        "title": "Amplifying Karger's success probability on G",
        "conventions": {
            "contraction": "G/e merges the endpoints of e into one composite "
                           "vertex, keeps parallel edges, removes self-loops.",
            "edge_choice": "uniform over the edges of the current multigraph, "
                           "parallel copies counted separately.",
            "run": "One complete call to karger_verify.karger_once, starting "
                   "from the original graph with fresh random choices.",
            "trial": "A sequence of independent complete runs. At repetition "
                     "T, retain the smallest cut among its first T runs.",
            "failure": "The retained cut has size greater than min_cut.k.",
            "sampling": "A random.Random(seed) stream advances across all "
                        "runs. Trials at a fixed T are independent. Points "
                        "at different T share trial prefixes.",
            "probabilities": "Numeric probabilities lie in [0, 1]. Fields "
                             "ending in _exact contain fraction strings.",
            "theory_failure": "Exact failure probability (1-p)^T, where p "
                              "is success_probability.exact.",
            "empirical_failure": "failed_trials / experiment.trials.",
            "failure_upper_bound": "General upper bound (1-p0)^T, with "
                                   "p0 = 2/(n(n-1)).",
        },
        "graph": {
            "vertices": G_VERTICES,
            "edges": [list(edge) for edge in G_EDGES],
            "n": n,
            "m": len(G_EDGES),
        },
        "min_cut": {
            "S": sorted(target),
            "V_minus_S": sorted(set(G_VERTICES) - target),
            "k": cut_value(G_EDGES, target),
            "cut_edges": [list(edge) for edge in G_EDGES
                          if (edge[0] in target) != (edge[1] in target)],
            "unique": True,
        },
        "success_probability": {
            "exact": fmt_frac(p),
            "decimal": round(float(p), 6),
            "bound_2_over_n_n_minus_1": fmt_frac(Fraction(2, n * (n - 1))),
        },
        "experiment": {
            "trials": trials,
            "seed": seed,
            "max_repetitions": max_repetitions,
            "total_karger_runs": trials * max_repetitions,
        },
        "points": points,
    }

    if "--write-spec" in sys.argv:
        SPEC_PATH.write_text(
            json.dumps(spec, indent=2, allow_nan=False) + "\n", encoding="utf-8"
        )
        print(f"\nWrote {SPEC_PATH.name}")
    if SPEC_PATH.exists():
        on_disk = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
        assert on_disk == json.loads(json.dumps(spec)), \
            f"{SPEC_PATH.name} does not match the regenerated data"
        print(f"\n{SPEC_PATH.name} matches the regenerated data.")
    print("\nALL CHECKS PASSED")


if __name__ == "__main__":
    main()
