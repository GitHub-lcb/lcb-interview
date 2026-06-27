package com.lcbinterview;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 应用主启动类。
 * @author chongan
 */
@SpringBootApplication
@EnableScheduling
public class LcbInterviewApplication {
    public static void main(String[] args) {
        SpringApplication.run(LcbInterviewApplication.class, args);
    }
}
