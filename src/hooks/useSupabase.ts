"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDateAsLocalISO, getTodayLocalDate } from '@/lib/utils';

const PRELOAD_RADIUS_DAYS = 5;
const hasCacheKey = (record: Record<string, unknown>, key: string) =>
    Object.prototype.hasOwnProperty.call(record, key);
const dedupeFoodLogsById = (logs: any[]) => {
    const seen = new Set<string>();
    return logs.filter(log => {
        const id = String(log?.id ?? '');
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
    });
};
const dedupeIds = (ids: string[]) => {
    const seen = new Set<string>();
    const output: string[] = [];
    ids.forEach(id => {
        if (seen.has(id)) return;
        seen.add(id);
        output.push(id);
    });
    return output;
};

// In-memory cache to prevent 0-reset flickering during day transitions
const globalCache: {
    profiles: Record<string, any>;
    foodLogs: Record<string, any[]>;
    waterLogs: Record<string, number>;
    waterLogIds: Record<string, string[]>;
} = {
    profiles: {},
    foodLogs: {},
    waterLogs: {},
    waterLogIds: {}
};

export function usePreloader(userId: string | null, centerDate: string) {
    useEffect(() => {
        if (!userId || !centerDate) return;

        async function preloadRange() {
            const center = new Date(centerDate + "T12:00:00");
            const datesToLoad: string[] = [];
            for (let i = -PRELOAD_RADIUS_DAYS; i <= PRELOAD_RADIUS_DAYS; i++) {
                const d = new Date(center);
                d.setDate(center.getDate() + i);
                const ds = formatDateAsLocalISO(d);
                const cacheKey = `${userId}:${ds}`;
                const missingFood = !hasCacheKey(globalCache.foodLogs, cacheKey);
                const missingWaterCount = !hasCacheKey(globalCache.waterLogs, cacheKey);
                const missingWaterIds = !hasCacheKey(globalCache.waterLogIds, cacheKey);

                if (missingFood || missingWaterCount || missingWaterIds) {
                    datesToLoad.push(ds);
                }
            }

            if (datesToLoad.length === 0) return;

            const startDate = datesToLoad[0];
            const endDate = datesToLoad[datesToLoad.length - 1];
            const rangeDates: string[] = [];
            const start = new Date(startDate + "T12:00:00");
            const end = new Date(endDate + "T12:00:00");
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                rangeDates.push(formatDateAsLocalISO(new Date(d)));
            }

            const [foodRes, waterRes] = await Promise.all([
                supabase
                    .from('food_logs')
                    .select(`
                        *,
                        food_items (*),
                        recipes (
                            *,
                            recipe_ingredients (
                                *,
                                food_items (*)
                            )
                        )
                    `)
                    .eq('user_id', userId)
                    .gte('fecha', startDate)
                    .lte('fecha', endDate),
                supabase
                    .from('water_logs')
                    .select('id, fecha')
                    .eq('user_id', userId)
                    .gte('fecha', startDate)
                    .lte('fecha', endDate)
                    .order('created_at', { ascending: true })
            ]);

            // Initialize missing keys so next render can read cache instantly.
            datesToLoad.forEach(d => {
                const key = `${userId}:${d}`;
                if (!hasCacheKey(globalCache.foodLogs, key)) {
                    globalCache.foodLogs[key] = [];
                }
                if (!hasCacheKey(globalCache.waterLogs, key)) {
                    globalCache.waterLogs[key] = 0;
                }
                if (!hasCacheKey(globalCache.waterLogIds, key)) {
                    globalCache.waterLogIds[key] = [];
                }
            });

            const foodData = foodRes.data;
            if (foodData) {
                rangeDates.forEach(d => {
                    globalCache.foodLogs[`${userId}:${d}`] = [];
                });
                foodData.forEach(log => {
                    const k = `${userId}:${log.fecha}`;
                    if (!globalCache.foodLogs[k]) globalCache.foodLogs[k] = [];
                    globalCache.foodLogs[k].push(log);
                });
                rangeDates.forEach(d => {
                    const key = `${userId}:${d}`;
                    globalCache.foodLogs[key] = dedupeFoodLogsById(globalCache.foodLogs[key] || []);
                });
            }

            const waterData = waterRes.data;
            if (waterData) {
                rangeDates.forEach(d => {
                    const key = `${userId}:${d}`;
                    globalCache.waterLogs[key] = 0;
                    globalCache.waterLogIds[key] = [];
                });
                waterData.forEach(log => {
                    const k = `${userId}:${log.fecha}`;
                    globalCache.waterLogs[k] = (globalCache.waterLogs[k] || 0) + 1;
                    if (!globalCache.waterLogIds[k]) globalCache.waterLogIds[k] = [];
                    globalCache.waterLogIds[k].push(log.id);
                });
                rangeDates.forEach(d => {
                    const key = `${userId}:${d}`;
                    const deduped = dedupeIds(globalCache.waterLogIds[key] || []);
                    globalCache.waterLogIds[key] = deduped;
                    globalCache.waterLogs[key] = deduped.length;
                });
            }
        }

        preloadRange();
    }, [userId, centerDate]);
}

