/**
 * MY HIKES (story MH-20, mockup docs/mockups/register-a-hike): the hikes registered by the hiker who is logged in, in order
 * of departure, the past ones too (a hike has no status yet). Register a hike opens a dialog; a saved hike is emailed to the
 * hiker, and the dialog closes with the new hike in its place in the list. A hike has no buttons: completing it (MH-22) and
 * updating it (MH-27) are other stories. The navbar and Log out come from AppLayout.
 * Only hikers have hikes: the route is wrapped in RequireRole. If the session ends meanwhile (401), the login follows.
 */
import { Navigate, useNavigate } from 'react-router-dom';
import { Alert } from '../../components/Alert/Alert.jsx';
import { Button } from '../../components/Button/Button.jsx';
import { HikeCard } from '../../components/HikeCard/HikeCard.jsx';
import { RegisterHikeDialog } from '../../components/RegisterHikeDialog/RegisterHikeDialog.jsx';
import { useAuth } from '../../hooks/useAuth.js';
import { useMyHikes } from '../../hooks/useMyHikes.js';
import { useRegisterHike } from '../../hooks/useRegisterHike.js';
import { HUT_LABEL } from '../../lib/hikes.js';
import styles from './MyHikesPage.module.css';

const GOOD_TO_KNOW = [
  'Register your hike before you set off, with the time you leave and the time you expect to be back.',
  'You can register more than one hike, but two hikes cannot overlap in time.',
  'Every registered hike is confirmed by email.',
  'This helps the hut, but it does not replace rescue services.',
];

const LOGIN_STATE = { from: '/hikes', page: 'see your hikes' };

// The dialog is mounted only while it is open, so every opening starts empty.
function RegisterHike({ list }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const form = useRegisterHike({ onRegistered: (hike) => list.registered(hike, user.email) });

  const save = async () => {
    if ((await form.save()) === 'login') navigate('/login', { state: LOGIN_STATE });
  };

  return <RegisterHikeDialog form={form} onClose={() => !form.isPending && list.closeRegister()} onSave={save} />;
}

export function MyHikesPage() {
  const list = useMyHikes();

  if (list.loggedOut) return <Navigate to="/login" replace state={LOGIN_STATE} />;

  return (
    <div className={styles.screen}>
      <main className={styles.page}>
        <div className={styles.main}>
          <header className={styles.intro}>
            <div className={styles.heading}>
              <p className={styles.eyebrow}>{HUT_LABEL}</p>
              <h1 className={styles.title}>My hikes</h1>
              <p className={styles.subtitle}>Your registered hikes, by departure date.</p>
            </div>
            {list.hikes?.length > 0 && (
              <Button size="small" className={styles.register} onClick={list.openRegister}>
                Register a hike
              </Button>
            )}
          </header>

          {list.notice && <Alert variant="info">{list.notice}</Alert>}
          {list.alert && (
            <Alert>
              {list.alert}{' '}
              <button type="button" className={styles.retry} onClick={list.reload}>Try again</button>
            </Alert>
          )}

          {list.isLoading && <p className={styles.hint}>Loading your hikes…</p>}

          {list.hikes?.length === 0 && (
            <section className={styles.empty}>
              <h2 className={styles.emptyTitle}>No registered hikes.</h2>
              <p className={styles.hint}>
                Hikes you register will appear here, with the times you expect to leave and to be back.
              </p>
              <Button size="small" className={styles.registerEmpty} onClick={list.openRegister}>
                Register a hike
              </Button>
            </section>
          )}

          {list.hikes?.length > 0 && (
            <ul className={styles.list} aria-label="Your hikes">
              {list.hikes.map((hike) => (
                <HikeCard key={hike.id} hike={hike} />
              ))}
            </ul>
          )}
        </div>

        <aside className={styles.know} aria-labelledby="good-to-know">
          <h2 id="good-to-know" className={styles.knowTitle}>Good to know</h2>
          <ul className={styles.knowList}>
            {GOOD_TO_KNOW.map((text) => (
              <li key={text} className={styles.knowItem}>
                <span className={styles.blaze} aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        </aside>
      </main>

      {list.registering && <RegisterHike list={list} />}
    </div>
  );
}
