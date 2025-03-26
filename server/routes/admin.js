import express from 'express';
import { auth } from '../middleware/auth.js';
import { db } from '../db.js';

const router = express.Router();

// Add this middleware at the top of the file
const checkAdminRole = async (req, res, next) => {
    try {
        const [users] = await db.execute(
            'SELECT role FROM users WHERE id = ?',
            [req.user.id]
        );

        if (users.length === 0 || users[0].role !== 'admin') {
            return res.status(403).json({ 
                success: false, 
                message: 'Admin access required' 
            });
        }
        next();
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Apply checkAdminRole to all routes
router.use(checkAdminRole);

// Add stats endpoint first
router.get('/stats', async (req, res) => {
    try {
        console.log('Fetching admin stats...');
        const currentDate = new Date().toISOString().split('T')[0];

        // Get tee times stats with real-time availability
        const [[teeTimes]] = await db.execute(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN available = true THEN 1 ELSE 0 END) as available,
                COUNT(CASE WHEN date = CURDATE() THEN 1 END) as today_total,
                SUM(CASE WHEN available = true AND date = CURDATE() THEN 1 ELSE 0 END) as today_available
            FROM tee_times 
            WHERE date >= CURDATE()
        `);

        // Get real-time course utilization
        const [courseUtilization] = await db.execute(`
            SELECT 
                c.name,
                COUNT(DISTINCT b.id) as bookings,
                COUNT(DISTINCT CASE WHEN b.booking_date >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN b.id END) as recent_bookings
            FROM courses c
            LEFT JOIN tee_times t ON c.id = t.course_id
            LEFT JOIN bookings b ON t.id = b.tee_time_id
            WHERE t.date >= CURDATE()
            GROUP BY c.id, c.name
            ORDER BY bookings DESC
        `);

        // Get weekly booking trends with hourly data for today
        const [weeklyBookings] = await db.execute(`
            SELECT 
                DATE(t.date) as date,
                COUNT(b.id) as count,
                SUM(CASE WHEN DATE(t.date) = CURDATE() THEN 1 ELSE 0 END) as today_count,
                HOUR(b.booking_date) as hour
            FROM tee_times t
            LEFT JOIN bookings b ON t.id = b.tee_time_id
            WHERE t.date BETWEEN DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND CURDATE()
            GROUP BY DATE(t.date), HOUR(b.booking_date)
            ORDER BY date, hour
        `);

        // Get recent activity with status
        const [recentActivity] = await db.execute(`
            SELECT 
                b.id,
                u.name as user_name,
                c.name as course_name,
                b.players,
                b.booking_date,
                t.date as play_date,
                t.time as play_time,
                t.available,
                TIMESTAMPDIFF(MINUTE, b.booking_date, NOW()) as minutes_ago
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            JOIN tee_times t ON b.tee_time_id = t.id
            JOIN courses c ON t.course_id = c.id
            WHERE b.booking_date >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ORDER BY b.booking_date DESC
            LIMIT 10
        `);

        // Get peak hours analysis
        const [peakHours] = await db.execute(`
            SELECT 
                CASE 
                    WHEN HOUR(time) BETWEEN 6 AND 11 THEN 'Morning'
                    WHEN HOUR(time) BETWEEN 12 AND 16 THEN 'Afternoon'
                    ELSE 'Evening'
                END as time_slot,
                COUNT(*) as slot_count,
                COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as booking_percentage
            FROM tee_times t
            JOIN bookings b ON t.id = b.tee_time_id
            WHERE DATE(b.booking_date) = CURDATE()
            GROUP BY 
                CASE 
                    WHEN HOUR(time) BETWEEN 6 AND 11 THEN 'Morning'
                    WHEN HOUR(time) BETWEEN 12 AND 16 THEN 'Afternoon'
                    ELSE 'Evening'
                END
        `);

        // Get hourly booking distribution
        const [hourlyDistribution] = await db.execute(`
            SELECT 
                HOUR(time) as hour,
                COUNT(*) as count
            FROM tee_times t
            JOIN bookings b ON t.id = b.tee_time_id
            WHERE DATE(b.booking_date) = CURDATE()
            GROUP BY HOUR(time)
            ORDER BY hour
        `);

        // Get player group distribution
        const [playerDistribution] = await db.execute(`
            SELECT 
                players,
                COUNT(*) as count
            FROM bookings
            WHERE DATE(booking_date) = CURDATE()
            GROUP BY players
            ORDER BY players
        `);

        console.log('Stats data:', { 
            teeTimes, 
            courseUtilizationCount: courseUtilization.length,
            weeklyBookingsCount: weeklyBookings.length,
            recentActivityCount: recentActivity.length 
        });

        res.json({
            success: true,
            stats: {
                teeTimes: {
                    total: teeTimes.total || 0,
                    available: teeTimes.available || 0,
                    today: {
                        total: teeTimes.today_total || 0,
                        available: teeTimes.today_available || 0
                    }
                },
                courseUtilization: courseUtilization.map(course => ({
                    name: course.name,
                    bookings: parseInt(course.bookings) || 0,
                    recentBookings: parseInt(course.recent_bookings) || 0
                })),
                weeklyBookings: weeklyBookings.map(day => ({
                    date: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }),
                    count: parseInt(day.count) || 0,
                    todayCount: parseInt(day.today_count) || 0,
                    hour: day.hour
                })),
                recentActivity: recentActivity.map(booking => ({
                    ...booking,
                    minutesAgo: booking.minutes_ago
                })),
                peakHours: peakHours.map(slot => Math.round(slot.booking_percentage)),
                hourlyDistribution: Array.from({ length: 24 }, (_, i) => {
                    const hour = hourlyDistribution.find(h => h.hour === i);
                    return hour ? hour.count : 0;
                }),
                playerGroups: Array.from({ length: 4 }, (_, i) => {
                    const group = playerDistribution.find(p => p.players === i + 1);
                    return group ? group.count : 0;
                })
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard data: ' + error.message
        });
    }
});

// Create a new course
router.post('/courses', auth, async (req, res) => {
    try {
        const { 
            name, description, holes, location, facilities, 
            difficulty_level, caddie_required, golf_cart_available, 
            club_rental_available 
        } = req.body;

        // Validate difficulty level
        if (!['beginner', 'intermediate', 'advanced'].includes(difficulty_level)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid difficulty level' 
            });
        }

        const [result] = await db.execute(
            `INSERT INTO courses (
                name, description, holes, location, facilities,
                difficulty_level, caddie_required, golf_cart_available,
                club_rental_available
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, description, holes, location, facilities,
             difficulty_level, Boolean(caddie_required), 
             Boolean(golf_cart_available), Boolean(club_rental_available)]
        );

        res.json({ 
            success: true, 
            courseId: result.insertId,
            message: 'Course created successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Course Management
router.get('/courses', auth, async (req, res) => {
    try {
        const [courses] = await db.execute('SELECT * FROM courses');
        res.json({ success: true, courses });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/courses/:id', auth, async (req, res) => {
    try {
        // Add created_at and updated_at to the response
        const [courses] = await db.execute(`
            SELECT id, name, description, holes, location, facilities,
                   difficulty_level, caddie_required, golf_cart_available,
                   club_rental_available, created_at, updated_at 
            FROM courses 
            WHERE id = ?`, 
            [req.params.id]
        );
        if (courses.length === 0) {
            return res.status(404).json({ success: false, message: 'Course not found' });
        }
        res.json({ success: true, course: courses[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/courses/:id', auth, async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();
        
        // Start transaction
        await connection.beginTransaction();

        const [existingCourse] = await connection.execute(
            'SELECT id FROM courses WHERE id = ?',
            [req.params.id]
        );

        if (existingCourse.length === 0) {
            await connection.rollback();
            return res.status(404).json({ 
                success: false, 
                message: 'Course not found' 
            });
        }

        const { 
            name, description, holes, location, facilities,
            difficulty_level, caddie_required, golf_cart_available,
            club_rental_available 
        } = req.body;

        // Update course with BOOLEAN values
        await connection.execute(
            `UPDATE courses SET 
                name = ?, 
                description = ?, 
                holes = ?, 
                location = ?,
                facilities = ?, 
                difficulty_level = ?, 
                caddie_required = CAST(? AS UNSIGNED), 
                golf_cart_available = CAST(? AS UNSIGNED), 
                club_rental_available = CAST(? AS UNSIGNED)
            WHERE id = ?`,
            [
                name, 
                description, 
                holes, 
                location, 
                facilities,
                difficulty_level, 
                caddie_required, 
                golf_cart_available,
                club_rental_available, 
                req.params.id
            ]
        );

        // Get updated course data
        const [updatedCourse] = await connection.execute(
            'SELECT * FROM courses WHERE id = ?',
            [req.params.id]
        );

        await connection.commit();

        res.json({ 
            success: true, 
            message: 'Course updated successfully',
            course: updatedCourse[0]
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error updating course:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Error updating course'
        });
    } finally {
        if (connection) connection.release();
    }
});

router.delete('/courses/:id', auth, async (req, res) => {
    try {
        await db.execute('DELETE FROM courses WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Course deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Create multiple tee times
router.post('/tee-times/bulk', auth, async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        const { courseId, date, startTime, endTime, interval, maxPlayers, specialNotes } = req.body;
        
        // Validate required fields
        if (!courseId || !date || !startTime || !endTime || !interval) {
            return res.status(400).json({
                success: false,
                message: 'Required fields missing'
            });
        }

        // Convert times to minutes
        const start = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
        const end = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);
        
        if (start >= end) {
            return res.status(400).json({
                success: false,
                message: 'End time must be after start time'
            });
        }

        let currentTime = start;
        let createdCount = 0;

        // Generate time slots
        while (currentTime <= end) {
            const hours = Math.floor(currentTime / 60);
            const minutes = currentTime % 60;
            const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
            
            // Check for existing slots
            const [existing] = await connection.execute(
                'SELECT id FROM tee_times WHERE course_id = ? AND date = ? AND time = ?',
                [courseId, date, timeString]
            );

            if (existing.length === 0) {
                const query = `
                    INSERT INTO tee_times 
                    (course_id, date, time, available, max_players, special_notes) 
                    VALUES 
                    (?, ?, ?, 1, ?, ?)
                `;

                await connection.execute(query, [
                    courseId,
                    date,
                    timeString,
                    maxPlayers || 4,
                    specialNotes || null
                ]);
                
                createdCount++;
            }
            
            currentTime += parseInt(interval);
        }

        await connection.commit();

        res.json({
            success: true,
            message: `Created ${createdCount} tee times successfully`,
            count: createdCount
        });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error creating tee times:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Error creating tee times'
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

// Tee Time Management
router.get('/tee-times', auth, async (req, res) => {
    try {
        const [teeTimes] = await db.execute(`
            SELECT t.*, c.name as course_name 
            FROM tee_times t 
            JOIN courses c ON t.course_id = c.id 
            ORDER BY t.date, t.time
        `);
        res.json({ success: true, teeTimes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.put('/tee-times/:id', auth, async (req, res) => {
    try {
        const { date, time, available } = req.body;
        await db.execute(
            'UPDATE tee_times SET date = ?, time = ?, available = ? WHERE id = ?',
            [date, time, available, req.params.id]
        );
        res.json({ success: true, message: 'Tee time updated successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/tee-times/:id', auth, async (req, res) => {
    try {
        await db.execute('DELETE FROM tee_times WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Tee time deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Add new endpoint for deleting all tee times
router.delete('/tee-times/all', auth, async (req, res) => {
    let connection;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Delete all tee times that don't have bookings
        const [result] = await connection.execute(`
            DELETE t FROM tee_times t
            LEFT JOIN bookings b ON t.id = b.tee_time_id
            WHERE b.id IS NULL
        `);

        await connection.commit();
        
        res.json({ 
            success: true, 
            message: `Successfully deleted ${result.affectedRows} tee times`,
            deletedCount: result.affectedRows
        });
    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Error deleting all tee times:', error);
        res.status(500).json({ success: false, message: error.message });
    } finally {
        if (connection) connection.release();
    }
});

// Booking Management
router.get('/bookings', auth, async (req, res) => {
    try {
        const [bookings] = await db.execute(`
            SELECT b.*, u.name as user_name, c.name as course_name, t.date, t.time
            FROM bookings b
            JOIN users u ON b.user_id = u.id
            JOIN tee_times t ON b.tee_time_id = t.id
            JOIN courses c ON t.course_id = c.id
            ORDER BY t.date DESC, t.time DESC
        `);
        res.json({ success: true, bookings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.delete('/bookings/:id', auth, async (req, res) => {
    try {
        await db.execute('DELETE FROM bookings WHERE id = ?', [req.params.id]);
        res.json({ success: true, message: 'Booking deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;