export function useProfile(userId?: string) {
    const [profile, setProfile] = useState<any>(userId ? globalCache.profiles[userId] : null);
    const [loading, setLoading] = useState(!profile);

    useEffect(() => {
        if (!userId) return;

        async function fetchProfile() {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (data) {
                // Streak Logic
                const today = getTodayLocalDate();
                const lastDate = data.ultima_fecha_registro;
                let currentStreak = data.racha_actual || 0;

                if (lastDate) {
                    const last = new Date(lastDate + "T12:00:00");
                    const now = new Date(today + "T12:00:00");
                    const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

                    if (diffDays > 1) {
                        // Lost streak
                        currentStreak = 0;
                        await supabase.from('profiles').update({ racha_actual: 0 }).eq('id', userId);
                    }
                }

                const updatedProfile = { ...data, racha_actual: currentStreak };
                globalCache.profiles[userId!] = updatedProfile;
                setProfile(updatedProfile);
            }
            setLoading(false);
        }

        fetchProfile();
    }, [userId]);

    const updateStreak = async () => {
        if (!userId || !profile) return;

        const today = getTodayLocalDate();
        const lastDate = profile.ultima_fecha_registro;

        if (lastDate === today) return; // Already updated today

        let newStreak = (profile.racha_actual || 0) + 1;

        // Check if it was consecutive
        if (lastDate) {
            const last = new Date(lastDate + "T12:00:00");
            const now = new Date(today + "T12:00:00");
            const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > 1) newStreak = 1;
        }

        const { error } = await supabase
            .from('profiles')
            .update({
                racha_actual: newStreak,
                ultima_fecha_registro: today
            })
            .eq('id', userId);

        if (!error) {
            const nextProfile = { ...profile, racha_actual: newStreak, ultima_fecha_registro: today };
            globalCache.profiles[userId!] = nextProfile;
            setProfile(nextProfile);
        }
    };

    const fetchProfile = async () => {
        if (!userId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.error("Error fetching profile:", error);
        } else {
            globalCache.profiles[userId!] = data;
            setProfile(data);
        }
        setLoading(false);
    };

    const updateMealOrder = async (newOrder: string[]) => {
        if (!userId) return;
        const { error } = await supabase
            .from('profiles')
            .update({ orden_comidas: newOrder })
            .eq('id', userId);

        if (error) {
            console.error("Error updating meal order:", error);
            throw error;
        }
        const nextProfile = { ...profile, orden_comidas: newOrder };
        globalCache.profiles[userId!] = nextProfile;
        setProfile(nextProfile);
    };

    return { profile, loading, updateStreak, updateMealOrder, refetchProfile: fetchProfile };
}

