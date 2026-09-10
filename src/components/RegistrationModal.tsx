import { useState } from 'react';
import { useI18n } from '../i18n';

interface RegistrationModalProps {
  visible: boolean;
  onClose: () => void;
  onRegister: (username: string) => boolean;
}

export function RegistrationModal({ visible, onClose, onRegister }: RegistrationModalProps) {
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [invalid, setInvalid] = useState(false);
  if (!visible) return null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!onRegister(username)) {
      setInvalid(true);
      return;
    }
    setUsername('');
    setInvalid(false);
  };

  return (
    <div className="registration-overlay" onClick={onClose}>
      <form className="registration-modal" role="dialog" aria-modal="true" aria-labelledby="registration-title" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
        <div className="registration-header">
          <h2 id="registration-title">{t('register.title')}</h2>
          <button type="button" className="registration-close" onClick={onClose} aria-label={t('register.close')}>×</button>
        </div>
        <p>{t('register.description')}</p>
        <label htmlFor="registration-username">{t('register.username')}</label>
        <input
          id="registration-username"
          className="registration-input"
          type="text"
          inputMode="numeric"
          autoComplete="username"
          pattern="[0-9]{11}"
          minLength={11}
          maxLength={11}
          value={username}
          onChange={(event) => {
            setUsername(event.target.value.replace(/\D/g, '').slice(0, 11));
            setInvalid(false);
          }}
          placeholder={t('register.placeholder')}
          aria-describedby="registration-hint"
          aria-invalid={invalid}
          autoFocus
        />
        <p id="registration-hint" className={invalid ? 'registration-error' : 'registration-hint'}>
          {invalid ? t('register.invalid') : t('register.hint')}
        </p>
        <button className="registration-submit" type="submit" disabled={!/^\d{11}$/.test(username)}>{t('register.submit')}</button>
      </form>
    </div>
  );
}
