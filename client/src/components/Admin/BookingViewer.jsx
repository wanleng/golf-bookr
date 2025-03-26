import { useState, useEffect } from 'react';
import Table from 'react-bootstrap/Table';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import api from '../../services/api';

const BookingViewer = () => {
    const [bookings, setBookings] = useState([]);
    const [filter, setFilter] = useState({
        date: '',
        course: '',
        status: 'all'
    });

    useEffect(() => {
        fetchBookings();
    }, []);

    const fetchBookings = async () => {
        try {
            const response = await api.get('/admin/bookings');
            setBookings(response.data.bookings);
        } catch (error) {
            console.error('Error fetching bookings:', error);
        }
    };

    const handleCancel = async (id) => {
        if (window.confirm('Are you sure you want to cancel this booking?')) {
            try {
                await api.delete(`/admin/bookings/${id}`);
                fetchBookings();
            } catch (error) {
                console.error('Error canceling booking:', error);
            }
        }
    };

    const renderBookingStatus = (booking) => {
        const statusColors = {
            'confirmed': 'success',
            'cancelled': 'error',
            'completed': 'info'
        };
        return (
            <span className={`badge bg-${statusColors[booking.booking_status]}`}>
                {booking.booking_status}
            </span>
        );
    };

    const renderServices = (booking) => {
        return (
            <div>
                {booking.caddie_requested && '🏌️ Caddie'}
                {booking.cart_requested && ' 🚗 Cart'}
                {booking.equipment_rental && ' ⛳ Rentals'}
            </div>
        );
    };

    const formatDate = (dateString) => {
        const options = { 
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };
        return new Date(dateString).toLocaleDateString('en-US', options);
    };

    const formatTime = (timeString) => {
        return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const filteredBookings = bookings.filter(booking => {
        if (filter.date && booking.date !== filter.date) return false;
        if (filter.course && booking.course_name !== filter.course) return false;
        return true;
    });

    return (
        <div className="p-4">
            <h2>Booking Management</h2>
            
            <div className="mb-4">
                <Form className="row g-3">
                    <div className="col-md-4">
                        <Form.Control
                            type="date"
                            value={filter.date}
                            onChange={(e) => setFilter({...filter, date: e.target.value})}
                            placeholder="Filter by date"
                        />
                    </div>
                    <div className="col-md-4">
                        <Form.Control
                            type="text"
                            value={filter.course}
                            onChange={(e) => setFilter({...filter, course: e.target.value})}
                            placeholder="Filter by course"
                        />
                    </div>
                    <div className="col-md-4">
                        <Button 
                            variant="secondary"
                            onClick={() => setFilter({ date: '', course: '', status: 'all' })}
                        >
                            Clear Filters
                        </Button>
                    </div>
                </Form>
            </div>

            <Table striped bordered hover>
                <thead>
                    <tr>
                        <th>Booking ID</th>
                        <th>User</th>
                        <th>Course</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Players</th>
                        <th>Services</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredBookings.map(booking => (
                        <tr key={booking.id}>
                            <td>{booking.id}</td>
                            <td>{booking.user_name}</td>
                            <td>{booking.course_name}</td>
                            <td>{formatDate(booking.date)}</td>
                            <td>{formatTime(booking.time)}</td>
                            <td>{booking.players}</td>
                            <td>{renderServices(booking)}</td>
                            <td>{renderBookingStatus(booking)}</td>
                            <td>
                                <Button 
                                    variant="danger" 
                                    size="sm"
                                    onClick={() => handleCancel(booking.id)}
                                    disabled={booking.booking_status === 'cancelled'}
                                >
                                    Cancel
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table>
        </div>
    );
};

export default BookingViewer;