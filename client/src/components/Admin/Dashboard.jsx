import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Button, Card, Alert, Box } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GolfCourseIcon from '@mui/icons-material/GolfCourse';
import ScheduleIcon from '@mui/icons-material/Schedule';
import BookOnlineIcon from '@mui/icons-material/BookOnline';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import { Line, Doughnut, Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  BarElement
} from 'chart.js';
import api from '../../services/api';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  BarElement
);

const Dashboard = () => {
    const location = useLocation();
    // Add this to check current route
    const isMainDashboard = location.pathname === '/admin';

    // State declarations:
    const [stats, setStats] = useState({
        teeTimes: { total: 0, available: 0 },
        recentActivity: [],
        courseUtilization: [], 
        weeklyBookings: [],
        peakHours: []
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [wsConnected, setWsConnected] = useState(false);
    const [refreshInterval, setRefreshInterval] = useState(30000);
    const [lastUpdate, setLastUpdate] = useState(null);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const response = await api.get('/admin/stats');
            if (response.data.success) {
                setStats(response.data.stats);
                setLastUpdate(new Date());
                setError(null);
            }
        } catch (error) {
            console.error('Error:', error);
            setError('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isMainDashboard) {
            fetchStats();
            const intervalId = setInterval(fetchStats, refreshInterval);
            return () => clearInterval(intervalId);
        }
    }, [refreshInterval, isMainDashboard]);

    useEffect(() => {
        if (isMainDashboard) {
            const ws = new WebSocket('ws://localhost:3000');
            
            ws.onopen = () => {
                setWsConnected(true);
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'booking_update') {
                    fetchStats();
                }
            };
            
            return () => ws.close();
        }
    }, [isMainDashboard]);

    // Modified data preparation with null checks
    const courseUtilizationData = {
        labels: stats.courseUtilization?.map(c => c.name) || [],
        datasets: [{
            data: stats.courseUtilization?.map(c => c.bookings) || [],
            backgroundColor: [
                '#36A2EB', '#FF6384', '#FFCE56', '#4BC0C0',
                '#FF9F40', '#9966FF', '#C9CBCF', '#4BC0C0'
            ],
        }]
    };

    const weeklyBookingsData = {
        labels: stats.weeklyBookings?.map(d => d.date) || [],
        datasets: [{
            label: 'Bookings',
            data: stats.weeklyBookings?.map(d => d.count) || [],
            fill: false,
            borderColor: '#36A2EB',
            tension: 0.1
        }]
    };

    

    const playerDistributionData = {
        labels: ['Single', 'Pair', 'Three', 'Four'],
        datasets: [{
            data: stats.recentActivity?.reduce((acc, booking) => {
                acc[booking.players - 1]++;
                return acc;
            }, [0, 0, 0, 0]),
            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0']
        }]
    };

    const getTimeSinceUpdate = () => {
        if (!lastUpdate) return '';
        const seconds = Math.floor((new Date() - lastUpdate) / 1000);
        return `Last updated ${seconds} seconds ago`;
    };

    return (
        <div className="app-container">
            <main className="px-4 py-3">
                {/* Always show the header */}
                <div className="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pb-2 mb-3 border-bottom">
                    <div>
                        <h1>Golf Management & Analysis</h1>
                        {isMainDashboard && (
                            <small className="text-muted">{getTimeSinceUpdate()}</small>
                        )}
                    </div>
                    {isMainDashboard && (
                        <div className="d-flex gap-2 align-items-center">
                            <select 
                                className="form-select form-select-sm"
                                value={refreshInterval}
                                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                            >
                                <option value={5000}>Refresh: 5s</option>
                                <option value={15000}>Refresh: 15s</option>
                                <option value={30000}>Refresh: 30s</option>
                                <option value={60000}>Refresh: 1m</option>
                            </select>
                            <Button 
                                variant="outlined" 
                                onClick={fetchStats}
                                disabled={loading}
                            >
                                {loading ? 'Refreshing...' : 'Refresh Now'}
                            </Button>
                        </div>
                    )}
                </div>

                {/* Show visualizations only on main dashboard */}
                {isMainDashboard ? (
                    <>
                        {error && (
                            <Alert severity="error" className="mb-3">{error}</Alert>
                        )}

                        {loading ? (
                            <div className="text-center p-5">
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Summary Cards */}
                                <div className="row g-3 mb-4">
                                    <div className="col-md-4">
                                        <Card className="h-100 bg-primary text-white">
                                            <div className="card-body d-flex align-items-center">
                                                <CalendarMonthIcon sx={{ fontSize: 40, mr: 2 }} />
                                                <div>
                                                    <h6 className="card-title">Total Tee Times</h6>
                                                    <h3>{stats.teeTimes.total}</h3>
                                                </div>
                                            </div>
                                        </Card>
                                    </div>
                                    <div className="col-md-4">
                                        <Card className="h-100 bg-primary text-white">
                                            <div className="card-body d-flex align-items-center">
                                                <EventAvailableIcon sx={{ fontSize: 40, mr: 2 }} />
                                                <div>
                                                    <h6 className="card-title">Available Times</h6>
                                                    <h3>{stats.teeTimes.available}</h3>
                                                </div>
                                            </div>
                                        </Card>
                                    </div>
                                    <div className="col-md-4">
                                        <Card className="h-100 bg-primary text-white">
                                            <div className="card-body d-flex align-items-center">
                                                <BookOnlineIcon sx={{ fontSize: 40, mr: 2 }} />
                                                <div>
                                                    <h6 className="card-title">Total Bookings</h6>
                                                    <h3>{stats.teeTimes.total - stats.teeTimes.available}</h3>
                                                </div>
                                            </div>
                                        </Card>
                                    </div>
                                </div>

                            

                                {/* Player Analytics Row */}
                                <div className="row g-3 mb-4">
                                    <div className="col-md-4">
                                        <Card className="h-100 bg-blur">
                                            <div className="card-body">
                                                <h6 className="text-black">Player Group Distribution</h6>
                                                <Pie 
                                                    data={playerDistributionData}
                                                    options={{
                                                        responsive: true,
                                                        plugins: {
                                                            legend: {
                                                                position: 'bottom',
                                                                labels: { color: 'black' }
                                                            }
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </Card>
                                    </div>
                                    <div className="col-md-8">
                                        <Card className="h-100 bg-blur text-white">
                                            <div className="card-body">
                                                <h6 className="card-title">Peak Hours Analysis</h6>
                                                <div className="row mt-3">
                                                    {['Morning', 'Afternoon', 'Evening'].map((time, index) => (
                                                        <div key={time} className="col-md-4">
                                                            <Card className="bg-transparent border">
                                                                <div className="card-body text-center">
                                                                    <h5>{time}</h5>
                                                                    <h3>{stats.peakHours?.[index] || 0}%</h3>
                                                                    <small>Booking Rate</small>
                                                                </div>
                                                            </Card>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </Card>
                                    </div>
                                </div>

                                {/* Golf Analytics Grid */}
                                <div className="row g-3 mb-4">
                                    <div className="col-md-6">
                                        <Card className="h-100 bg-blur">
                                            <div className="card-body">
                                                <h6 className="card-title text-black">Course Utilization</h6>
                                                <div style={{ height: '300px', position: 'relative' }}>
                                                    {stats.courseUtilization?.length > 0 ? (
                                                        <Doughnut 
                                                            data={courseUtilizationData}
                                                            options={{
                                                                responsive: true,
                                                                maintainAspectRatio: false,
                                                                plugins: {
                                                                    legend: {
                                                                        position: 'right',
                                                                        labels: { color: 'black' }
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="text-black text-center pt-5">
                                                            No course utilization data available
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </Card>
                                    </div>
                                    <div className="col-md-6">
                                        <Card className="h-100 bg-blur">
                                            <div className="card-body">
                                                <h6 className="card-title text-black">Weekly Booking Trends</h6>
                                                <div style={{ height: '300px', position: 'relative' }}>
                                                    {stats.weeklyBookings?.length > 0 ? (
                                                        <Line 
                                                            data={weeklyBookingsData}
                                                            options={{
                                                                responsive: true,
                                                                maintainAspectRatio: false,
                                                                scales: {
                                                                    y: { 
                                                                        beginAtZero: true,
                                                                        ticks: { color: 'white' },
                                                                        grid: { color: 'rgba(255,255,255,0.1)' }
                                                                    },
                                                                    x: { 
                                                                        ticks: { color: 'white' },
                                                                        grid: { color: 'rgba(255,255,255,0.1)' }
                                                                    }
                                                                },
                                                                plugins: {
                                                                    legend: {
                                                                        labels: { color: 'black' }
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="text-black text-center pt-5">
                                                            No booking trends data available
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </Card>
                                    </div>
                                </div>

                                {/* Updated Recent Activity Table */}
                                <div className="card bg-blur text-white mb-4">
                                    <div className="card-header d-flex justify-content-between align-items-center">
                                        <h5 className="mb-0">Recent Bookings</h5>
                                        <div className="d-flex gap-3">
                                            <div className="d-flex align-items-center">
                                                <div className="bg-success rounded-circle me-2" style={{width: 10, height: 10}}></div>
                                                <small className="text-black">Available</small>
                                            </div>
                                            <div className="d-flex align-items-center">
                                                <div className="bg-danger rounded-circle me-2" style={{width: 10, height: 10}}></div>
                                                <small className="text-black">Booked</small>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="card-body">
                                        {stats.recentActivity?.length > 0 ? (
                                            <div className="table-responsive">
                                                <table className="table table-white table-hover">
                                                    <thead>
                                                        <tr>
                                                            <th>Customer</th>
                                                            <th>Course</th>
                                                            <th>Players</th>
                                                            <th>Date & Time</th>
                                                            <th>Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {stats.recentActivity.map((booking) => (
                                                            <tr key={booking.id}>
                                                                <td>{booking.user_name}</td>
                                                                <td>{booking.course_name}</td>
                                                                <td>{booking.players}</td>
                                                                <td>
                                                                    {new Date(booking.play_date).toLocaleDateString()} at{' '}
                                                                    {booking.play_time}
                                                                </td>
                                                                <td>
                                                                    <span className={`badge ${booking.available ? 'bg-success' : 'bg-danger'}`}>
                                                                        {booking.available ? 'Available' : 'Booked'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="text-center p-3">
                                                No recent bookings found
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                ) : (
                    // Show Outlet for other admin pages
                    <Outlet />
                )}
            </main>
        </div>
    );
};

export default Dashboard;