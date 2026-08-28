
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { PLAN_LIMITS } from '../lib/constants';
import { isAdminEmail } from '../lib/admin';

export type UserPlan = 'FREE' | 'MONTHLY' | 'YEARLY';

export interface PlanStatus {
  plan: UserPlan;
  counts: {
    rss: number;
    radio: number;
    podcast: number;
    youtube: number;
    webcam: number;
    blogs: number;
  };
  isAtLimit: (type: keyof typeof PLAN_LIMITS.FREE) => boolean;
  hasExceeded: boolean;
  canWriteBlog: boolean;
  loading: boolean;
  feedsList: any[];
  radiosList: any[];
}

const PlanContext = createContext<PlanStatus | undefined>(undefined);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState(auth.currentUser);
  const [plan, setPlan] = useState<UserPlan>('FREE');
  const [loading, setLoading] = useState(true);
  const [feedsList, setFeedsList] = useState<any[]>([]);
  const [radiosList, setRadiosList] = useState<any[]>([]);
  const [counts, setCounts] = useState({
    rss: 0,
    radio: 0,
    podcast: 0,
    youtube: 0,
    webcam: 0,
    blogs: 0
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setPlan('FREE');
      setFeedsList([]);
      setRadiosList([]);
      setCounts({ rss: 0, radio: 0, podcast: 0, youtube: 0, webcam: 0, blogs: 0 });
      return;
    }

    setLoading(true);

    // Subscribe to user plan
    const unsubUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        let planValue = data.plan?.toUpperCase() || 'FREE';
        if (planValue === 'KOSTENLOS') planValue = 'FREE';
        if (planValue === 'MONATLICH') planValue = 'MONTHLY';
        if (planValue === 'JÄHRLICH') planValue = 'YEARLY';
        
        // Owner whitelist
        if (isAdminEmail(user?.email)) {
          planValue = 'YEARLY';
        }
        
        setPlan(planValue as UserPlan);
      } else {
        if (isAdminEmail(user?.email)) {
          setPlan('YEARLY');
        }
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      if (isAdminEmail(user?.email)) {
        setPlan('YEARLY');
      }
      setLoading(false);
    });

    // Subscribe to feeds
    const unsubFeeds = onSnapshot(collection(db, 'users', user.uid, 'feeds'), (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setFeedsList(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/feeds`);
    });

    // Subscribe to radioStations
    const unsubRadio = onSnapshot(collection(db, 'users', user.uid, 'radioStations'), (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setRadiosList(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/radioStations`);
    });

    return () => {
      unsubUser();
      unsubFeeds();
      unsubRadio();
    };
  }, [user]);

  // Compute precise combined counts
  useEffect(() => {
    const newCounts = { rss: 0, radio: 0, podcast: 0, youtube: 0, webcam: 0, blogs: 0 };
    feedsList.forEach(feed => {
      const type = (feed.type || '').split('/')[0] || '';
      if (type === 'rss' || type === 'article' || !type) {
        newCounts.rss++;
      } else if (type === 'podcast') {
        newCounts.podcast++;
      } else if (type === 'youtube') {
        newCounts.youtube++;
      } else if (type === 'webcam' || type === 'webcams') {
        newCounts.webcam++;
      } else if (type === 'blog') {
        newCounts.blogs++;
      } else if (type === 'radio') {
        newCounts.radio++;
      }
    });

    // Add radios from radioStations collection
    newCounts.radio += radiosList.length;
    setCounts(newCounts);
  }, [feedsList, radiosList]);

  const isAtLimit = (type: keyof typeof PLAN_LIMITS.FREE) => {
    if (plan !== 'FREE') return false;
    return counts[type] >= PLAN_LIMITS.FREE[type];
  };

  const hasExceeded = plan === 'FREE' && (
    counts.rss > PLAN_LIMITS.FREE.rss ||
    counts.radio > PLAN_LIMITS.FREE.radio ||
    counts.podcast > PLAN_LIMITS.FREE.podcast ||
    counts.youtube > PLAN_LIMITS.FREE.youtube ||
    counts.webcam > PLAN_LIMITS.FREE.webcam ||
    counts.blogs > PLAN_LIMITS.FREE.blogs
  );

  const canWriteBlog = plan !== 'FREE';

  return (
    <PlanContext.Provider value={{ plan, counts, isAtLimit, hasExceeded, canWriteBlog, loading, feedsList, radiosList }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const context = useContext(PlanContext);
  if (context === undefined) {
    throw new Error('usePlan must be used within a PlanProvider');
  }
  return context;
}
