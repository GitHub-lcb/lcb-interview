"""检测号码级物理偏差所需样本量（α=0.05 双侧，效能 80%）。"""
import io
import sys

sys.stdout = io.TextIOWrapper(open(sys.argv[1], "wb"), encoding="utf-8", newline="\n")

Z_A = 1.959963985
Z_B = 0.8416212336


def required(base, lift):
    t = min(0.999999, base + lift)
    term = Z_A * (base * (1 - base)) ** 0.5 + Z_B * (t * (1 - t)) ** 0.5
    return int(-(-((term / lift) ** 2) // 1))


print("基线 = 0.25（单号每期开出概率）")
for lift in (0.01, 0.005, 0.002, 0.001):
    n = required(0.25, lift)
    print(f"  检出 +{lift*100:.1f} 个百分点偏差 -> 需要 {n:,} 期；按每天 1 期 ≈ {n/365:.1f} 年")

print()
print("参照：快乐8 自 2020-10-28 上市，至今约 2150 期（每天 1 期）。")
