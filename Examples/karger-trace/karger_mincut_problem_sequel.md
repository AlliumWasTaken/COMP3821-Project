# Guided Problem on amplifying Karger’s success probability through independent repetitions

Read this after *Guided Problem: Tracing Karger's Algorithm by Hand*. Its §5.4 asks how many times we must rerun the contraction algorithm to make the final answer reliable.

> **What you will be able to do after this problem**
>
> 1. Trace which cut is kept across several complete runs and prove when that rule succeeds.
> 2. Derive the probability of failure after independent runs and explain what happens when the same randomness is reused.
> 3. Find the least number of runs for a given failure target when the single-run success probability is known.
> 4. Give a sufficient number of runs when only the number of vertices is known.

**Notation.** A *run* starts from the original graph and contracts edges until two blocks of original vertices remain. The cut size is the number of original edges crossing between the blocks, counting parallel copies separately. For a connected, undirected, unweighted graph $J$ with $n\ge 2$ vertices, write $k$ for the global minimum cut size and $p$ for the probability that one run returns a cut of size $k$. Let $T\ge 1$ be an integer number of runs and $0<\delta<1$ the largest acceptable probability of final failure.

---

## 1. The problem

Use the same graph $G$ as in the tracing problem. Call the cuts returned by Trace A and Trace B **A** and **B**, respectively. Cut A is the unique minimum cut, with size $1$ and crossing edge $a\text{–}b$. Cut B has size $2$. The exact probability that one full run on $G$ returns a minimum cut is $p_G=9/28$ (tracing problem, §§2–4 and §5.2).

In the first problem, each contraction changed the graph for the next step. Here, each completed run gives us one candidate cut, and a new run starts again on the original graph.

**Questions.**

1. **(Choosing the output)** Suppose three complete runs on $G$ return B, A, B in that order. Using the returned cuts and their sizes, give a rule for which cut to keep after each run. Apply it to this sequence. Then prove for any input $J$ that the rule returns a global minimum cut if and only if some run does.
2. **(Independent runs and a replay)** Use the shuffled-edge description from the tracing problem's §5.2. Compare two runs on $G$ with independently shuffled edge orders to two runs that use the same randomly shuffled order. In each case, identify the event that makes the final cut fail and give its probability. Extend the independent case to $T$ runs on $J$.
3. **(Exact run count)** Use the known $p_G$ and the exact failure probability from Question 2 to find the least positive integer $T$ that gives failure probability at most $\delta$ on $G$. Prove minimality and state the corresponding rule for a graph with known $p$.
4. **(A guarantee from $n$)** Suppose $p$ is unknown. You know that on an $n$-vertex graph, one run returns any *fixed* minimum cut with probability at least $p_0=2/[n(n-1)]$. Use this bound to give a sufficient integer $T$ in terms of $n$ and $\delta$. Explain why it gives a guarantee even when the exact run count is unknown.

---

## 2. Worked selection: keep the smallest cut seen

Keep the first cut. After each later run, retain the smaller of its cut and the cut already kept. Either cut can be kept in a tie. The repeated contraction algorithm restarts from the original graph with independent randomness on each run. See [Karger and Stein, §4, opening paragraph][karger-stein] and [Yu, §2][yu].

| Completed run | Returned cut on $G$ | Returned size | Cut kept so far |
|---:|:---:|---:|:---:|
| 1 | B | 2 | B |
| 2 | A | 1 | A |
| 3 | B | 2 | A |

> ### ✅ Checkpoint 1: what if two cuts tie?
>
> Suppose two runs return different partitions with the same cut size. Can choosing one over the other change whether the selected cut is a global minimum cut?
>
> <details><summary>Hint</summary>
>
> What property of a cut determines whether it is minimum?
>
> </details>
>
> <details><summary>Model answer</summary>
>
> Two valid cuts with the same size have the same status. If their size is $k$, both are global minimum cuts. If their size exceeds $k$, neither is.
>
> </details>

**Why the rule works.** The two blocks left by a run partition the original vertices. The edges still crossing between those blocks are exactly the original edges crossing that partition. Thus each run returns a valid cut of the original graph. This correspondence is described in [Karger and Stein, §2, pp. 609–610][karger-stein].

Let $X_i$ be the size returned by run $i$. Each $X_i\ge k$, and the size kept after $T$ runs is $\widehat{k}_T=\min_{1\le i\le T}X_i$. If any run returns size $k$, then $\widehat{k}_T=k$. Conversely, the minimum of a finite list is attained by an entry, so $\widehat{k}_T=k$ implies that some $X_i=k$. Therefore

$$
\{\widehat{k}_T=k\}=\bigcup_{i=1}^{T}\{X_i=k\}.
$$

The rule compares cut sizes to one another. The true size $k$ serves as the benchmark in the proof.

