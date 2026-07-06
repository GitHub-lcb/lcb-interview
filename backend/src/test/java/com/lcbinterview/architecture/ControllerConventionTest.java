package com.lcbinterview.architecture;

import com.lcbinterview.controller.AuthController;
import com.lcbinterview.controller.CategoryController;
import com.lcbinterview.controller.InterviewCoachController;
import com.lcbinterview.controller.QuestionController;
import com.lcbinterview.controller.TagController;
import com.lcbinterview.controller.admin.AdminAuthController;
import com.lcbinterview.controller.admin.AdminDashboardController;
import com.lcbinterview.controller.admin.AiGenerationController;
import com.lcbinterview.controller.admin.QuestionAdminController;
import com.lcbinterview.controller.tools.LotteryKl8Controller;
import com.lcbinterview.controller.tools.ReadingToolController;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.annotation.Annotation;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.ParameterizedType;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Controller 编程规范测试，防止接口层重新承载 Mapper、Entity 和 Swagger 文档缺口。
 */
class ControllerConventionTest {

    private static final List<Class<?>> CONTROLLERS = List.of(
            AuthController.class,
            CategoryController.class,
            InterviewCoachController.class,
            QuestionController.class,
            TagController.class,
            AdminAuthController.class,
            AdminDashboardController.class,
            AiGenerationController.class,
            QuestionAdminController.class,
            LotteryKl8Controller.class,
            ReadingToolController.class
    );

    /**
     * Controller 不应直接依赖 Mapper，业务查询和写入需要收口到 Service。
     */
    @Test
    void controllersDoNotInjectMappersDirectly() {
        List<String> violations = new ArrayList<>();
        for (Class<?> controller : CONTROLLERS) {
            for (Field field : controller.getDeclaredFields()) {
                if (field.getType().getPackageName().startsWith("com.lcbinterview.mapper")) {
                    violations.add(controller.getSimpleName() + "." + field.getName());
                }
            }
        }

        assertThat(violations).isEmpty();
    }

    /**
     * 公开 API 返回 DTO/VO，避免数据库 Entity 字段成为前端接口契约。
     */
    @Test
    void controllersDoNotExposeModelEntitiesInReturnTypes() {
        List<String> violations = new ArrayList<>();
        for (Class<?> controller : CONTROLLERS) {
            for (Method method : controller.getDeclaredMethods()) {
                if (isEndpoint(method) && containsModelType(method.getGenericReturnType())) {
                    violations.add(controller.getSimpleName() + "." + method.getName());
                }
            }
        }

        assertThat(violations).isEmpty();
    }

    /**
     * 每个 Controller 和接口方法都维护 Swagger 说明，避免接口文档和实现漂移。
     */
    @Test
    void controllersKeepSwaggerTagsAndOperations() {
        List<String> violations = new ArrayList<>();
        for (Class<?> controller : CONTROLLERS) {
            if (controller.isAnnotationPresent(RestController.class) && !controller.isAnnotationPresent(Tag.class)) {
                violations.add(controller.getSimpleName() + " 缺少 @Tag");
            }
            for (Method method : controller.getDeclaredMethods()) {
                if (isEndpoint(method) && !method.isAnnotationPresent(Operation.class)) {
                    violations.add(controller.getSimpleName() + "." + method.getName() + " 缺少 @Operation");
                }
            }
        }

        assertThat(violations).isEmpty();
    }

    private boolean isEndpoint(Method method) {
        return hasAnnotation(method, GetMapping.class)
                || hasAnnotation(method, PostMapping.class)
                || hasAnnotation(method, PutMapping.class)
                || hasAnnotation(method, DeleteMapping.class)
                || hasAnnotation(method, PatchMapping.class)
                || hasAnnotation(method, RequestMapping.class);
    }

    private boolean hasAnnotation(Method method, Class<? extends Annotation> annotationType) {
        return method.isAnnotationPresent(annotationType);
    }

    private boolean containsModelType(Type type) {
        if (type instanceof Class<?> clazz) {
            return clazz.getPackageName().startsWith("com.lcbinterview.model");
        }
        if (type instanceof ParameterizedType parameterizedType) {
            if (containsModelType(parameterizedType.getRawType())) {
                return true;
            }
            for (Type actualType : parameterizedType.getActualTypeArguments()) {
                if (containsModelType(actualType)) {
                    return true;
                }
            }
        }
        return false;
    }
}
