package com.mysky.api.repository;

import com.mysky.api.entity.Post;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PostRepository extends JpaRepository<Post, Long> {
    
    Page<Post> findByAuthorId(Long authorId, Pageable pageable);
    
    Page<Post> findByCircleId(Long circleId, Pageable pageable);
    
    @Query("SELECT p FROM Post p JOIN p.tags t WHERE t = :tag")
    Page<Post> findByTag(@Param("tag") String tag, Pageable pageable);
    
    @Query("SELECT p FROM Post p WHERE p.author.id IN :followingIds OR p.author.id = :userId ORDER BY p.createdAt DESC")
    Page<Post> findFeed(@Param("userId") Long userId, @Param("followingIds") List<Long> followingIds, Pageable pageable);
    
    @Query("SELECT p FROM Post p LEFT JOIN p.likedBy l GROUP BY p ORDER BY COUNT(l) DESC, p.createdAt DESC")
    Page<Post> findPopularPosts(Pageable pageable);
    
    @Query("SELECT p FROM Post p WHERE " +
           "(6371 * acos(cos(radians(:latitude)) * cos(radians(p.latitude)) * " +
           "cos(radians(p.longitude) - radians(:longitude)) + " +
           "sin(radians(:latitude)) * sin(radians(p.latitude)))) < :distance " +
           "ORDER BY p.createdAt DESC")
    List<Post> findNearbyPosts(@Param("latitude") Double latitude, 
                               @Param("longitude") Double longitude, 
                               @Param("distance") Double distance);
}
