package com.lcbinterview.service;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Jev 提示词渲染测试。
 * 重点验证两件事：规则是否被显式声明（而不是只给品牌名），
 * 以及语言切换是否只作用于送模型的文本。
 */
class JevPromptRendererTest {

    @Test
    void rulesAreStatedExplicitlyInChinese() {
        JevPromptRenderer renderer = new JevPromptRenderer(JevPromptLocale.ZH);

        String game = renderer.gameName();
        String playMode = renderer.playMode(4);

        // 必须写出号码范围与每期开出数量，不能只给「快乐8」这个名称
        assertTrue(game.contains("1 到 80"), "必须声明号码范围，实际：" + game);
        assertTrue(game.contains("20"), "必须声明每期开出数量，实际：" + game);
        assertTrue(game.contains("独立"), "必须声明开奖相互独立，实际：" + game);
        // 玩法要补出中奖门槛，避免把「选4」读成动词短语
        assertTrue(playMode.contains("选4"), "必须点明玩法，实际：" + playMode);
        assertTrue(playMode.contains("命中 2 个及以上"), "必须声明中奖门槛，实际：" + playMode);
    }

    @Test
    void rulesAreStatedExplicitlyInEnglish() {
        JevPromptRenderer renderer = new JevPromptRenderer(JevPromptLocale.EN);

        String game = renderer.gameName();
        String playMode = renderer.playMode(4);

        assertTrue(game.contains("1 to 80"), "英文同样必须声明号码范围，实际：" + game);
        assertTrue(game.contains("20 numbers"), "英文同样必须声明开出数量，实际：" + game);
        assertTrue(playMode.contains("pick 4"), "英文同样必须声明玩法，实际：" + playMode);
        assertTrue(playMode.contains("at least 2"), "英文同样必须声明中奖门槛，实际：" + playMode);
        assertFalse(game.matches(".*[\\u4e00-\\u9fa5].*"), "英文模式下不应残留中文，实际：" + game);
        assertFalse(playMode.matches(".*[\\u4e00-\\u9fa5].*"), "英文模式下不应残留中文，实际：" + playMode);
    }

    @Test
    void numberQuestionCarriesBaselineCriteria() {
        JevPromptRenderer renderer = new JevPromptRenderer(JevPromptLocale.ZH);

        Map<String, String> criteria = renderer.numberCriteria();

        assertEquals(2, criteria.size());
        assertTrue(criteria.containsKey("true"));
        assertTrue(criteria.containsKey("false"));
        // 理论基率要写进边界说明，给模型一个明确锚点
        assertTrue(criteria.get("true").contains("0.25"), "true 分支应写明基率，实际：" + criteria.get("true"));
        assertTrue(criteria.get("false").contains("0.75"), "false 分支应写明互补基率，实际：" + criteria.get("false"));
        assertTrue(renderer.numberInstruction(37).contains("37"), "指令必须点名具体号码");
    }

    @Test
    void scoreLevelsStayOrderedAndConsistentAcrossLocales() {
        JevPromptRenderer zh = new JevPromptRenderer(JevPromptLocale.ZH);
        JevPromptRenderer en = new JevPromptRenderer(JevPromptLocale.EN);

        // 档位顺序即语义，两种语言下数量必须一致
        assertEquals(5, zh.riskLevels().size());
        assertEquals(5, en.riskLevels().size());
        assertEquals(zh.riskLevels().size(), en.riskLevels().size());
    }

    @Test
    void userFacingLabelIsAlwaysChinese() {
        JevPromptRenderer english = new JevPromptRenderer(JevPromptLocale.EN);

        // 提示词切英文，但接口文案必须保持中文，避免前端文案随配置漂移
        String label = english.userFacingRiskLabel(1.6);

        assertTrue(label.contains("结构"), "用户可见档位必须取中文，实际：" + label);
        assertEquals("结构一般：存在可察觉的区间或奇偶集中", label);
        // 越界位置要夹到边界，不能抛异常
        assertEquals(english.userFacingRiskLevels().get(0), english.userFacingRiskLabel(-3));
        assertEquals(english.userFacingRiskLevels().get(4), english.userFacingRiskLabel(9));
    }

