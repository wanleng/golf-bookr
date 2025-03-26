import { useState, useEffect } from 'react';
import Table from 'react-bootstrap/Table';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import api from '../../services/api';

const TeeTimeManager = () => {
    // State declarations:
    const [teeTimes, setTeeTimes] = useState([]);
    const [courses, setCourses] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        courseId: '',
        date: '',
        startTime: '07:00',
        endTime: '17:00',
        interval: 10,
        maxPlayers: 4,
        specialNotes: ''
    });
    const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [error, setError] = useState('');

    // Add this utility function at the top of the component
    const formatDate = (dateString) => {
        const options = { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        };
        return new Date(dateString).toLocaleDateString('en-US', options);
    };

    // Update the time format function
    const formatTime = (timeString) => {
        return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    useEffect(() => {
        fetchTeeTimes();
        fetchCourses();
    }, []);

    const fetchTeeTimes = async () => {
        try {
            const response = await api.get('/admin/tee-times');
            setTeeTimes(response.data.teeTimes);
        } catch (error) {
            console.error('Error fetching tee times:', error);
        }
    };

    const fetchCourses = async () => {
        try {
            const response = await api.get('/admin/courses');
            setCourses(response.data.courses);
        } catch (error) {
            console.error('Error fetching courses:', error);
        }
    };

    // Add tee time validation 
    const validateTeeTime = (data) => {
        const errors = [];
        
        if (!data.courseId) errors.push('Course is required');
        if (!data.date) errors.push('Date is required');
        if (!data.startTime || !data.endTime) errors.push('Time range is required');
        
        // Validate max players
        if (data.maxPlayers < 1 || data.maxPlayers > 4) {
            errors.push('Max players must be between 1 and 4');
        }

        // Validate time interval
        if (data.interval < 5 || data.interval > 60) {
            errors.push('Time interval must be between 5 and 60 minutes');
        }

        return errors;
    };

    // Update form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        const errors = validateTeeTime(formData);

        if (errors.length > 0) {
            setError(errors.join(', '));
            return;
        }

        try {
            const response = await api.post('/admin/tee-times/bulk', {
                ...formData,
                maxPlayers: parseInt(formData.maxPlayers),
                interval: parseInt(formData.interval)
            });

            if (response.data.success) {
                setSuccessMessage(`Created ${response.data.count} tee times`);
                fetchTeeTimes();
            }
        } catch (error) {
            setError('Failed to create tee times: ' + error.message);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this tee time?')) {
            try {
                await api.delete(`/admin/tee-times/${id}`);
                fetchTeeTimes();
            } catch (error) {
                console.error('Error deleting tee time:', error);
            }
        }
    };

    const handleDeleteAll = async () => {
        try {
            const response = await api.delete('/admin/tee-times/all');
            if (response.data.success) {
                setSuccessMessage(`Successfully deleted ${response.data.deletedCount} tee times`);
                fetchTeeTimes(); // Refresh the list
            }
            setConfirmDeleteAllOpen(false);
        } catch (error) {
            console.error('Error deleting all tee times:', error);
            alert('Failed to delete tee times');
        }
    };

    return (
        <div className="p-4">
            <div className="d-flex justify-content-between mb-4">
                <h2>Manage Tee Times</h2>
                <div>
                    <Button onClick={() => setShowModal(true)}>Create Tee Times</Button>
                </div>
            </div>

            {successMessage && (
                <div className="alert bg-success alert-dismissible fade show" role="alert">
                    {successMessage}
                    <button type="button" className="btn-close" onClick={() => setSuccessMessage('')}></button>
                </div>
            )}

            {error && (
                <div className="alert bg-danger alert-dismissible fade show" role="alert">
                    {error}
                    <button type="button" className="btn-close" onClick={() => setError('')}></button>
                </div>
            )}

            <Table striped bordered hover>
                <thead>
                    <tr>
                        <th>Course</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Max Players</th>
                        <th>Status</th>
                        <th>Special Notes</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {teeTimes.map(teeTime => (
                        <tr key={teeTime.id}>
                            <td>{teeTime.course_name}</td>
                            <td>{formatDate(teeTime.date)}</td>
                            <td>{formatTime(teeTime.time)}</td>
                            <td>{teeTime.max_players}</td>
                            <td>
                                <span className={`badge ${teeTime.available ? 'bg-success' : 'bg-danger'}`}>
                                    {teeTime.available ? 'Available' : 'Booked'}
                                </span>
                            </td>
                            <td>{teeTime.special_notes || '-'}</td>
                            <td>
                                <Button 
                                    variant="danger" 
                                    size="sm"
                                    onClick={() => handleDelete(teeTime.id)}
                                    disabled={!teeTime.available}
                                >
                                    Delete
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table>

            <Modal show={showModal} onHide={() => setShowModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Create Tee Times</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3">
                            <Form.Label>Course</Form.Label>
                            <Form.Select
                                value={formData.courseId}
                                onChange={(e) => setFormData({...formData, courseId: e.target.value})}
                                required
                            >
                                <option value="">Select Course</option>
                                {courses.map(course => (
                                    <option key={course.id} value={course.id}>
                                        {course.name} ({course.holes} holes)
                                    </option>
                                ))}
                            </Form.Select>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Date</Form.Label>
                            <Form.Control
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({...formData, date: e.target.value})}
                                required
                            />
                        </Form.Group>

                        <div className="row">
                            <div className="col">
                                <Form.Group className="mb-3">
                                    <Form.Label>Start Time</Form.Label>
                                    <Form.Control
                                        type="time"
                                        value={formData.startTime}
                                        onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                                        required
                                    />
                                </Form.Group>
                            </div>
                            <div className="col">
                                <Form.Group className="mb-3">
                                    <Form.Label>End Time</Form.Label>
                                    <Form.Control
                                        type="time"
                                        value={formData.endTime}
                                        onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                                        required
                                    />
                                </Form.Group>
                            </div>
                        </div>

                        <div className="row">
                            <div className="col">
                                <Form.Group className="mb-3">
                                    <Form.Label>Interval (minutes)</Form.Label>
                                    <Form.Control
                                        type="number"
                                        value={formData.interval}
                                        onChange={(e) => setFormData({...formData, interval: parseInt(e.target.value)})}
                                        min="5"
                                        max="60"
                                        required
                                    />
                                </Form.Group>
                            </div>
                            <div className="col">
                                <Form.Group className="mb-3">
                                    <Form.Label>Max Players</Form.Label>
                                    <Form.Control
                                        type="number"
                                        value={formData.maxPlayers}
                                        onChange={(e) => setFormData({...formData, maxPlayers: parseInt(e.target.value)})}
                                        min="1"
                                        max="4"
                                        required
                                    />
                                </Form.Group>
                            </div>
                        </div>

                        <Form.Group className="mb-3">
                            <Form.Label>Special Notes</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                value={formData.specialNotes}
                                onChange={(e) => setFormData({...formData, specialNotes: e.target.value})}
                            />
                        </Form.Group>
                        
                        <Button type="submit">Create</Button>
                    </Form>
                </Modal.Body>
            </Modal>

        </div>
    );
};

export default TeeTimeManager;