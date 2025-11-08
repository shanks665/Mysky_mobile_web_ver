package com.mysky.api.repository;

import com.mysky.api.entity.Circle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CircleRepository extends JpaRepository<Circle, Long> {
    
    List<Circle> findByCategory(String category);
    
    List<Circle> findByNameContainingIgnoreCase(String name);
    
    List<Circle> findByCreatorId(Long creatorId);
    
    @Query("SELECT c FROM Circle c JOIN c.members m WHERE m.id = :userId")
    List<Circle> findByMemberId(@Param("userId") Long userId);
    
    @Query("SELECT c FROM Circle c WHERE " +
           "(6371 * acos(cos(radians(:latitude)) * cos(radians(c.latitude)) * " +
           "cos(radians(c.longitude) - radians(:longitude)) + " +
           "sin(radians(:latitude)) * sin(radians(c.latitude)))) < :distance")
    List<Circle> findNearbyCircles(@Param("latitude") Double latitude, 
                                   @Param("longitude") Double longitude, 
                                   @Param("distance") Double distance);
}
