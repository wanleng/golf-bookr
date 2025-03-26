import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import styles from '../styles/Navbar.module.css';
import { useState, useEffect } from 'react';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import CloudIcon from '@mui/icons-material/Cloud';
import ThunderstormIcon from '@mui/icons-material/Thunderstorm';

const Navbar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { darkMode, toggleTheme } = useTheme();
    const isLoggedIn = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    const isAdmin = userRole === 'admin';
    const isAdminRoute = location.pathname.startsWith('/admin');

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        navigate('/login');
    };

    return (
        <nav className={`${styles.navbar} ${isAdminRoute ? styles.adminNav : ''}`}>
            <div className={styles.logo}>
                {isAdminRoute ? (
                    <Link to="/admin" className={styles.adminLogo}>
                        <AdminPanelSettingsIcon /> Admin Panel
                    </Link>
                ) : (
                    <Link to="/">GOLF BOOKR</Link>
                )}
            </div>

            <ul className={styles.navLinks}>
                {isAdminRoute ? (
                    // Admin Navigation Links
                    <>
                        <li><Link to="/admin" className={styles.navLink}>Dashboard</Link></li>
                        <li><Link to="/admin/courses" className={styles.navLink}>Courses</Link></li>
                        <li><Link to="/admin/tee-times" className={styles.navLink}>Tee Times</Link></li>
                        <li><Link to="/admin/bookings" className={styles.navLink}>Bookings</Link></li>
                        <li><Link to="/" className={styles.navLink}>Exit Admin</Link></li>
                    </>
                ) : (
                    // Regular Navigation Links
                    <>
                        <li><Link to="/" className={styles.navLink}>Home</Link></li>
                        
                        {isLoggedIn ? (
                            <>
                                <li><Link to="/booking" className={styles.navLink}>Booking</Link></li>
                                <li><Link to="/profile" className={styles.navLink}>Profile</Link></li>
                                <li><Link to="/about" className={styles.navLink}>About Us</Link></li>
                                <li><Link to="/chatbot" className={styles.navLink}>CawFee AI</Link></li>
                                {isAdmin && (
                                    <li>
                                        <Link 
                                            to="/admin" 
                                            className={`${styles.navLink} ${styles.adminLink}`}
                                        >
                                            <AdminPanelSettingsIcon /> Admin
                                        </Link>
                                    </li>
                                )}
                            </>
                        ) : (
                            <>
                                <li><Link to="/login" className={styles.navLink}>Login</Link></li>
                                <li><Link to="/signup" className={styles.navLink}>Sign Up</Link></li>
                            </>
                        )}
                    </>
                )}

                {/* Theme Toggle and Logout - Always visible */}
                <li>
                    <button 
                        onClick={toggleTheme} 
                        className={`${styles.navLink} ${styles.themeToggle}`}
                    >
                        {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
                    </button>
                </li>
                
                {isLoggedIn && (
                    <li>
                        <button 
                            onClick={handleLogout} 
                            className={`${styles.navLink} ${styles.logoutBtn}`}
                        >
                            Logout
                        </button>
                    </li>
                )}
            </ul>
        </nav>
    );
};

export default Navbar;
