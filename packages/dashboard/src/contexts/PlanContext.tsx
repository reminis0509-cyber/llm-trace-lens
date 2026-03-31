import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { planApi, type PlanInfo, type PlanLimits } from '../api/client';
import { useAuth } from './AuthContext';

type PlanType = 'free' | 'pro' | 'enterprise';

interface PlanContextValue {
  planType: PlanType;
  limits: PlanLimits | null;
  usage: PlanInfo['usage'] | null;
  retentionDays: number;
  loading: boolean;
  isFree: boolean;
  isPro: boolean;
  refresh: () => Promise<void>;
}

const PlanContext = createContext<PlanContextValue>({
  planType: 'pro',
  limits: null,
  usage: null,
  retentionDays: 90,
  loading: true,
  isFree: false,
  isPro: false,
  refresh: async () => {},
});

interface PlanProviderProps {
  children: ReactNode;
}

export function PlanProvider({ children }: PlanProviderProps) {
  const { user } = useAuth();
  const [planType, setPlanType] = useState<PlanType>('pro');
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [usage, setUsage] = useState<PlanInfo['usage'] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    if (!user) {
      setPlanType('pro');
      setLimits(null);
      setUsage(null);
      setLoading(false);
      return;
    }

    try {
      const data = await planApi.getCurrentPlan();
      const type = (data.plan.planType as PlanType) || 'free';
      setPlanType(type);
      setLimits(data.limits);
      setUsage(data.usage);
    } catch {
      // Fail-open: never gate paying users on fetch error
      setPlanType('pro');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const value: PlanContextValue = {
    planType,
    limits,
    usage,
    retentionDays: limits?.retentionDays ?? 90,
    loading,
    isFree: planType === 'free',
    isPro: planType === 'pro',
    refresh: fetchPlan,
  };

  return (
    <PlanContext.Provider value={value}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  return useContext(PlanContext);
}
