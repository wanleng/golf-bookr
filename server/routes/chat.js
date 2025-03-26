import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { auth } from '../middleware/auth.js';
import { db } from '../db.js';

const router = express.Router();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Add conversation store
const conversations = new Map();

const GOLF_CONTEXT = `You are CawFee, a cheerful and witty golf assistant with a fun personality. You help users book golf courses and understand our services.

DOMAIN KNOWLEDGE:
- We offer golf courses with 9 or 18 holes
- Each course has different difficulty levels (beginner, intermediate, advanced)
- Services available: caddies, golf carts, club rentals
- Bookings can be made for 1-4 players
- We focus on Bangkok area golf courses

COURSE FEATURES TO HIGHLIGHT:
- Course difficulty level
- Available facilities
- Whether caddie is required
- Golf cart availability
- Club rental options
- Number of holes

BOOKING INFORMATION:
- Users need to select a course and date
- Tee times are available in intervals
- Maximum 4 players per booking
- Users can request additional services (caddie, cart, equipment)
- Users can add special requests

PERSONALITY:
- Friendly and helpful
- Uses golf-related puns
- Professional but approachable
- Enthusiastic about golf

SESSION TIMINGS:
- Morning Session: 6:00 AM - 11:59 AM
- Afternoon Session: 12:00 PM - 3:59 PM
- Evening Session: 4:00 PM - 7:00 PM

BOOKING PREFERENCES:
- Morning sessions are popular for cooler weather
- Afternoon sessions often have better rates
- Evening sessions offer sunset views
- Each session has different lighting and weather conditions

BOOKING GUIDANCE:
1. Ask for their preferences:
   - Preferred date and time (morning/afternoon/evening)
   - Number of players (1-4)
   - Skill level (beginner/intermediate/advanced)
   - Service requirements (caddie, cart, equipment rental)

2. Recommend courses based on:
   - Matching difficulty level to skill
   - Group size compatibility
   - Time slot availability
   - Required services availability

3. Help with special requirements:
   - Equipment rental needs
   - Golf cart preferences
   - Caddie services
   - Special assistance or requests

CONVERSATION FLOW:
1. Greet and ask about preferences
2. Suggest suitable courses with available times
3. Explain available services and facilities
4. Guide through booking steps:
   - Select course
   - Choose date and time slot
   - Specify number of players
   - Add required services
   - Add any special requests

EXAMPLE RESPONSES:
For new bookings:
"I'd be happy to help you book a tee time! Could you tell me:
1. When would you like to play? (date and preferred time of day)
2. How many players in your group? (1-4)
3. What's your skill level? (beginner/intermediate/advanced)"

For course recommendations:
"Based on your preferences, I recommend [Course Name] because:
- It's perfect for [skill level] players
- They have [X] slots available in the [morning/afternoon/evening]
- They offer [relevant services]
Would you like to know more about this course?"

For booking confirmation:
"Great choice! Let me summarize your booking:
- Course: [name]
- Date: [date]
- Time: [time]
- Players: [number]
- Services: [selected services]
Would you like me to help you complete this booking?"`;

