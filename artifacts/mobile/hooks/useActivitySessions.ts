import { useEffect, useState } from 'react';
import {
  listInProgressActivities,
  loadActivitySessions,
  subscribeActivitySessions,
  type ActivitySessionRecord,
} from '@/lib/activitySessions';

export function useInProgressActivities(): ActivitySessionRecord[] {
  const [items, setItems] = useState<ActivitySessionRecord[]>(() =>
    listInProgressActivities(),
  );

  useEffect(() => {
    void loadActivitySessions().then(() => {
      setItems(listInProgressActivities());
    });
    return subscribeActivitySessions(() => {
      setItems(listInProgressActivities());
    });
  }, []);

  return items;
}