    @Test
    void tagsAndProfilesAreTranslatedOnlyInEnglishMode() {
        JevPromptRenderer zh = new JevPromptRenderer(JevPromptLocale.ZH);
        JevPromptRenderer en = new JevPromptRenderer(JevPromptLocale.EN);

        assertEquals("热号", zh.tag("热号"));
        assertEquals("hot", en.tag("热号"));
        assertEquals("high-missing-pressure", en.tag("遗漏压力高"));
        assertEquals("balanced", en.weightProfileName("均衡"));
        assertEquals("time-decay", en.factorName("时间衰减"));

        // 特征层新增标签时应原样保留，不能丢内容
        assertEquals("新标签", en.tag("新标签"));
        assertEquals("新权重", en.weightProfileName("新权重"));
        assertFalse(zh.dropChineseProse());
        assertTrue(en.dropChineseProse());
    }

    @Test
    void localeParsingFallsBackToChinese() {
        assertEquals(JevPromptLocale.EN, JevPromptLocale.parse("en"));
        assertEquals(JevPromptLocale.EN, JevPromptLocale.parse(" EN "));
        assertEquals(JevPromptLocale.ZH, JevPromptLocale.parse("zh"));
        // 配置写错不应导致调用失败，回退中文即可
        assertEquals(JevPromptLocale.ZH, JevPromptLocale.parse("fr"));
        assertEquals(JevPromptLocale.ZH, JevPromptLocale.parse(null));
        assertEquals("en", new JevPromptRenderer(JevPromptLocale.EN).localeCode());
        // 传 null 按中文处理，避免空指针
        assertEquals("zh", new JevPromptRenderer(null).localeCode());
    }

    @Test
    void noRenderedTextLeavesUnsubstitutedFormatSpecifiers() {
        // 回归防线：.formatted() 的优先级高于字符串拼接，
        // 多段拼接时若忘记加括号，只有最后一段会被格式化，
        // 前一段的 %d 会原样送进提示词。这里遍历两种语言的全部文案堵住这个坑。
        for (JevPromptLocale locale : JevPromptLocale.values()) {
            JevPromptRenderer renderer = new JevPromptRenderer(locale);
            assertFalse(renderer.schemaNote().contains("%"), locale + " schemaNote 残留占位符");
            assertFalse(renderer.gameName().contains("%"), locale + " gameName 残留占位符");
            assertFalse(renderer.playMode(4).contains("%"), locale + " playMode 残留占位符");
            assertFalse(renderer.numberInstruction(37).contains("%"), locale + " numberInstruction 残留占位符");
            assertFalse(renderer.riskInstruction(4).contains("%"), locale + " riskInstruction 残留占位符");
            for (Map.Entry<String, String> entry : renderer.numberCriteria().entrySet()) {
                assertFalse(entry.getValue().contains("%"),
                        locale + " numberCriteria." + entry.getKey() + " 残留占位符：" + entry.getValue());
            }
            for (String level : renderer.riskLevels()) {
                assertFalse(level.contains("%"), locale + " 档位文字残留占位符：" + level);
            }
        }
    }

    @Test
    void englishGameNameReportsCorrectDrawnCount() {
        // 号码范围与开出数量是两个不同的数字，曾经因为拼接优先级被写反，
        // 这里单独钉住，避免「每期开出 80 个」这类错误悄悄进提示词
        String game = new JevPromptRenderer(JevPromptLocale.EN).gameName();

        assertTrue(game.contains("1 to 80"), "号码范围应为 1 到 80，实际：" + game);
        assertTrue(game.contains("exactly 20 numbers"), "每期应开出 20 个，实际：" + game);
    }
}