// Update the database context query
async function getDatabaseContext() {
    try {
        // Get detailed course information with stats
        const [courses] = await db.execute(`
            SELECT 
                c.*,
                COUNT(DISTINCT t.id) as total_tee_times,
                COUNT(DISTINCT b.id) as total_bookings,
                COUNT(DISTINCT CASE WHEN t.available = 1 THEN t.id END) as available_slots,
                (
                    SELECT COUNT(*)
                    FROM bookings b2 
                    JOIN tee_times t2 ON b2.tee_time_id = t2.id 
                    WHERE t2.course_id = c.id 
                    AND b2.booking_status = 'completed'
                ) as completed_rounds,
                (
                    SELECT GROUP_CONCAT(DISTINCT DATE_FORMAT(t3.time, '%H:00'))
                    FROM tee_times t3
                    JOIN bookings b3 ON t3.id = b3.tee_time_id
                    WHERE t3.course_id = c.id
                    AND b3.booking_status = 'confirmed'
                    GROUP BY t3.course_id
                ) as popular_hours
            FROM courses c
            LEFT JOIN tee_times t ON c.id = t.course_id
            LEFT JOIN bookings b ON t.id = b.tee_time_id
            GROUP BY c.id
        `);

        // Get today's availability
        const [todayStats] = await db.execute(`
            SELECT 
                c.name,
                COUNT(CASE WHEN t.available = 1 THEN 1 END) as available_slots,
                MIN(t.time) as earliest_time,
                MAX(t.time) as latest_time
            FROM courses c
            JOIN tee_times t ON c.id = t.course_id
            WHERE t.date = CURDATE()
            GROUP BY c.id
        `);

        // Add tomorrow's availability
        const [tomorrowStats] = await db.execute(`
            SELECT 
                c.name,
                COUNT(CASE WHEN t.available = 1 THEN 1 END) as available_slots,
                MIN(t.time) as earliest_time,
                MAX(t.time) as latest_time,
                GROUP_CONCAT(
                    CASE WHEN t.available = 1 
                    THEN TIME_FORMAT(t.time, '%h:%i %p')
                    END
                ) as available_times
            FROM courses c
            JOIN tee_times t ON c.id = t.course_id
            WHERE t.date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
            GROUP BY c.id
        `);

        // Format course information
        const courseInfo = courses.map(course => ({
            name: course.name,
            description: course.description,
            holes: course.holes,
            location: course.location,
            difficulty: course.difficulty_level,
            facilities: parseFacilities(course.facilities),
            services: {
                caddie: course.caddie_required ? 'Required' : 'Optional',
                golfCart: course.golf_cart_available ? 'Available' : 'Not available',
                clubRental: course.club_rental_available ? 'Available' : 'Not available'
            },
            stats: {
                availableSlots: course.available_slots,
                completedRounds: course.completed_rounds,
                popularHours: course.popular_hours?.split(',') || []
            }
        }));

        // Create enhanced dynamic context
        const dynamicContext = `
► CURRENT GOLF COURSE STATUS:
${courseInfo.map(course => `
⛳ ${course.name}
• Location: ${course.location}
• Course Type: ${course.holes}-hole course
• Difficulty Level: ${course.difficulty}

Available Tee Times:
• Today: ${todayStats.find(s => s.name === course.name)?.available_slots || 0} slots
• Tomorrow: ${tomorrowStats.find(s => s.name === course.name)?.available_slots || 0} slots

Tomorrow's Available Times:
${tomorrowStats.find(s => s.name === course.name)?.available_times?.split(',').join(', ') || 'No times available'}

Course Features:
${course.facilities.map(f => `• ${f}`).join('\n')}
`).join('\n─────────────────────────\n')}

► BOOKING INFORMATION:
• Players per booking: 1-4 players
• Booking statuses: Confirmed, Cancelled, Completed
• Required information: Number of players, preferred time, service requests
• Optional services: Caddie service, golf cart, equipment rental

► SPECIAL SERVICES:
• Equipment rental available (clubs, shoes, etc.)
• Golf cart rental options
• Professional caddie services
• Special requests accommodation

► BOOKING GUIDELINES:
1. Select course based on:
   • Skill level (beginner/intermediate/advanced)
   • Number of holes (9 or 18)
   • Required services
   • Location preference

2. Consider when booking:
   • Available tee times
   • Group size (1-4 players)
   • Service requirements
   • Special requests
`;

        return { courses: courseInfo, dynamicContext };
    } catch (error) {
        console.error('Error getting database context:', error);
        throw error;
    }
}

// Helper function to parse facilities
function parseFacilities(facilitiesStr) {
    if (!facilitiesStr) return ['Basic facilities available'];
    return facilitiesStr.split(',').map(f => f.trim());
}

// Update initializeChat function to use GOLF_CONTEXT
async function initializeChat(userId) {
    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-1.5-flash",
            generationConfig: {
                maxOutputTokens: 500,
                temperature: 0.7,
            },
        });

        const chat = model.startChat();
        const { dynamicContext } = await getDatabaseContext();
        
        await chat.sendMessage(`
${GOLF_CONTEXT}

DATABASE CONTEXT:
${dynamicContext}

IMPORTANT: Always use the structured format with 🔹 emojis and sections.
`);

        conversations.set(userId, {
            chat,
            lastUpdate: Date.now()
        });
        
        return chat;
    } catch (error) {
        console.error('Chat initialization error:', error);
        throw new Error('Failed to initialize chat service');
    }
}

// Modify the chat route
router.post('/', auth, async (req, res) => {
    try {
        const { message } = req.body;
        if (!message?.trim()) {
            return res.status(400).json({ 
                success: false, 
                message: 'Message is required' 
            });
        }

        let chat;
        // Get or initialize chat with retry logic
        try {
            if (!conversations.has(req.user.id) || 
                Date.now() - conversations.get(req.user.id).lastUpdate > 1800000) {
                chat = await initializeChat(req.user.id);
            } else {
                chat = conversations.get(req.user.id).chat;
                
                // Refresh context
                const { dynamicContext } = await getDatabaseContext();
                await chat.sendMessage(`
Latest database context:
${dynamicContext}
                `);
            }
        } catch (error) {
            throw new Error('Chat service initialization failed');
        }

        // Update last activity
        conversations.get(req.user.id).lastUpdate = Date.now();

        // Process message with retry logic
        let response;
        let attempts = 0;
        while (attempts < 3) {
            try {
                const result = await chat.sendMessage(`
Remember to:
- Give direct, natural responses
- Include specific available times and course details
- Keep responses under 3 sentences
- End with one engaging question
- Don't repeat the user's question
- Don't use stars, emojis, or special formatting

User message: "${req.body.message}"

Use current database information for accurate details.
`);
                response = await result.response;
                break;
            } catch (error) {
                attempts++;
                if (attempts === 3) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
            }
        }

        res.json({ 
            success: true, 
            message: response.text()
        });

    } catch (error) {
        console.error('Chat error:', error);
        // Clear conversation if fatal error
        if (conversations.has(req.user.id)) {
            conversations.delete(req.user.id);
        }
        res.status(500).json({ 
            success: false, 
            message: 'Chat service temporarily unavailable. Please try again.'
        });
    }
});

// Add cleanup for old conversations
setInterval(() => {
    const now = Date.now();
    for (const [userId, data] of conversations.entries()) {
        if (now - data.lastUpdate > 1800000) { // 30 minutes
            conversations.delete(userId);
        }
    }
}, 300000); // Clean up every 5 minutes


export default router;