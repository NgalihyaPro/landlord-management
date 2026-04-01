import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import api, { getApiErrorMessage } from '@/lib/api';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import profileAccountImage from '@/assets/login/profile-account.png';
import manImage from '@/assets/login/man.png';
import whatsappImage from '@/assets/login/whatsapp.png';
import emailImage from '@/assets/login/email.png';
import houseImage from '@/assets/login/house-picture.jpg';
import './page.css';

const isProduction = import.meta.env.PROD;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [capsLockOn, setCapsLockOn] = useState(false);

  const handleForgotPassword = () => {
    navigate('/forgot-password');
  };

  const clearErrors = () => {
    if (errorMessage) {
      setErrorMessage('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      setErrorMessage('Email and password are required.');
      return;
    }

    setErrorMessage('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', {
        email: normalizedEmail,
        password,
      });
      toast.success(`Welcome back, ${data.user.full_name}!`);
      login(data.user);
    } catch (err: any) {
      const message = getApiErrorMessage(err, 'Invalid credentials');
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp-login-page">
      <div className="lp-page-wrapper">
        <div className="lp-left-side">
          <div className="lp-form-container">
            <div className="lp-hero-header">
              <h1>
                Welcome <span className="lp-hero-accent">back!</span>
              </h1>
              <p className="lp-subtitle">
                The intelligent, modern property management system designed exclusively for proactive <strong>landlords</strong>.
              </p>
            </div>

            <form className="lp-login-form" onSubmit={handleSubmit}>
              <div className="lp-input-group">
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearErrors();
                  }}
                  placeholder="Email address"
                />
              </div>

              <div className="lp-input-group">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearErrors();
                  }}
                  onKeyUp={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                  onKeyDown={(e) => setCapsLockOn(e.getModifierState('CapsLock'))}
                  placeholder="Password"
                />
                <button
                  type="button"
                  className="lp-password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeSlashIcon className="lp-password-toggle-icon" /> : <EyeIcon className="lp-password-toggle-icon" />}
                </button>
              </div>

              {capsLockOn && <p className="lp-caps-lock">Caps Lock is on.</p>}

              <div className="lp-forgot-password">
                <button type="button" onClick={handleForgotPassword}>
                  Forgot Password?
                </button>
              </div>

              {errorMessage && <div className="lp-error-message">{errorMessage}</div>}

              <button type="submit" className="lp-btn-login" disabled={loading}>
                {loading ? 'Signing in...' : 'Login'}
              </button>
            </form>

            {!isProduction && (
              <div className="lp-dev-access">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('manager@landlordpro.com');
                    setPassword('Manager123!');
                    setErrorMessage('');
                  }}
                >
                  Auto-fill Manager
                </button>
              </div>
            )}

            <div className="lp-support-box">
              <div className="lp-support-section">
                <div className="lp-support-icon lp-support-icon-avatar">
                  <img src={profileAccountImage} alt="Account" className="lp-support-avatar-img" />
                </div>
                <div className="lp-support-text">
                  <strong>Having trouble logging in?</strong>
                  <p>For password reset, account support, or access issues, please contact the System Administrator.</p>
                </div>
              </div>

              <div className="lp-support-divider" />

              <div className="lp-support-section">
                <div className="lp-support-icon lp-support-icon-avatar">
                  <img src={manImage} alt="User" className="lp-support-avatar-img" />
                </div>
                <div className="lp-support-text">
                  <strong>Need an account?</strong>
                  <p>New user registration is handled by the System Administrator. Please contact the administrator to create your account.</p>
                </div>
              </div>

              <div className="lp-support-contact">
                <a href="https://wa.me/255713384932" className="lp-contact-chip" target="_blank" rel="noreferrer">
                  <img src={whatsappImage} alt="WhatsApp" className="lp-contact-chip-icon" />
                  <span>+255 713 384 932</span>
                </a>
                <a href="mailto:alfredlucas753@gmail.com" className="lp-contact-chip">
                  <img src={emailImage} alt="Email" className="lp-contact-chip-icon" />
                  <span>alfredlucas753@gmail.com</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="lp-right-side">
          <div className="lp-green-panel">
            <div className="lp-panel-badge">
              <img src={houseImage} alt="Property" className="lp-panel-badge-img" />
              <div className="lp-panel-badge-text">
                <span className="lp-panel-badge-name">LandlordPro</span>
                <span className="lp-panel-badge-sub">Property Management</span>
              </div>
            </div>

            <div className="lp-illustration-area">
              <div className="lp-avatar-top">
                <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Lucky&backgroundColor=transparent" alt="Avatar" />
              </div>

              <div className="lp-avatar-right">
                <img src="https://api.dicebear.com/7.x/notionists/svg?seed=Luna&backgroundColor=transparent" alt="Avatar" />
              </div>

              <div className="lp-floating-card">
                <div className="lp-fc-title">Rent Collection</div>
                <div className="lp-fc-subtitle">14 Properties</div>
                <div className="lp-fc-bottom">
                  <span className="lp-fc-tag">Payments</span>
                  <span className="lp-fc-circle">92%</span>
                </div>
              </div>

              <div className="lp-main-illustration">
                <div className="lp-house-ring-outer">
                  <div className="lp-house-ring-inner">
                    <img src={houseImage} alt="Property" className="lp-house-photo" />
                  </div>
                </div>
              </div>
            </div>

            <div className="lp-illustration-text-area">
              <div className="lp-slider-dots">
                <span className="lp-dot" />
                <span className="lp-dot lp-dot-active" />
                <span className="lp-dot" />
              </div>
              <h2 className="lp-green-panel-text">
                Manage your properties effortlessly with <strong>LandlordPro</strong>
              </h2>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