## 3. Worked comparison: fresh randomness and a replay

Write $F_i=\{X_i>k\}$ for failure of run $i$. By §2, the retained cut after two runs fails exactly when both runs fail. On $G$, each individual run has failure probability $q_G=1-p_G$ in either setup in Question 2.

> ### ✅ Checkpoint 2: what changes when we replay an edge order?
>
> In both setups the first run fails with probability $q_G$. Given that it fails, what is the probability that the second run fails in each setup?
>
> <details><summary>Hint</summary>
>
> For a fixed input, a fixed edge order determines the sequence of contractions and the final cut.
>
> </details>
>
> <details><summary>Model answer</summary>
>
> With independent orders, the second run still fails with probability $q_G$ after observing the first failure. With a replay, the second run returns the first run's cut, so it fails with conditional probability $1$.
>
> </details>

The two-run failure probability is $P(F_1\cap F_2)=P(F_1)P(F_2\mid F_1)$. The two setups give different values for the second factor.

| How the two runs on $G$ are made | Event of final failure | Probability |
|---|---|---|
| Draw two edge orders independently. | $F_1\cap F_2$, with independent $F_1$ and $F_2$. | $q_G^2$ |
| Draw one edge order and use it twice. | $F_1\cap F_2=F_1$, since the outputs coincide. | $q_G$ |

The replay comparison uses the random edge-order interpretation in [Karger, §2][karger-1993] and the tracing problem's §5.2.

**Extend to $T$ independent runs.** On the same input $J$, each run has failure probability $1-p$. The failure event of a run is determined by its own random choices. Independent random choices across runs therefore make $F_1,\ldots,F_T$ mutually independent. Taking the complement of the success event in §2 gives

$$
P(\widehat{k}_T>k)=P\!\left(\bigcap_{i=1}^{T}F_i\right)
=\prod_{i=1}^{T}P(F_i)=(1-p)^T.
$$

Hence the exact success probability is $1-(1-p)^T$. For $G$ it is $1-(1-9/28)^T$. When $0<p<1$, each additional independent run multiplies the remaining failure probability by $1-p$, which is strictly between zero and one. This is the amplification step in [Canonne, Algorithm 11 and its analysis, p. 63][canonne].

## 4. Worked derivation: find the least number of runs on $G$

To achieve failure probability at most $\delta$ on $G$, the exact condition from §3 is $q_G^T\le\delta$.

> ### ✅ Checkpoint 3: which way does the inequality go?
>
> Taking logarithms gives $T\ln q_G\le\ln\delta$. What is the sign of $\ln q_G$? After dividing, is the condition a lower or an upper bound on $T$?
>
> <details><summary>Hint</summary>
>
> Compare $q_G$ to $1$ and use $\ln 1=0$.
>
> </details>
>
> <details><summary>Model answer</summary>
>
> Since $0<q_G<1$, $\ln q_G<0$. Dividing by it reverses the inequality, so $T$ must be at least $\ln\delta/\ln q_G$.
>
> </details>

The logarithm is strictly increasing and the last division is reversible. Thus the target holds exactly when $T\ge\ln(1/\delta)/[-\ln q_G]$. This bound is positive, so the least positive integer satisfying it is

$$
T_{\min}(G,\delta)=\left\lceil\frac{\ln(1/\delta)}{-\ln(1-9/28)}\right\rceil.
$$

Every smaller positive integer lies below the real threshold and has failure probability greater than $\delta$. The same argument on a graph with known $0<p<1$ gives

$$
T_{\min}(p,\delta)=\left\lceil\frac{\ln(1/\delta)}{-\ln(1-p)}\right\rceil.
$$

