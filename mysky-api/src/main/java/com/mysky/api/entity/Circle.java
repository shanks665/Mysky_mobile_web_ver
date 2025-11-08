package com.mysky.api.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "circles")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Circle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(length = 1000)
    private String description;

    private String category;
    private String imageUrl;

    private Double latitude;
    private Double longitude;
    private String location;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "creator_id", nullable = false)
    private User creator;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private PrivacyLevel privacyLevel = PrivacyLevel.PUBLIC;

    @ManyToMany
    @JoinTable(
        name = "circle_members",
        joinColumns = @JoinColumn(name = "circle_id"),
        inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    @Builder.Default
    private Set<User> members = new HashSet<>();

    @ManyToMany
    @JoinTable(
        name = "circle_admins",
        joinColumns = @JoinColumn(name = "circle_id"),
        inverseJoinColumns = @JoinColumn(name = "user_id")
    )
    @Builder.Default
    private Set<User> admins = new HashSet<>();

    @ElementCollection
    @CollectionTable(name = "circle_join_requests", joinColumns = @JoinColumn(name = "circle_id"))
    @Column(name = "user_id")
    @Builder.Default
    private Set<Long> joinRequests = new HashSet<>();

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public enum PrivacyLevel {
        PUBLIC, PRIVATE, SECRET
    }
}