export function useFoodLogs(userId?: string, date?: string) {
    const cacheKey = `${userId}:${date}`;
    const hasCachedLogs = Boolean(date && hasCacheKey(globalCache.foodLogs, cacheKey));
    const [logs, setLogs] = useState<any[]>(hasCachedLogs ? dedupeFoodLogsById(globalCache.foodLogs[cacheKey]) : []);
    const [loading, setLoading] = useState(Boolean(date && !hasCachedLogs));

    const fetchLogs = useCallback(async ({ force = false, background = false } = {}) => {
        if (!userId || !date) return;

        const cached = hasCacheKey(globalCache.foodLogs, cacheKey);
        if (cached && !force) {
            if (!background) {
                const cachedLogs = dedupeFoodLogsById(globalCache.foodLogs[cacheKey] || []);
                globalCache.foodLogs[cacheKey] = cachedLogs;
                setLogs(cachedLogs);
                setLoading(false);
            }
            return;
        }

        if (!background) setLoading(true);
        const { data, error } = await supabase
            .from('food_logs')
            .select(`
                *,
                food_items (*),
                recipes (
                    *,
                    recipe_ingredients (
                        *,
                        food_items (*)
                    )
                )
            `)
            .eq('user_id', userId)
            .eq('fecha', date);

        if (error) {
            console.error("Error fetching food logs:", error);
        }
        const nextData = dedupeFoodLogsById(data || []);
        globalCache.foodLogs[cacheKey] = nextData;
        setLogs(nextData);
        if (!background) setLoading(false);
    }, [userId, date, cacheKey]);

    useEffect(() => {
        if (!date) {
            setLogs([]);
            setLoading(false);
            return;
        }

        if (hasCacheKey(globalCache.foodLogs, cacheKey)) {
            const cachedLogs = dedupeFoodLogsById(globalCache.foodLogs[cacheKey] || []);
            globalCache.foodLogs[cacheKey] = cachedLogs;
            setLogs(cachedLogs);
            setLoading(false);
            fetchLogs({ force: true, background: true });
            return;
        }

        setLogs([]);
        setLoading(true);
        fetchLogs();
    }, [cacheKey, date, fetchLogs]);

    return {
        logs, loading, refetch: fetchLogs, setLogs: (newLogsOrFn: any) => {
            if (typeof newLogsOrFn === 'function') {
                setLogs(prev => {
                    const next = dedupeFoodLogsById(newLogsOrFn(prev));
                    if (date) globalCache.foodLogs[cacheKey] = next;
                    return next;
                });
            } else {
                const next = dedupeFoodLogsById(newLogsOrFn || []);
                if (date) globalCache.foodLogs[cacheKey] = next;
                setLogs(next);
            }
        }
    };
}

export function useFoodLogActions() {
    const toggleConsumed = async (logId: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('food_logs')
            .update({ consumido: !currentStatus })
            .eq('id', logId);

        if (error) {
            console.error("Error toggling consumed status:", error);
            throw error;
        }
    };

    const toggleAllConsumed = async (userId: string, date: string, mealType: string, status: boolean) => {
        const { error } = await supabase
            .from('food_logs')
            .update({ consumido: status })
            .eq('user_id', userId)
            .eq('fecha', date)
            .eq('comida_tipo', mealType);

        if (error) {
            console.error("Error toggling all consumed status:", error);
            throw error;
        }
    };

    const renameMealType = async (userId: string, date: string, oldName: string, newName: string) => {
        const { error } = await supabase
            .from('food_logs')
            .update({ comida_tipo: newName })
            .eq('user_id', userId)
            .eq('fecha', date)
            .eq('comida_tipo', oldName);

        if (error) {
            console.error("Error renaming meal type:", error);
            throw error;
        }
    };

    const deleteMealLogs = async (userId: string, date: string, mealType: string) => {
        const { error } = await supabase
            .from('food_logs')
            .delete()
            .eq('user_id', userId)
            .eq('fecha', date)
            .eq('comida_tipo', mealType);

        if (error) {
            console.error("Error deleting meal logs:", error);
            throw error;
        }
    };

    const deleteAllLogsForDay = async (userId: string, date: string) => {
        const { error } = await supabase
            .from('food_logs')
            .delete()
            .eq('user_id', userId)
            .eq('fecha', date);

        if (error) {
            console.error("Error deleting all logs for day:", error);
            throw error;
        }
    };

    return { toggleConsumed, toggleAllConsumed, renameMealType, deleteMealLogs, deleteAllLogsForDay };
}