When $p=1$, one run suffices. These least-count formulas follow by solving the exact failure condition from [Canonne's analysis of Algorithm 11][canonne].

## 5. Worked derivation: guarantee success from the graph size

The one-run probability of returning a particular minimum cut is at least $p_0=1/\binom n2=2/[n(n-1)]$. This is the bound in the tracing problem's §5.3. See [Karger and Stein, Theorem 2.2][karger-stein] and [Yu, Theorem 3][yu].

> ### ✅ Checkpoint 4: a fixed minimum cut and any minimum cut
>
> Fix one minimum cut $C^\star$. Which event contains the other: returning $C^\star$, or returning a global minimum cut? What does that tell us about $p$?
>
> <details><summary>Hint</summary>
>
> A graph may have several distinct cuts of size $k$.
>
> </details>
>
> <details><summary>Model answer</summary>
>
> Returning $C^\star$ is one way to return a global minimum cut. The first event is contained in the second, so $p\ge P(C^\star\text{ is returned})\ge p_0$.
>
> </details>

Apply $p\ge p_0$ to the exact failure identity from §3. The exponential function lies above its tangent at zero, so $1-x\le e^{-x}$. Together with $0\le 1-p\le 1-p_0$, this gives

$$
P(\widehat{k}_T>k)=(1-p)^T\le(1-p_0)^T\le e^{-p_0 T}.
$$

This is the same chain of bounds used in [Canonne, p. 63][canonne]. Requiring $e^{-p_0T}\le\delta$ gives $p_0T\ge\ln(1/\delta)$. Consequently a sufficient count is

$$
T_{\exp}(n,\delta)=\left\lceil\binom n2\ln\frac{1}{\delta}\right\rceil.
$$

For $n\ge 3$ we may also solve $(1-p_0)^T\le\delta$ directly, using the logarithm step in §4. This gives another sufficient count

$$
T_{\mathrm{pow}}(n,\delta)=\left\lceil\frac{\ln(1/\delta)}{-\ln(1-p_0)}\right\rceil.
$$

For $n=2$ the bound forces $p=1$, and one run suffices. For larger graphs both counts certify the target using only $n$ and $\delta$. The graph's actual least count depends on $p$. For example, with $\delta=n^{-c}$ for a fixed $c>0$, the exponential certificate uses $O(n^2\ln n)$ runs, the regime in [Karger, Corollary 2.1][karger-1993].

---

## 6. Unguided follow-up (try it yourself)

Return to the graph $H$ from the tracing problem's §6. Write $n_H=|V(H)|$, $p_H$ for the exact single-run success probability, and $p_0=1/\binom{n_H}{2}$. Use the symbolic relation $0<p_0\le p_H<1$ and an arbitrary target $0<\delta<1$.

1. Prove that $T_{\min}(p_H,\delta)\le T_{\mathrm{pow}}(n_H,\delta)\le T_{\exp}(n_H,\delta)$.
2. Explain which of the three counts you could justify if you knew only $n_H$ and $\delta$. Explain why all three counts meet the target on $H$ even when they differ.

Try the proof before opening the appendix.

## 7. Sources

1. D. R. Karger and C. Stein. [*A New Approach to the Minimum Cut Problem*][karger-stein]. *Journal of the ACM* 43(4), 601–640, 1996. DOI: 10.1145/234533.234534. Section 2 describes the cut returned by a complete run. Theorem 2.2 gives the bound for a fixed minimum cut. The opening of §4 explains why returning the smallest cut from repeated runs fails only when all runs fail.
2. H. Yu. [*COS 521: Advanced Algorithm Design, Lecture 1: Karger's Min Cut Algorithm*][yu]. Princeton University, Fall 2025. Section 2 specifies independent restarts and the choice of the smallest returned cut. Theorem 3 states the single-run bound.
3. C. Canonne. [*Randomised and Advanced Algorithms, Lecture 5: Graph Algorithms*][canonne]. COMP4270/COMP5270, University of Sydney. Algorithm 11 and its analysis on p. 63 give the exact all-failure probability, its exponential upper bound, and a sufficient repetition count for a target failure probability.
4. D. R. Karger. [*Global Min-Cuts in RNC, and Other Ramifications of a Simple Min-Cut Algorithm*][karger-1993]. SODA, 21–30, 1993. Section 2 of the author manuscript gives the random edge-order interpretation and Corollary 2.1 on independent repetitions.
5. *Guided Problem: Tracing Karger's Algorithm by Hand*. Companion problem for the specific inputs $G$ and $H$, the outputs of Trace A and Trace B, and the exact value $p_G=9/28$.

<!-- Companion JSON reference reserved here for the probability-amplification guided problem. -->

---

## Appendix: answers to the unguided follow-up

<details><summary>Show proof</summary>

From $p_H\ge p_0$, we get $1-p_H\le 1-p_0$, hence $-\ln(1-p_H)\ge -\ln(1-p_0)$. Also, $1-p_0\le e^{-p_0}$ gives $-\ln(1-p_0)\ge p_0$. The three denominators are positive, so dividing the same positive numerator $\ln(1/\delta)$ by them reverses their order. The ceiling function preserves the resulting inequalities. Thus

$$
T_{\min}(p_H,\delta)\le T_{\mathrm{pow}}(n_H,\delta)\le T_{\exp}(n_H,\delta).
$$

The two sufficient counts depend only on $n_H$ and $\delta$. The least count formula uses $p_H$. That least count meets the target by the exact identity in §3, and the other counts meet it by the bounds in §5.

</details>

[karger-stein]: https://courses.cs.washington.edu/courses/cse525/13sp/slides/KargerStein.pdf
[yu]: https://www.cs.princeton.edu/~hy2/teaching/fall25-cos521/notes/mincut.pdf
[canonne]: https://ccanonne.github.io/files/compx270-chap5.pdf
[karger-1993]: https://people.csail.mit.edu/karger/Papers/mincut.pdf
