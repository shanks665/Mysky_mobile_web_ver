package com.mysky.api.repository;

import com.mysky.api.entity.Event;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface EventRepository extends JpaRepository<Event, Long> {
    
    List<Event> findByCategory(String category);
    
    List<Event> findByCircleId(Long circleId);
    
    List<Event> findByCreatorId(Long creatorId);
    
    List<Event> findByStatus(Event.EventStatus status);
    
    List<Event> findByStartTimeAfter(LocalDateTime startTime);
    
    @Query("SELECT e FROM Event e WHERE e.startTime >= :now AND e.status = 'UPCOMING' ORDER BY e.startTime ASC")
    List<Event> findUpcomingEvents(@Param("now") LocalDateTime now);
    
    @Query("SELECT e FROM Event e WHERE " +
           "(6371 * acos(cos(radians(:latitude)) * cos(radians(e.latitude)) * " +
           "cos(radians(e.longitude) - radians(:longitude)) + " +
           "sin(radians(:latitude)) * sin(radians(e.latitude)))) < :distance")
    List<Event> findNearbyEvents(@Param("latitude") Double latitude, 
                                 @Param("longitude") Double longitude, 
                                 @Param("distance") Double distance);
}
