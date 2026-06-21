package com.lcbinterview.mapper;

import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.session.Configuration;
import org.apache.ibatis.scripting.xmltags.XMLLanguageDriver;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * 题目 Mapper SQL 注解测试，避免动态 SQL 的 XML 片段在应用启动时才暴露解析失败。
 */
class QuestionMapperSqlTest {

    private static final List<String> DYNAMIC_TAGS = List.of("<if ", "<choose>", "<foreach ");

    @Test
    void selectAnnotationsUseValidMybatisXmlScripts() {
        Arrays.stream(QuestionMapper.class.getDeclaredMethods())
                .filter(method -> method.isAnnotationPresent(Select.class))
                .forEach(this::assertValidSelectScript);
    }

    private void assertValidSelectScript(Method method) {
        String sql = String.join("\n", method.getAnnotation(Select.class).value()).trim();
        boolean hasDynamicTag = DYNAMIC_TAGS.stream().anyMatch(sql::contains);
        boolean hasScriptStart = sql.startsWith("<script>");
        boolean hasScriptEnd = sql.endsWith("</script>");

        if (hasDynamicTag) {
            assertThat(hasScriptStart)
                    .as("%s 包含 MyBatis 动态标签时必须以 <script> 开始", method.getName())
                    .isTrue();
            assertThat(hasScriptEnd)
                    .as("%s 包含 MyBatis 动态标签时必须以 </script> 结束", method.getName())
                    .isTrue();
        }

        if (hasScriptStart || hasScriptEnd) {
            assertThat(hasScriptStart)
                    .as("%s 的 <script> 标签必须成对出现", method.getName())
                    .isTrue();
            assertThat(hasScriptEnd)
                    .as("%s 的 <script> 标签必须成对出现", method.getName())
                    .isTrue();
            assertThatCode(() -> new XMLLanguageDriver()
                    .createSqlSource(new Configuration(), sql, Object.class))
                    .as("%s 的 MyBatis XML 脚本应能被解析", method.getName())
                    .doesNotThrowAnyException();
        }
    }
}
