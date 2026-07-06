package com.lcbinterview.architecture;

import com.lcbinterview.service.AiQuestionService;
import com.lcbinterview.service.BatchFillAnswerRunner;
import com.lcbinterview.service.BatchGenerationRunner;
import jakarta.annotation.PreDestroy;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 异步执行器生命周期规范测试，避免服务内自建线程池在应用关闭后残留。
 */
class AsyncExecutorLifecycleTest {

    private static final List<Class<?>> SERVICES_WITH_BACKGROUND_EXECUTORS = List.of(
            AiQuestionService.class,
            BatchGenerationRunner.class,
            BatchFillAnswerRunner.class
    );

    /**
     * 服务类持有 ExecutorService 字段时，必须提供 @PreDestroy 清理入口。
     */
    @Test
    void servicesWithExecutorFieldsDeclarePreDestroyCleanup() {
        List<String> violations = new ArrayList<>();
        for (Class<?> service : SERVICES_WITH_BACKGROUND_EXECUTORS) {
            if (hasExecutorField(service) && !hasPreDestroyMethod(service)) {
                violations.add(service.getSimpleName());
            }
        }

        assertThat(violations).isEmpty();
    }

    private boolean hasExecutorField(Class<?> service) {
        for (Field field : service.getDeclaredFields()) {
            if (ExecutorService.class.isAssignableFrom(field.getType())) {
                return true;
            }
        }
        return false;
    }

    private boolean hasPreDestroyMethod(Class<?> service) {
        for (Method method : service.getDeclaredMethods()) {
            if (method.isAnnotationPresent(PreDestroy.class)) {
                return true;
            }
        }
        return false;
    }
}