export function useWaterLogs(userId?: string, date?: string) {
    const cacheKey = `${userId}:${date}`;
    const hasCachedWater = Boolean(
        date &&
        hasCacheKey(globalCache.waterLogs, cacheKey) &&
        hasCacheKey(globalCache.waterLogIds, cacheKey)
    );
    const [glasses, setGlasses] = useState(hasCachedWater ? dedupeIds(globalCache.waterLogIds[cacheKey]).length : 0);
    const [waterLogIds, setWaterLogIds] = useState<string[]>(hasCachedWater ? dedupeIds(globalCache.waterLogIds[cacheKey]) : []);
    const [loading, setLoading] = useState(Boolean(date && !hasCachedWater));

    const fetchWater = useCallback(async ({ force = false, background = false } = {}) => {
        if (!userId || !date) return;

        const cached = hasCacheKey(globalCache.waterLogs, cacheKey) && hasCacheKey(globalCache.waterLogIds, cacheKey);
        if (cached && !force) {
            if (!background) {
                const ids = dedupeIds(globalCache.waterLogIds[cacheKey] || []);
                globalCache.waterLogIds[cacheKey] = ids;
                globalCache.waterLogs[cacheKey] = ids.length;
                setGlasses(ids.length);
                setWaterLogIds(ids);
                setLoading(false);
            }
            return;
        }

        if (!background) setLoading(true);
        const { data, error } = await supabase
            .from('water_logs')
            .select('id')
            .eq('user_id', userId)
            .eq('fecha', date)
            .order('created_at', { ascending: true });

        if (error) {
            console.error("Error fetching water logs:", error);
        }

        const rows = data || [];
        const ids = dedupeIds(rows.map(d => d.id));
        const count = ids.length;
        globalCache.waterLogIds[cacheKey] = ids;
        globalCache.waterLogs[cacheKey] = count;
        setGlasses(count);
        setWaterLogIds(ids);
        if (!background) setLoading(false);
    }, [userId, date, cacheKey]);

    useEffect(() => {
        if (!date) {
            setGlasses(0);
            setWaterLogIds([]);
            setLoading(false);
            return;
        }

        const cached = hasCacheKey(globalCache.waterLogs, cacheKey) && hasCacheKey(globalCache.waterLogIds, cacheKey);
        if (cached) {
            const ids = dedupeIds(globalCache.waterLogIds[cacheKey] || []);
            globalCache.waterLogIds[cacheKey] = ids;
            globalCache.waterLogs[cacheKey] = ids.length;
            setGlasses(ids.length);
            setWaterLogIds(ids);
            setLoading(false);
            fetchWater({ force: true, background: true });
            return;
        }

        setGlasses(0);
        setWaterLogIds([]);
        setLoading(true);
        fetchWater();
    }, [cacheKey, date, fetchWater]);

    const addGlass = async () => {
        if (!userId || !date) {
            console.warn('addGlass: no userId or date', { userId, date });
            return;
        }
        // Optimistic update
        const nextCount = glasses + 1;
        setGlasses(nextCount);
        if (date) globalCache.waterLogs[cacheKey] = nextCount;

        const { data, error } = await supabase
            .from('water_logs')
            .insert({ user_id: userId, cantidad_litros: 0.25, fecha: date })
            .select('id')
            .single();

        if (error) {
            console.error('Water add error:', error);
            // Revert on failure
            const revertCount = glasses;
            setGlasses(revertCount);
            if (date) globalCache.waterLogs[cacheKey] = revertCount;
            return;
        }
        if (data) {
            const nextIds = dedupeIds([...waterLogIds, data.id]);
            setWaterLogIds(nextIds);
            if (date) {
                globalCache.waterLogIds[cacheKey] = nextIds;
                globalCache.waterLogs[cacheKey] = nextIds.length;
            }
        }
    };

    const removeGlass = async () => {
        if (!userId || !date || waterLogIds.length === 0) return;
        const lastId = waterLogIds[waterLogIds.length - 1];
        // Optimistic update
        const nextCount = Math.max(0, glasses - 1);
        const nextIds = waterLogIds.slice(0, -1);

        setGlasses(nextCount);
        setWaterLogIds(nextIds);
        if (date) {
            globalCache.waterLogs[cacheKey] = nextCount;
            globalCache.waterLogIds[cacheKey] = nextIds;
        }

        const { error } = await supabase
            .from('water_logs')
            .delete()
            .eq('id', lastId);

        if (error) {
            console.error('Water remove error:', error);
            // Revert on failure
            const revertCount = glasses;
            const revertIds = [...nextIds, lastId];
            setGlasses(revertCount);
            setWaterLogIds(revertIds);
            if (date) {
                globalCache.waterLogs[cacheKey] = revertCount;
                globalCache.waterLogIds[cacheKey] = revertIds;
            }
        }
    };

    return { glasses, loading, addGlass, removeGlass };
}

