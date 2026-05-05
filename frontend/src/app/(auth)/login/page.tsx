import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import api, { getApiErrorMessage, getGoogleAuthUrl } from '@/lib/api';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import profileAccountImage from '@/assets/login/profile-account.png';
import manImage from '@/assets/login/man.png';
import whatsappImage from '@/assets/login/whatsapp.png';
import emailImage from '@/assets/login/email.png';
import houseImage from '@/assets/login/house-picture.jpg';
import avatarLuckyImage from '@/assets/login/avatar-lucky.svg';
import avatarLunaImage from '@/assets/login/avatar-luna.svg';
import './page.css';
import { useLanguage } from '@/context/LanguageContext';

const isProduction = import.meta.env.PROD;

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const tx = t('auth.login');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [capsLockOn, setCapsLockOn] = useState(false);

  useEffect(() => {
    const googleError = searchParams.get('google_error');
    if (googleError) {
      setErrorMessage(googleError);
      toast.error(googleError);
    }
  }, [searchParams]);

  const handleForgotPassword = () => {
    navigate('/forgot-password');
  };

  const handleGoogleLogin = () => {
    window.location.href = getGoogleAuthUrl('login');
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
      setErrorMessage(tx.error_required);
      return;
    }

    setErrorMessage('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', {
        email: normalizedEmail,
        password,
      });
      toast.success(`${tx.welcome_back} ${data.user.full_name}!`);
      login(data.user);
    } catch (err: any) {
      const message = getApiErrorMessage(err, tx.error_invalid);
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
                {tx.title.split(' ')[0]} <span className="lp-hero-accent">{tx.title.split(' ').slice(1).join(' ')}</span>
              </h1>
              <p className="lp-subtitle">
                {tx.subtitle}
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
                  placeholder={tx.email_placeholder}
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
                  placeholder={tx.password_placeholder}
                />
                <button
                  type="button"
                  className="lp-password-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? tx.hide_password : tx.show_password}
                >
                  {showPassword ? <EyeSlashIcon className="lp-password-toggle-icon" /> : <EyeIcon className="lp-password-toggle-icon" />}
                </button>
              </div>

              {capsLockOn && <p className="lp-caps-lock">{tx.caps_lock}</p>}

              <div className="lp-forgot-password">
                <button type="button" onClick={handleForgotPassword}>
                  {tx.forgot_password}
                </button>
              </div>

              {errorMessage && <div className="lp-error-message">{errorMessage}</div>}

              <button type="submit" className="lp-btn-login" disabled={loading}>
                {loading ? tx.signing_in : tx.login_button}
              </button>
            </form>

            <div className="lp-auth-divider">
              <span>or</span>
            </div>

            <button type="button" className="lp-btn-google" onClick={handleGoogleLogin}>
              <span className="lp-google-mark">G</span>
              Continue with Google
            </button>

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
                  {tx.dev_autofill}
                </button>
              </div>
            )}

            <div className="lp-support-box">
              <div className="lp-support-section">
                <div className="lp-support-icon lp-support-icon-avatar">
                  <img src={profileAccountImage} alt="Account" className="lp-support-avatar-img" />
                </div>
                <div className="lp-support-text">
                  <strong>{tx.support_login_title}</strong>
                  <p>{tx.support_login_text}</p>
                </div>
              </div>

              <div className="lp-support-divider" />

              <div className="lp-support-section">
                <div className="lp-support-icon lp-support-icon-avatar">
                  <img src={manImage} alt="User" className="lp-support-avatar-img" />
                </div>
                <div className="lp-support-text">
                  <strong>{tx.support_account_title}</strong>
                  <p>{tx.support_account_text}</p>
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
                <span className="lp-panel-badge-sub">{tx.panel_subtitle}</span>
              </div>
            </div>

            <div className="lp-illustration-area">
              <div className="lp-avatar-top">
                <img src={avatarLuckyImage} alt="Avatar" />
              </div>

              <div className="lp-avatar-right">
                <img src={avatarLunaImage} alt="Avatar" />
              </div>

              <div className="lp-floating-card">
                <div className="lp-fc-title">{tx.panel_card_title}</div>
                <div className="lp-fc-subtitle">{tx.panel_card_subtitle}</div>
                <div className="lp-fc-bottom">
                  <span className="lp-fc-tag">{tx.panel_card_tag}</span>
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
              <h2 className="lp-green-panel-text">{tx.panel_bottom_text}</h2>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
