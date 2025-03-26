import { useState, useEffect } from 'react';
import { Table, Form, Button, Modal, Alert, Container } from 'react-bootstrap';
import api from '../../services/api';

const CourseManager = () => {
    const [courses, setCourses] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        holes: 18,
        location: '',
        facilities: '',
        difficulty_level: 'intermediate',
        caddie_required: false,
        golf_cart_available: true,
        club_rental_available: true
    });
    const [editingId, setEditingId] = useState(null);

    const fetchCourses = async () => {
        setLoading(true);
        try {
            const response = await api.get('/admin/courses');
            setCourses(response.data.courses);
        } catch (error) {
            setError('Failed to fetch courses: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCourses();
    }, []);

    // Add validation function
    const validateForm = (data) => {
        const errors = {};
        
        if (!data.name || data.name.length > 100) {
          errors.name = 'Name is required and must be less than 100 characters';
        }
        
        if (!data.holes || ![9, 18].includes(Number(data.holes))) {
          errors.holes = 'Must be either 9 or 18 holes';
        }
        
        if (!data.difficulty_level || 
            !['beginner', 'intermediate', 'advanced'].includes(data.difficulty_level)) {
          errors.difficulty_level = 'Invalid difficulty level';
        }
      
        return errors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errors = validateForm(formData);
        
        if (Object.keys(errors).length > 0) {
          setError(Object.values(errors).join(', '));
          return;
        }
      
        try {
            setLoading(true);
            
            // Convert booleans for MySQL
            const submitData = {
                ...formData,
                caddie_required: formData.caddie_required ? 1 : 0,
                golf_cart_available: formData.golf_cart_available ? 1 : 0,
                club_rental_available: formData.club_rental_available ? 1 : 0
            };

            if (editingId) {
                await api.put(`/admin/courses/${editingId}`, submitData);
                setSuccessMessage('Course updated successfully');
            } else {
                await api.post('/admin/courses', submitData);
                setSuccessMessage('Course created successfully');
            }
            
            await fetchCourses();
            setShowModal(false);
            resetForm();
            
        } catch (error) {
            setError(error.response?.data?.message || 'Error saving course');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this course?')) {
            try {
                await api.delete(`/admin/courses/${id}`);
                fetchCourses();
            } catch (error) {
                console.error('Error deleting course:', error);
            }
        }
    };

    const resetForm = () => {
        setFormData({ 
            name: '', 
            description: '', 
            holes: 18,
            location: '',
            facilities: '',
            difficulty_level: 'intermediate',
            caddie_required: false,
            golf_cart_available: true,
            club_rental_available: true
        });
        setEditingId(null);
    };

    const renderDifficultyBadge = (difficulty) => {
        const colors = {
            beginner: 'success',
            intermediate: 'warning',
            advanced: 'danger'
        };
        return (
            <span className={`badge bg-${colors[difficulty]}`}>
                {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
            </span>
        );
    };

    return (
        <Container fluid className="p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>Golf Course Management</h2>
                <Button 
                    variant="success" 
                    onClick={() => setShowModal(true)}
                    className="d-flex align-items-center gap-2"
                >
                    <i className="bi bi-plus-circle"></i> Add New Course
                </Button>
            </div>

            {error && <Alert variant="danger" className="mb-4">{error}</Alert>}
            {successMessage && <Alert variant="success" className="mb-4">{successMessage}</Alert>}

            {loading ? (
                <div className="text-center p-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            ) : (
                <Table responsive striped bordered hover>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Location</th>
                            <th>Holes</th>
                            <th>Difficulty</th>
                            <th>Services</th>
                            <th>Created</th>
                            <th>Updated</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {courses.map(course => (
                            <tr key={course.id}>
                                <td>{course.name}</td>
                                <td>{course.location}</td>
                                <td>{course.holes}</td>
                                <td>{renderDifficultyBadge(course.difficulty_level)}</td>
                                <td>
                                    <div className="d-flex gap-2">
                                        {course.caddie_required && 
                                            <span className="badge bg-info">🏌️ Caddie</span>}
                                        {course.golf_cart_available && 
                                            <span className="badge bg-success">🚗 Cart</span>}
                                        {course.club_rental_available && 
                                            <span className="badge bg-primary">⛳ Rentals</span>}
                                    </div>
                                </td>
                                <td>{new Date(course.created_at).toLocaleString()}</td>
                                <td>{new Date(course.updated_at).toLocaleString()}</td>
                                <td>
                                    <div className="d-flex gap-2">
                                        <Button 
                                            variant="outline-primary" 
                                            size="sm"
                                            onClick={() => {
                                                setFormData(course);
                                                setEditingId(course.id);
                                                setShowModal(true);
                                            }}
                                        >
                                            Edit
                                        </Button>
                                        <Button 
                                            variant="outline-danger" 
                                            size="sm"
                                            onClick={() => handleDelete(course.id)}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}

            <Modal show={showModal} onHide={() => {
                setShowModal(false);
                resetForm();
            }} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>{editingId ? 'Edit Course' : 'Add New Course'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleSubmit}>
                        <Form.Group className="mb-3">
                            <Form.Label>Name</Form.Label>
                            <Form.Control
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                required
                            />
                        </Form.Group>
                        
                        <Form.Group className="mb-3">
                            <Form.Label>Location</Form.Label>
                            <Form.Control
                                type="text"
                                value={formData.location}
                                onChange={(e) => setFormData({...formData, location: e.target.value})}
                                required
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Description</Form.Label>
                            <Form.Control
                                as="textarea"
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                                required
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Holes</Form.Label>
                            <Form.Select
                                value={formData.holes}
                                onChange={(e) => setFormData({...formData, holes: parseInt(e.target.value)})}
                            >
                                <option value={9}>9 Holes</option>
                                <option value={18}>18 Holes</option>
                            </Form.Select>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Difficulty Level</Form.Label>
                            <Form.Select
                                value={formData.difficulty_level}
                                onChange={(e) => setFormData({...formData, difficulty_level: e.target.value})}
                            >
                                <option value="beginner">Beginner</option>
                                <option value="intermediate">Intermediate</option>
                                <option value="advanced">Advanced</option>
                            </Form.Select>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Facilities</Form.Label>
                            <Form.Control
                                as="textarea"
                                value={formData.facilities}
                                onChange={(e) => setFormData({...formData, facilities: e.target.value})}
                                placeholder="List available facilities..."
                            />
                        </Form.Group>

                        <div className="mb-3">
                            <Form.Check
                                type="switch"
                                id="caddie-switch"
                                label="Caddie Required"
                                checked={formData.caddie_required}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    caddie_required: e.target.checked
                                })}
                            />
                            <Form.Check
                                type="switch"
                                id="cart-switch"
                                label="Golf Cart Available"
                                checked={formData.golf_cart_available}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    golf_cart_available: e.target.checked
                                })}
                            />
                            <Form.Check
                                type="switch"
                                id="rental-switch"
                                label="Club Rental Available"
                                checked={formData.club_rental_available}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    club_rental_available: e.target.checked
                                })}
                            />
                        </div>

                        <Button type="submit" disabled={loading}>
                            {loading ? 'Saving...' : (editingId ? 'Update Course' : 'Create Course')}
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>
        </Container>
    );
};

// Helper function to determine badge color based on difficulty
const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
        case 'beginner': return 'success';
        case 'intermediate': return 'warning';
        case 'advanced': return 'danger';
        default: return 'secondary';
    }
};

export default CourseManager;