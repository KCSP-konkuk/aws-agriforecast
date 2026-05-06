package com.agriforecast.backend.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class NaverNewsItem {
    private String title;
    private String link;
    private String originallink;
    private String description;
    private String pubDate;
}
