import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Typography, Select, MenuItem, Button, TextField,
    FormControl, InputLabel, Box, Alert, FormGroup, FormControlLabel, Checkbox
} from '@mui/material';
import styles from '../styles/Booking.module.css';
import api from '../services/api';

const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
};

const formatTime = (timeString) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

const Booking = () => {
    const navigate = useNavigate();
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [teeTimes, setTeeTimes] = useState([]);
    const [selectedTime, setSelectedTime] = useState(null);
    const [players, setPlayers] = useState(1);
    const [message, setMessage] = useState({ text: '', type: '' });
    const [bookingConfirmed, setBookingConfirmed] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(30000); // 30 second refresh
    const [lastUpdate, setLastUpdate] = useState(null);
    const [wsConnected, setWsConnected] = useState(false);
    const [services, setServices] = useState({
        caddie_requested: false,
        cart_requested: false,
        equipment_rental: null
    });
    const [specialRequests, setSpecialRequests] = useState('');
    const [todaysTeeTimes, setTodaysTeeTimes] = useState([]);
    const [viewingToday, setViewingToday] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }
        fetchCourses();
    }, [navigate]);

    // Memoize fetchCourses to prevent unnecessary re-renders
    const fetchCourses = useCallback(async () => {
        try {
            const response = await api.get('/bookings/courses');
            if (response.data.success) {
                setCourses(response.data.courses);
                setLastUpdate(new Date());
            }
        } catch (error) {
            setMessage({ text: 'Failed to load courses', type: 'error' });
        }
    }, []);

    // Update handleSearch to include real-time checks
    const handleSearch = async () => {
        if (!selectedCourse || !selectedDate) {
            setMessage({ text: 'Please select both course and date', type: 'error' });
            return;
        }

        try {
            const response = await api.get('/bookings/tee-times', {
                params: { 
                    courseId: selectedCourse, 
                    date: selectedDate,
                    timestamp: new Date().getTime() // Add timestamp to prevent caching
                }
            });
            
            setTeeTimes(response.data.teeTimes.filter(t => t.available));
            setLastUpdate(new Date());
            
            if (response.data.teeTimes.length === 0) {
                setMessage({ text: 'No available tee times found', type: 'info' });
            } else {
                setMessage({ text: `Found ${response.data.teeTimes.length} available times`, type: 'success' });
            }
        } catch (error) {
            setMessage({ 
                text: error.response?.data?.message || 'Error fetching tee times', 
                type: 'error' 
            });
        }
    };

    const handleBooking = async () => {
        try {
            const response = await api.post('/bookings/book', {
                teeTimeId: selectedTime.id,
                players: players,
                ...services,
                special_requests: specialRequests
            });
            
            if (response.data.success) {
                setBookingConfirmed(true);
                setMessage({ text: 'Booking confirmed!', type: 'success' });
                setTimeout(() => navigate('/profile'), 2000);
            }
        } catch (error) {
            setMessage({ 
                text: error.response?.data?.message || 'Booking failed', 
                type: 'error' 
            });
        }
    };

    // Add WebSocket connection
    useEffect(() => {
        const ws = new WebSocket('ws://localhost:3000');
        
        ws.onopen = () => {
            console.log('WebSocket connected for bookings');
            setWsConnected(true);
        };
        
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'booking_update' && selectedCourse && selectedDate) {
                handleSearch(); // Refresh tee times when new booking occurs
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            setWsConnected(false);
        };
        
        ws.onclose = () => {
            console.log('WebSocket disconnected');
            setWsConnected(false);
        };

        return () => ws.close();
    }, [selectedCourse, selectedDate]);

    // Add auto-refresh for selected date/course
    useEffect(() => {
        if (selectedCourse && selectedDate) {
            const intervalId = setInterval(handleSearch, refreshInterval);
            return () => clearInterval(intervalId);
        }
    }, [selectedCourse, selectedDate, refreshInterval]);

    // Add this new function to fetch today's tee times
    const fetchTodaysTeeTimes = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await api.get('/bookings/today-tee-times', {
                params: { 
                    timestamp: new Date().getTime()
                }
            });
            
            if (response.data.success) {
                const availableTimes = response.data.teeTimes.filter(t => t.available);
                setTodaysTeeTimes(availableTimes);
                setViewingToday(true);
                setMessage({ 
                    text: availableTimes.length > 0 
                        ? `Found ${availableTimes.length} available times for today`
                        : 'No available tee times for today',
                    type: availableTimes.length > 0 ? 'success' : 'info'
                });
            }
        } catch (error) {
            setMessage({ 
                text: 'Error fetching today\'s tee times', 
                type: 'error' 
            });
        }
    };

    return (
        <div className={styles.container}>
            <Typography variant="h4" gutterBottom>Choose Golf Course (Holes) and Date</Typography>

            <div className={styles.actionButtons}>
                <Button 
                    variant="contained" 
                    onClick={fetchTodaysTeeTimes}
                    sx={{ mb: 2, mr: 2 }}
                >
                    View Today's Available Tee Times
                </Button>
                {viewingToday && (
                    <Button 
                        variant="outlined"
                        onClick={() => setViewingToday(false)}
                        sx={{ mb: 2 }}
                    >
                        Back to Course Selection
                    </Button>
                )}
            </div>

            {!viewingToday ? (
                // Original course selection form
                <div className={styles.courseSelection}>
                    <FormControl fullWidth margin="normal">
                        <InputLabel>Select Course</InputLabel>
                        <Select
                            value={selectedCourse}
                            onChange={(e) => setSelectedCourse(e.target.value)}
                        >
                            {courses.map(course => (
                                <MenuItem key={course.id} value={course.id}>
                                    {course.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    
                    <TextField
                        fullWidth
                        margin="normal"
                        type="date"
                        label="Select Date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                    />
                    
                    <div className="d-flex justify-content-between align-items-center mt-2">
                        <Button 
                            variant="contained"
                            onClick={handleSearch}
                            sx={{ width: 'auto' }}
                        >
                            Search Available Tee Times
                        </Button>
                        
                        {lastUpdate && (
                            <small className="text-muted">
                                Last updated: {new Date(lastUpdate).toLocaleTimeString()}
                                {wsConnected && <span className="text-success ms-2">●</span>}
                            </small>
                        )}
                    </div>
                </div>
            ) : (
                // Today's tee times view
                <div className={styles.todaysTeeTimes}>
                    <Typography variant="h5" gutterBottom>
                        Available Tee Times for Today
                    </Typography>
                    
                    {todaysTeeTimes.length > 0 ? (
                        <div className={styles.teeTimeGrid}>
                            {todaysTeeTimes.map((time) => (
                                <div key={time.id} className={styles.teeTimeCard}>
                                    <Typography variant="h6">{time.course_name}</Typography>
                                    <Typography>{formatTime(time.time)}</Typography>
                                    <Button
                                        variant="contained"
                                        onClick={() => {
                                            setSelectedTime(time);
                                            setViewingToday(false);
                                        }}
                                        sx={{ mt: 1 }}
                                    >
                                        Book Now
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <Alert severity="info">
                            No available tee times for today
                        </Alert>
                    )}
                </div>
            )}

            {/* Rest of the component */}
            {teeTimes.length > 0 && (
                <div className={styles.teeTimesList}>
                    {teeTimes.map((time) => (
                        <div key={time.id} className={styles.teeTimeCard}>
                            <div>
                                <Typography variant="h6">{time.course_name}</Typography>
                                <Typography>
                                    {formatDate(time.date)} at {formatTime(time.time)}
                                </Typography>
                            </div>
                            <Button
                                variant="contained"
                                onClick={() => setSelectedTime(time)}
                            >
                                Select
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {selectedTime && !bookingConfirmed && (
                <Box className={styles.confirmationDetails}>
                    <Typography variant="h6">Confirm Booking</Typography>
                    <Typography>
                        {formatDate(selectedTime.date)} at {formatTime(selectedTime.time)}
                    </Typography>
                    <TextField
                        type="number"
                        label="Number of Players"
                        value={players}
                        onChange={(e) => setPlayers(Math.max(1, Math.min(4, Number(e.target.value))))}
                        inputProps={{ min: 1, max: 4 }}
                        fullWidth
                        margin="normal"
                    />
                    <FormGroup>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={services.caddie_requested}
                                    onChange={(e) => setServices({
                                        ...services,
                                        caddie_requested: e.target.checked
                                    })}
                                />
                            }
                            label="Request Caddie"
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={services.cart_requested}
                                    onChange={(e) => setServices({
                                        ...services,
                                        cart_requested: e.target.checked
                                    })}
                                />
                            }
                            label="Request Golf Cart"
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={Boolean(services.equipment_rental)}
                                    onChange={(e) => setServices({
                                        ...services,
                                        equipment_rental: e.target.checked ? {} : null
                                    })}
                                />
                            }
                            label="Need Equipment Rental"
                        />
                    </FormGroup>

                    <TextField
                        multiline
                        rows={3}
                        fullWidth
                        margin="normal"
                        label="Special Requests"
                        value={specialRequests}
                        onChange={(e) => setSpecialRequests(e.target.value)}
                    />

                    <Button
                        variant="contained"
                        onClick={handleBooking}
                        sx={{ mt: 2 }}
                    >
                        Confirm Booking
                    </Button>
                </Box>
            )}

            {message.text && (
                <Alert severity={message.type} sx={{ mt: 2 }}>
                    {message.text}
                </Alert>
            )}
        </div>
    );
};

export default Booking;