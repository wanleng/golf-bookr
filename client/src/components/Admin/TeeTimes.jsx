import { useState, useEffect } from 'react';
import { 
    Button, Dialog, DialogActions, DialogContent, 
    DialogContentText, DialogTitle, Alert,
    TextField, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import { format } from 'date-fns';
import api from '../../services/api';

const TeeTimes = () => {
    // Combined state management
    const [teeTimes, setTeeTimes] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [selectedTeeTime, setSelectedTeeTime] = useState(null);
    const [formData, setFormData] = useState({
        courseId: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: '07:00',
        endTime: '17:00',
        interval: 10,
        maxPlayers: 4,
        specialNotes: ''
    });

    // Fetch data on component mount
    useEffect(() => {
        fetchTeeTimes();
        fetchCourses();
    }, []);

    const fetchTeeTimes = async () => {
        try {
            setLoading(true);
            const response = await api.get('/admin/tee-times');
            setTeeTimes(response.data.teeTimes);
        } catch (err) {
            setError('Failed to load tee times: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchCourses = async () => {
        try {
            const response = await api.get('/admin/courses');
            setCourses(response.data.courses);
        } catch (err) {
            setError('Failed to load courses: ' + err.message);
        }
    };

    const handleCreateTeeTimes = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const response = await api.post('/admin/tee-times/bulk', {
                ...formData,
                maxPlayers: parseInt(formData.maxPlayers),
                interval: parseInt(formData.interval)
            });

            if (response.data.success) {
                setSuccessMessage(`Created ${response.data.count} tee times successfully`);
                setShowCreateModal(false);
                fetchTeeTimes();
            }
        } catch (err) {
            setError('Failed to create tee times: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTeeTime = async (id) => {
        try {
            setLoading(true);
            await api.delete(`/admin/tee-times/${id}`);
            setSuccessMessage('Tee time deleted successfully');
            fetchTeeTimes();
        } catch (err) {
            setError('Failed to delete tee time: ' + err.message);
        } finally {
            setLoading(false);
            setConfirmDeleteOpen(false);
            setSelectedTeeTime(null);
        }
    };

    const handleDeleteAllUnused = async () => {
        try {
            setLoading(true);
            const response = await api.delete('/admin/tee-times/all');
            setSuccessMessage(`Deleted ${response.data.deletedCount} unused tee times`);
            fetchTeeTimes();
        } catch (err) {
            setError('Failed to delete unused tee times: ' + err.message);
        } finally {
            setLoading(false);
            setConfirmDeleteOpen(false);
        }
    };

    return (
        <div className="container-fluid p-4">
            {/* Header Section */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2>Tee Time Management</h2>
                <div className="d-flex gap-2">
                    <Button 
                        variant="contained" 
                        color="primary"
                        onClick={() => setShowCreateModal(true)}
                    >
                        Create Tee Times
                    </Button>
                    <Button 
                        variant="contained" 
                        color="error"
                        onClick={() => setConfirmDeleteOpen(true)}
                        disabled={loading || teeTimes.length === 0}
                    >
                        Delete Unused Times
                    </Button>
                </div>
            </div>

            {/* Alerts */}
            {error && (
                <Alert severity="error" onClose={() => setError(null)} className="mb-3">
                    {error}
                </Alert>
            )}
            {successMessage && (
                <Alert severity="success" onClose={() => setSuccessMessage('')} className="mb-3">
                    {successMessage}
                </Alert>
            )}

            {/* Tee Times Table */}
            <div className="card bg-white shadow-sm">
                <div className="card-body">
                    <div className="table-responsive">
                        <table className="table table-hover">
                            <thead>
                                <tr>
                                    <th>Course</th>
                                    <th>Date</th>
                                    <th>Time</th>
                                    <th>Players</th>
                                    <th>Status</th>
                                    <th>Notes</th>
                                    <th>Created</th>
                                    <th>Updated</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="9" className="text-center">
                                            <div className="spinner-border text-primary" />
                                        </td>
                                    </tr>
                                ) : teeTimes.length > 0 ? (
                                    teeTimes.map((teeTime) => (
                                        <tr key={teeTime.id}>
                                            <td>{teeTime.course_name}</td>
                                            <td>{format(new Date(teeTime.date), 'MMM dd, yyyy')}</td>
                                            <td>{teeTime.time}</td>
                                            <td>{teeTime.max_players}</td>
                                            <td>
                                                <span className={`badge ${teeTime.available ? 'bg-success' : 'bg-danger'}`}>
                                                    {teeTime.available ? 'Available' : 'Booked'}
                                                </span>
                                            </td>
                                            <td>
                                                {teeTime.special_notes ? (
                                                    <span title={teeTime.special_notes}>
                                                        {teeTime.special_notes.substring(0, 20)}
                                                        {teeTime.special_notes.length > 20 ? '...' : ''}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted">-</span>
                                                )}
                                            </td>
                                            <td>{format(new Date(teeTime.created_at), 'MMM dd, HH:mm')}</td>
                                            <td>{format(new Date(teeTime.updated_at), 'MMM dd, HH:mm')}</td>
                                            <td>
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    color="error"
                                                    onClick={() => {
                                                        setSelectedTeeTime(teeTime);
                                                        setConfirmDeleteOpen(true);
                                                    }}
                                                    disabled={!teeTime.available}
                                                >
                                                    Delete
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="9" className="text-center">No tee times found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Create Modal */}
            <Dialog open={showCreateModal} onClose={() => setShowCreateModal(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Create Tee Times</DialogTitle>
                <DialogContent>
                    <form onSubmit={handleCreateTeeTimes}>
                        <FormControl fullWidth margin="normal">
                            <InputLabel>Select Course</InputLabel>
                            <Select
                                value={formData.courseId}
                                onChange={(e) => setFormData({...formData, courseId: e.target.value})}
                                required
                            >
                                {courses.map(course => (
                                    <MenuItem key={course.id} value={course.id}>
                                        {course.name} ({course.holes} holes)
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <TextField
                            fullWidth
                            margin="normal"
                            type="date"
                            label="Date"
                            value={formData.date}
                            onChange={(e) => setFormData({...formData, date: e.target.value})}
                            InputLabelProps={{ shrink: true }}
                            required
                        />

                        <div className="d-flex gap-3">
                            <TextField
                                type="time"
                                label="Start Time"
                                value={formData.startTime}
                                onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                                InputLabelProps={{ shrink: true }}
                                required
                                sx={{ flex: 1 }}
                            />
                            <TextField
                                type="time"
                                label="End Time"
                                value={formData.endTime}
                                onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                                InputLabelProps={{ shrink: true }}
                                required
                                sx={{ flex: 1 }}
                            />
                        </div>

                        <div className="d-flex gap-3 mt-3">
                            <TextField
                                type="number"
                                label="Interval (minutes)"
                                value={formData.interval}
                                onChange={(e) => setFormData({...formData, interval: e.target.value})}
                                InputProps={{ inputProps: { min: 5, max: 60 } }}
                                required
                                sx={{ flex: 1 }}
                            />
                            <TextField
                                type="number"
                                label="Max Players"
                                value={formData.maxPlayers}
                                onChange={(e) => setFormData({...formData, maxPlayers: e.target.value})}
                                InputProps={{ inputProps: { min: 1, max: 4 } }}
                                required
                                sx={{ flex: 1 }}
                            />
                        </div>

                        <TextField
                            multiline
                            rows={3}
                            fullWidth
                            margin="normal"
                            label="Special Notes"
                            value={formData.specialNotes}
                            onChange={(e) => setFormData({...formData, specialNotes: e.target.value})}
                        />
                    </form>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowCreateModal(false)}>Cancel</Button>
                    <Button onClick={handleCreateTeeTimes} variant="contained" color="primary">
                        Create
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
                <DialogTitle>
                    {selectedTeeTime ? 'Delete Tee Time' : 'Delete All Unused Tee Times'}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {selectedTeeTime 
                            ? 'Are you sure you want to delete this tee time?'
                            : 'Are you sure you want to delete all unused tee times? This action cannot be undone.'}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => {
                        setConfirmDeleteOpen(false);
                        setSelectedTeeTime(null);
                    }}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={() => selectedTeeTime 
                            ? handleDeleteTeeTime(selectedTeeTime.id)
                            : handleDeleteAllUnused()
                        }
                        color="error"
                        variant="contained"
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default TeeTimes;