export function useRecipes(userId?: string) {
    const [recipes, setRecipes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRecipes = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('recipes')
            .select(`
                *,
                recipe_ingredients (
                    *,
                    food_items (*)
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) console.error("Error fetching recipes:", error);
        if (data) setRecipes(data);
        setLoading(false);
    }, [userId]);

    useEffect(() => {
        fetchRecipes();
    }, [fetchRecipes]);

    return { recipes, loading, refetch: fetchRecipes };
}

export function useRecipe(recipeId?: string) {
    const [recipe, setRecipe] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!recipeId) return;

        async function fetchRecipe() {
            setLoading(true);
            const { data, error } = await supabase
                .from('recipes')
                .select(`
                    *,
                    recipe_ingredients (
                        *,
                        food_items (*)
                    )
                `)
                .eq('id', recipeId)
                .single();

            if (data) setRecipe(data);
            setLoading(false);
        }

        fetchRecipe();
    }, [recipeId]);

    return { recipe, loading };
}

export function useAnalytics(userId?: string) {
    const [weightData, setWeightData] = useState<any[]>([]);
    const [calorieData, setCalorieData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAnalytics = useCallback(async () => {
        if (!userId) return;
        setLoading(true);

        // Fetch weight logs - last 365 days
        const yearAgo = new Date();
        yearAgo.setDate(yearAgo.getDate() - 365);

        const { data: weights } = await supabase
            .from('weight_logs')
            .select('*')
            .eq('user_id', userId)
            .gte('fecha', formatDateAsLocalISO(yearAgo))
            .order('fecha', { ascending: true });

        if (weights) setWeightData(weights);

        // Fetch food logs aggregated by date
        const { data: foodLogs } = await supabase
            .from('food_logs')
            .select(`
                fecha,
                gramos,
                food_items (kcal),
                recipes (
                    porciones,
                    recipe_ingredients (
                        gramos,
                        food_items (kcal)
                    )
                )
            `)
            .eq('user_id', userId)
            .gte('fecha', formatDateAsLocalISO(yearAgo));

        if (foodLogs) {
            // Processing logic will be done in the component for flexibility
            setCalorieData(foodLogs);
        }

        setLoading(false);
    }, [userId]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    return { weightData, calorieData, loading, refetch: fetchAnalytics };
}
