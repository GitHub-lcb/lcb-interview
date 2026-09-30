"""各玩法「至少中一注有奖」概率与返奖率对照。

奖金表来自中国福利彩票官网(cwl.gov.cn) 快乐8 奖金对照表；浮动奖取封顶值。
每注 2 元。选8/9/10 的「中0」返 2 元，等于退票（官方计为中奖），因此同时给出含/不含中0 两个口径。
"""
import io
import sys
from math import comb

sys.stdout = io.TextIOWrapper(open(sys.argv[1], "wb"), encoding="utf-8", newline="\n")

N, D, PRICE = 80, 20, 2.0

TIERS = {
    1: {1: 4.5},
    2: {2: 19},
    3: {3: 52, 2: 3},
    4: {4: 93, 3: 5, 2: 3},
    5: {5: 1000, 4: 20, 3: 3},
    6: {6: 2880, 5: 30, 4: 10, 3: 3},
    7: {7: 8500, 6: 300, 5: 30, 4: 4, 0: 2},
    8: {8: 50000, 7: 800, 6: 80, 5: 10, 4: 3, 0: 2},
    9: {9: 250000, 8: 2000, 7: 225, 6: 22, 5: 5, 4: 3, 0: 2},
    10: {10: 5000000, 9: 8000, 8: 720, 7: 80, 6: 5, 5: 3, 0: 2},
}


def pmf(k, h):
    if h < 0 or h > min(D, k) or (k - h) > (N - D):
        return 0.0
    return comb(D, h) * comb(N - D, k - h) / comb(N, k)


print("=== 单注（2 元）各玩法：中奖概率 vs 返奖率 ===")
print(f"{'玩法':>5} {'中奖档位':>22} {'含中0中奖率':>11} {'不含中0':>9} {'期望值(元)':>11} {'返奖率':>8}")
rows = []
for k in range(1, 11):
    tiers = TIERS[k]
    p_incl = sum(pmf(k, h) for h in tiers)
    p_excl = sum(pmf(k, h) for h in tiers if h > 0)
    ev = sum(pmf(k, h) * prize for h, prize in tiers.items())
    rows.append((k, p_incl, p_excl, ev))
    tier_text = "/".join(f"中{h}:{p:g}元" for h, p in sorted(tiers.items(), reverse=True))
    print(f"{'选'+str(k):>5} {tier_text:>22} {p_incl:>11.4%} {p_excl:>9.4%} {ev:>11.4f} {ev/PRICE:>8.2%}")

print()
print("=== 按「中奖率」排序（含中0口径）===")
for k, p_incl, p_excl, ev in sorted(rows, key=lambda r: -r[1]):
    print(f"  选{k}: {p_incl:.4%}")

print()
print("=== 按「不含中0的真实有奖」排序 ===")
for k, p_incl, p_excl, ev in sorted(rows, key=lambda r: -r[2]):
    print(f"  选{k}: {p_excl:.4%}")

print()
print("=== 按「返奖率」排序 ===")
for k, p_incl, p_excl, ev in sorted(rows, key=lambda r: -r[3]):
    print(f"  选{k}: {ev/PRICE:.2%}  (期望 {ev:.4f} 元，每注平均亏 {PRICE-ev:.4f} 元)")

print()
print("=== 若只追求『至少中一注』，选4 换选8 的代价 ===")
p4, p8 = rows[3][2], rows[7][2]
ev4, ev8 = rows[3][3], rows[7][3]
print(f"  选4 真实有奖率 {p4:.4%}，返奖率 {ev4/PRICE:.2%}")
print(f"  选8 真实有奖率 {p8:.4%}，返奖率 {ev8/PRICE:.2%}")
print(f"  中奖率提升 {(p8-p4)*100:+.2f} 个百分点，返奖率变化 {(ev8-ev4)/PRICE*100:+.2f} 个百分点")
