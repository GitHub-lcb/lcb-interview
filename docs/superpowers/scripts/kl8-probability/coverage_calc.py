import io
import sys
from math import comb

sys.stdout = io.TextIOWrapper(open(sys.argv[1], "wb") if len(sys.argv) > 1 else sys.stdout.buffer,
                              encoding="utf-8", newline="\n")

N, D, PICK = 80, 20, 4


def hyper_pmf(k, N, K, n):
    """从 N 个中抽 n 个，其中 K 个是"命中集合"，恰好命中 k 个的概率。"""
    if k < 0 or k > min(K, n) or (n - k) < 0 or (n - k) > (N - K):
        return 0.0
    return comb(K, k) * comb(N - K, n - k) / comb(N, n)


def p_no_block_at_least(m, t):
    """m 注互不重复（覆盖 4m 个号），没有任何一注命中 >= t 个的概率。
    条件在覆盖集内命中数 K 上：G(x) = (sum_{i<t} C(4,i) x^i)^m，则 P(no|K)=[x^K]G / C(4m,K)。
    该式只依赖 m，与"哪 4 个号凑一组"无关——这是 80 选 20 的对称性决定的。
    """
    cov = PICK * m
    base = [comb(PICK, i) for i in range(t)]
    poly = [1]
    for _ in range(m):
        new = [0] * (len(poly) + len(base) - 1)
        for a, ca in enumerate(poly):
            for b, cb in enumerate(base):
                new[a + b] += ca * cb
        poly = new
    total = 0.0
    for k in range(0, min(D, cov) + 1):
        pk = hyper_pmf(k, N, D, cov)
        if pk == 0:
            continue
        coef = poly[k] if k < len(poly) else 0
        denom = comb(cov, k)
        total += pk * (coef / denom if denom else 0.0)
    return total


print("=== 单注选4 命中分布（超几何，任何选号策略都改不了）===")
cum = 0.0
for h in range(PICK, -1, -1):
    p = hyper_pmf(h, N, D, PICK)
    cum += p
    print(f"中{h}个: {p:.6%}   至少中{h}个: {cum:.6%}")
print(f"期望命中: {PICK * D / N:.4f} 个")

print()
print("=== M 注互不重复：至少有一注达标 ===")
print(f"{'注数M':>5} {'覆盖号数':>8} {'成本(元)':>8} {'≥中2':>9} {'≥中3':>9} {'中4':>10}")
for m in [1, 2, 3, 4, 5, 6, 8, 10, 15, 16, 20]:
    if PICK * m > N:
        continue
    p2 = 1 - p_no_block_at_least(m, 2)
    p3 = 1 - p_no_block_at_least(m, 3)
    p4 = 1 - p_no_block_at_least(m, 4)
    print(f"{m:>5} {PICK*m:>8} {2*m:>8} {p2:>9.4%} {p3:>9.4%} {p4:>10.5%}")

print()
print("=== 达到目标『至少中一注≥2』所需注数（不重复，2元/注）===")
for target in [0.3, 0.4, 0.5, 0.6, 0.8, 0.95]:
    m = 1
    while PICK * m <= N:
        if 1 - p_no_block_at_least(m, 2) >= target:
            break
        m += 1
    print(f"目标 {target:.0%} -> {m} 注（{PICK*m} 个号，{2*m} 元），实测 {1 - p_no_block_at_least(m, 2):.4%}")

print()
print("=== 各玩法『全中』概率（选k 全中）===")
for k in range(1, 11):
    print(f"选{k}: 全中 {comb(D, k) / comb(N, k):.8%}")

print()
print("=== 校验：单注 M=1 应等于 25.87% / 4.63% / 0.31% ===")
print(f"M=1 ≥2: {1 - p_no_block_at_least(1, 2):.6%}")
print(f"M=1 ≥3: {1 - p_no_block_at_least(1, 3):.6%}")
print(f"M=1 =4: {1 - p_no_block_at_least(1, 4):.6%}")
