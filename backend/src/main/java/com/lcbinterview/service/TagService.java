package com.lcbinterview.service;

import com.lcbinterview.dto.TagVO;
import com.lcbinterview.mapper.TagMapper;
import com.lcbinterview.model.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 标签 Service，负责标签查询和前端展示对象组装。
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TagService {

    private final TagMapper tagMapper;

    /**
     * 查询全部标签并转换为前端展示对象。
     *
     * @return 标签展示对象列表
     */
    public List<TagVO> getAllVos() {
        List<Tag> list = tagMapper.selectList(null);
        log.info("查询全部标签，共 {} 条", list.size());
        return list.stream().map(TagVO::from).toList();
    }
}
