package com.lcbinterview.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lcbinterview.dto.BatchProgressVO;
import com.lcbinterview.dto.GenerationRequest;
import com.lcbinterview.mapper.QuestionMapper;
import com.lcbinterview.model.Category;
import com.lcbinterview.mapper.CategoryMapper;
import com.lcbinterview.model.Question;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 批量题目生成器。遍历所有分类，调用 AI 服务批量生成面试题目。
 * 支持分类级别的 topic 提示、难度分布控制、API 调用间隔控制。
 * @author chongan
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BatchGenerationRunner {

    private final CategoryMapper categoryMapper;
    private final QuestionMapper questionMapper;
    private final AiQuestionService aiQuestionService;

    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicReference<BatchProgressVO> progress = new AtomicReference<>(
            new BatchProgressVO("IDLE", 0, 0, 0, 0, 0, null, null, List.of()));
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    /** 分类 → 生成主题提示词映射 */
    private static final Map<String, String> CATEGORY_TOPICS = new LinkedHashMap<>();

    static {
        CATEGORY_TOPICS.put("Java 基础", "数据类型、String、面向对象、异常处理、反射、注解、泛型、IO/NIO、Java 8+ 新特性（Lambda、Stream、Optional）");
        CATEGORY_TOPICS.put("Java 集合", "ArrayList、LinkedList、HashMap、ConcurrentHashMap、HashSet、TreeMap、LinkedHashMap、集合扩容机制、线程安全集合");
        CATEGORY_TOPICS.put("Java 并发", "线程创建、线程池、synchronized、ReentrantLock、volatile、CAS、AQS、CountDownLatch、CompletableFuture、ThreadLocal");
        CATEGORY_TOPICS.put("JVM", "内存区域、垃圾回收算法、垃圾回收器（G1/ZGC）、类加载机制、双亲委派、JVM 调优、内存泄漏排查、JIT 编译");
        CATEGORY_TOPICS.put("MySQL", "B+Tree 索引、事务 ACID、隔离级别、MVCC、锁机制、SQL 优化、执行计划、分库分表、主从复制、binlog");
        CATEGORY_TOPICS.put("Redis", "五大数据类型、持久化（RDB/AOF）、缓存穿透/击穿/雪崩、分布式锁、集群模式、哨兵、淘汰策略、Pipeline、Lua 脚本");
        CATEGORY_TOPICS.put("MongoDB", "文档模型、BSON、CRUD、聚合管道、索引设计、分片、复制集、事务、与 MySQL 对比");
        CATEGORY_TOPICS.put("Spring", "IoC 容器、Bean 生命周期、AOP 原理、事务传播机制、循环依赖、Spring MVC 流程、拦截器、异常处理");
        CATEGORY_TOPICS.put("SpringBoot", "自动配置原理、Starter 机制、条件注解、Actuator 监控、嵌入式 Tomcat、配置加载顺序、全局异常处理");
        CATEGORY_TOPICS.put("SpringCloud", "Eureka/Nacos 注册中心、Gateway 网关、OpenFeign 调用、Sentinel 熔断限流、Config 配置中心、Sleuth 链路追踪");
        CATEGORY_TOPICS.put("MyBatis", "SQL 映射、动态 SQL、一级/二级缓存、延迟加载、插件开发、分页、#{}与${}区别、与 Spring 集成");
        CATEGORY_TOPICS.put("Netty", "Reactor 线程模型、NIO、Channel/Pipeline、EventLoop、心跳检测、粘包拆包、零拷贝、Netty 高性能原因");
        CATEGORY_TOPICS.put("计算机网络", "TCP 三次握手/四次挥手、HTTP/HTTPS、HTTP/2、DNS 解析、Cookie/Session/JWT、CDN、跨域、网络分层模型");
        CATEGORY_TOPICS.put("操作系统", "进程与线程、进程调度、内存管理、虚拟内存、死锁、文件系统、Linux 进程间通信、用户态与内核态");
        CATEGORY_TOPICS.put("算法与数据结构", "排序算法、二分查找、链表操作、树的遍历、动态规划、贪心、回溯、BFS/DFS、时间空间复杂度分析");
        CATEGORY_TOPICS.put("设计模式", "单例、工厂、策略、观察者、代理、模板方法、适配器、装饰器、责任链、设计原则（SOLID）");
        CATEGORY_TOPICS.put("消息队列", "消息可靠性、消息幂等性、消息积压、顺序消息、分布式事务、Kafka vs RabbitMQ vs RocketMQ 对比");
        CATEGORY_TOPICS.put("RabbitMQ", "交换机类型、消息确认、持久化、死信队列、延迟队列、高可用镜像队列、Spring AMQP 集成");
        CATEGORY_TOPICS.put("Kafka", "分区与副本、消费者组、高吞吐原因、Exactly-Once 语义、ISR 机制、Leader 选举、Spring Kafka 集成");
        CATEGORY_TOPICS.put("Nginx", "反向代理、负载均衡策略、事件驱动模型、动静分离、SSL 配置、限流、跨域配置、高可用");
        CATEGORY_TOPICS.put("Docker 与 K8s", "Dockerfile、镜像分层、容器网络、数据卷、K8s Pod/Service/Deployment、ConfigMap、HPA、滚动更新");
        CATEGORY_TOPICS.put("Git", "分支模型、merge vs rebase、Git Flow、cherry-pick、stash、reset vs revert、冲突解决、Git 钩子");
        CATEGORY_TOPICS.put("Linux", "常用命令、文件权限、进程管理、Shell 脚本、日志排查、top/vmstat/netstat、cron 定时任务、systemd");
        CATEGORY_TOPICS.put("后端系统设计", "高并发架构、分布式缓存、分库分表、CAP/BASE、一致性算法、限流熔断、消息队列削峰、读写分离");
        CATEGORY_TOPICS.put("后端场景题", "秒杀系统设计、短链接服务、订单超时取消、支付回调、接口幂等性、分布式 ID 生成、扫码登录、feed 流");
        CATEGORY_TOPICS.put("Dubbo", "服务注册发现、负载均衡策略、SPI 扩展、服务降级、集群容错、调用链路、与 SpringCloud 对比");
        CATEGORY_TOPICS.put("Elasticsearch", "倒排索引、分词器、Mapping 设计、聚合查询、集群架构、分片与副本、性能调优、与 MySQL 数据同步");
        CATEGORY_TOPICS.put("DevOps", "CI/CD 流水线、Jenkins/GitHub Actions、Docker 构建部署、监控告警（Prometheus+Grafana）、日志收集（ELK）");
        CATEGORY_TOPICS.put("HR 面试", "自我介绍、职业规划、项目亮点、团队协作、压力管理、离职原因、薪资谈判、对公司了解");
    }

    /** 已有足够种子题目的分类 ID（跳过） */
    private static final Set<String> SKIP_CATEGORIES = Set.of();

    /**
     * 启动批量生成任务（异步执行）。
     *
     * @param countPerCategory 每个分类生成数量
     * @param categoryName     指定分类名称，null 则生成所有
     * @param delaySeconds     API 调用间隔秒数
     * @return 任务是否成功启动
     */
    public boolean start(int countPerCategory, String categoryName, int delaySeconds) {
        if (!running.compareAndSet(false, true)) {
            log.warn("批量生成任务已在运行中");
            return false;
        }

        executor.submit(() -> {
            try {
                runBatch(countPerCategory, categoryName, delaySeconds);
            } catch (Exception e) {
                log.error("批量生成任务异常", e);
            } finally {
                running.set(false);
                progress.set(new BatchProgressVO("IDLE", 0, 0, 0, 0, 0, null, null, List.of()));
            }
        });
        return true;
    }

    /**
     * 查询当前进度。
     */
    public BatchProgressVO getProgress() {
        return progress.get();
    }

    private void runBatch(int countPerCategory, String categoryName, int delaySeconds) {
        log.info("===== 批量生成任务启动: countPerCategory={}, delay={}s =====", countPerCategory, delaySeconds);

        List<Category> categories;
        if (categoryName != null && !categoryName.isBlank()) {
            categories = categoryMapper.selectList(
                    new LambdaQueryWrapper<Category>()
                            .like(Category::getName, categoryName)
                            .orderByAsc(Category::getSortOrder));
        } else {
            categories = categoryMapper.selectList(
                    new LambdaQueryWrapper<Category>().orderByAsc(Category::getSortOrder));
        }

        log.info("待生成分类数: {}", categories.size());

        int totalSuccess = 0;
        int totalFail = 0;
        int totalToGenerate = 0;
        List<String> errorList = new ArrayList<>();

        // 先估算总题数
        for (Category cat : categories) {
            if (SKIP_CATEGORIES.contains(cat.getName())) { continue; }
            long existing = questionMapper.selectCount(
                    new LambdaQueryWrapper<Question>()
                            .eq(Question::getCategoryId, cat.getId())
                            .eq(Question::getStatus, "PUBLISHED"));
            if (existing < countPerCategory) {
                totalToGenerate += (int) (countPerCategory - existing);
            }
        }

        progress.set(new BatchProgressVO("RUNNING",
                categories.size(), 0, totalToGenerate, 0, 0, null, "准备中...", List.of()));

        int completedCategories = 0;
        for (int i = 0; i < categories.size(); i++) {
            Category cat = categories.get(i);

            if (SKIP_CATEGORIES.contains(cat.getName())) {
                log.info("[{}/{}] 跳过已有题目的分类: {}", i + 1, categories.size(), cat.getName());
                continue;
            }

            long existingCount = questionMapper.selectCount(
                    new LambdaQueryWrapper<Question>()
                            .eq(Question::getCategoryId, cat.getId())
                            .eq(Question::getStatus, "PUBLISHED"));

            if (existingCount >= countPerCategory) {
                log.info("[{}/{}] 分类 '{}' 已有 {} 道题，跳过",
                        i + 1, categories.size(), cat.getName(), existingCount);
                continue;
            }

            int toGenerate = (int) (countPerCategory - existingCount);
            log.info("[{}/{}] 开始生成分类 '{}': 已有 {} 道，需生成 {} 道",
                    i + 1, categories.size(), cat.getName(), existingCount, toGenerate);

            progress.set(new BatchProgressVO("RUNNING",
                    categories.size(), completedCategories, totalToGenerate, totalSuccess, totalFail,
                    cat.getName(), "调用 AI 生成中...", List.copyOf(errorList)));

            try {
                String topic = CATEGORY_TOPICS.getOrDefault(cat.getName(), cat.getDescription());
                String difficulty = pickDifficulty(i);

                GenerationRequest req = new GenerationRequest(
                        cat.getName(), difficulty, toGenerate, topic);

                List<Long> ids = aiQuestionService.generateSync(req, cat.getId());
                totalSuccess += ids.size();
                completedCategories++;
                log.info("[{}/{}] 分类 '{}' 生成完成: {} 道",
                        i + 1, categories.size(), cat.getName(), ids.size());

            } catch (Exception e) {
                log.error("[{}/{}] 分类 '{}' 生成失败", i + 1, categories.size(), cat.getName(), e);
                totalFail++;
                completedCategories++;
                errorList.add(cat.getName() + ": " + e.getMessage());
            }

            progress.set(new BatchProgressVO("RUNNING",
                    categories.size(), completedCategories, totalToGenerate, totalSuccess, totalFail,
                    null, "已完成 " + completedCategories + "/" + categories.size() + " 个分类",
                    List.copyOf(errorList)));

            if (i < categories.size() - 1 && delaySeconds > 0) {
                try {
                    progress.set(new BatchProgressVO("RUNNING",
                            categories.size(), completedCategories, totalToGenerate, totalSuccess, totalFail,
                            null, "等待 " + delaySeconds + "s 后继续...", List.copyOf(errorList)));
                    log.info("等待 {}s 后继续...", delaySeconds);
                    Thread.sleep(delaySeconds * 1000L);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    log.warn("批量任务被中断");
                    break;
                }
            }
        }

        log.info("===== 批量生成任务完成: 成功 {} 道, 失败 {} 个分类 =====", totalSuccess, totalFail);
        if (!errorList.isEmpty()) {
            log.warn("失败分类: {}", errorList);
        }
    }

    /**
     * 按分类序号轮换难度，保证每个分类都有混合难度。
     */
    private String pickDifficulty(int index) {
        return switch (index % 3) {
            case 0 -> "MEDIUM";
            case 1 -> "EASY";
            case 2 -> "HARD";
            default -> "MEDIUM";
        };
    }
}
