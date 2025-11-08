package com.mysky.api.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDto {
    private Long id;
    private String email;
    private String username;
    private String displayName;
    private String bio;
    private String profileImageUrl;
    private LocalDate dateOfBirth;
    private Double latitude;
    private Double longitude;
    private String location;
    private String privacyLevel;
    private Integer followersCount;
    private Integer followingCount;
    private LocalDateTime createdAt;
}
