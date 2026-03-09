"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { formatDateAsLocalISO, getTodayLocalDate } from '@/lib/utils';
import { getWeekStart, type DayTemplate, type MealTemplate, type PlanEntry, type ShoppingListItem, type WeeklyPlan } from '@/lib/planning';

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
const buildWeeklyPlanMap = (entries: PlanEntry[]) => {
    return entries.reduce((acc: Record<string, PlanEntry[]>, entry: PlanEntry) => {
        const key = entry.plan_date;
        if (!acc[key]) acc[key] = [];
        acc[key].push(entry);
        return acc;
    }, {});
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
            const { data } = await supabase
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
    const requestSeqRef = useRef(0);
    const activeKeyRef = useRef(cacheKey);

    useEffect(() => {
        activeKeyRef.current = cacheKey;
    }, [cacheKey]);

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

        const requestId = ++requestSeqRef.current;
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
        if (requestId !== requestSeqRef.current || activeKeyRef.current !== cacheKey) {
            return;
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
    const requestSeqRef = useRef(0);
    const activeKeyRef = useRef(cacheKey);

    useEffect(() => {
        activeKeyRef.current = cacheKey;
    }, [cacheKey]);

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

        const requestId = ++requestSeqRef.current;
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
        if (requestId !== requestSeqRef.current || activeKeyRef.current !== cacheKey) {
            return;
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
        if (!userId) {
            setRecipes([]);
            setLoading(false);
            return;
        }
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
            const { data } = await supabase
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

export function useFavorites(userId?: string) {
    const [favorites, setFavorites] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchFavorites = useCallback(async () => {
        if (!userId) {
            setFavorites([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const { data, error } = await supabase
            .from('favorite_foods')
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
            .order('last_used_at', { ascending: false });

        if (error) console.error("Error fetching favorites:", error);
        setFavorites(data || []);
        setLoading(false);
    }, [userId]);

    useEffect(() => {
        fetchFavorites();
    }, [fetchFavorites]);

    const toggleFavorite = async (target: { foodId?: string | null; recipeId?: string | null }) => {
        if (!userId) return false;
        const column = target.foodId ? 'food_id' : 'recipe_id';
        const value = target.foodId || target.recipeId;
        if (!value) return false;

        const existing = favorites.find((entry) => entry[column] === value);
        if (existing) {
            const { error } = await supabase.from('favorite_foods').delete().eq('id', existing.id);
            if (error) {
                console.error("Error removing favorite:", error);
                return false;
            }
            setFavorites((prev) => prev.filter((entry) => entry.id !== existing.id));
            return false;
        }

        const payload = {
            user_id: userId,
            food_id: target.foodId || null,
            recipe_id: target.recipeId || null,
            last_used_at: new Date().toISOString()
        };
        const { data, error } = await supabase
            .from('favorite_foods')
            .insert(payload)
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
            .single();

        if (error) {
            console.error("Error creating favorite:", error);
            return false;
        }
        setFavorites((prev) => [data, ...prev]);
        return true;
    };

    return { favorites, loading, refetch: fetchFavorites, toggleFavorite };
}

export function useTemplates(userId?: string) {
    const [mealTemplates, setMealTemplates] = useState<MealTemplate[]>([]);
    const [dayTemplates, setDayTemplates] = useState<DayTemplate[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTemplates = useCallback(async () => {
        if (!userId) {
            setMealTemplates([]);
            setDayTemplates([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const [mealRes, dayRes] = await Promise.all([
            supabase
                .from('meal_templates')
                .select(`
                    *,
                    meal_template_items (
                        *,
                        food_items (*),
                        recipes (
                            *,
                            recipe_ingredients (
                                *,
                                food_items (*)
                            )
                        )
                    )
                `)
                .eq('user_id', userId)
                .order('updated_at', { ascending: false }),
            supabase
                .from('day_templates')
                .select(`
                    *,
                    day_template_items (
                        *,
                        food_items (*),
                        recipes (
                            *,
                            recipe_ingredients (
                                *,
                                food_items (*)
                            )
                        )
                    )
                `)
                .eq('user_id', userId)
                .order('updated_at', { ascending: false })
        ]);

        if (mealRes.error) console.error("Error fetching meal templates:", mealRes.error);
        if (dayRes.error) console.error("Error fetching day templates:", dayRes.error);
        setMealTemplates((mealRes.data || []) as MealTemplate[]);
        setDayTemplates((dayRes.data || []) as DayTemplate[]);
        setLoading(false);
    }, [userId]);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    const saveMealTemplate = async (name: string, mealType: string, items: any[]) => {
        if (!userId) return null;
        const { data: template, error } = await supabase
            .from('meal_templates')
            .insert({ user_id: userId, name, meal_type: mealType })
            .select()
            .single();
        if (error || !template) {
            console.error("Error saving meal template:", error);
            return null;
        }

        const rows = items.map((item, index) => ({
            meal_template_id: template.id,
            food_id: item.food_id || null,
            recipe_id: item.recipe_id || null,
            gramos: item.gramos,
            original_cantidad: item.original_cantidad ?? null,
            original_unidad: item.original_unidad ?? null,
            position: index
        }));
        if (rows.length > 0) {
            const { error: itemsError } = await supabase.from('meal_template_items').insert(rows);
            if (itemsError) {
                console.error("Error saving meal template items:", itemsError);
            }
        }
        await fetchTemplates();
        return template.id;
    };

    const saveDayTemplate = async (name: string, dayType: string, items: any[]) => {
        if (!userId) return null;
        const { data: template, error } = await supabase
            .from('day_templates')
            .insert({ user_id: userId, name, day_type: dayType })
            .select()
            .single();
        if (error || !template) {
            console.error("Error saving day template:", error);
            return null;
        }

        const rows = items.map((item, index) => ({
            day_template_id: template.id,
            meal_type: item.comida_tipo || item.meal_type,
            food_id: item.food_id || null,
            recipe_id: item.recipe_id || null,
            gramos: item.gramos,
            original_cantidad: item.original_cantidad ?? null,
            original_unidad: item.original_unidad ?? null,
            position: index
        }));
        if (rows.length > 0) {
            const { error: itemsError } = await supabase.from('day_template_items').insert(rows);
            if (itemsError) {
                console.error("Error saving day template items:", itemsError);
            }
        }
        await fetchTemplates();
        return template.id;
    };

    return {
        mealTemplates,
        dayTemplates,
        loading,
        refetch: fetchTemplates,
        saveMealTemplate,
        saveDayTemplate
    };
}

export function useWeeklyPlan(userId?: string, weekStart?: string) {
    const [plan, setPlan] = useState<WeeklyPlan | null>(null);
    const [entries, setEntries] = useState<PlanEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchPlan = useCallback(async () => {
        if (!userId || !weekStart) {
            setPlan(null);
            setEntries([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const { data: planData, error: planError } = await supabase
            .from('weekly_plans')
            .select('*')
            .eq('user_id', userId)
            .eq('week_start', weekStart)
            .maybeSingle();

        if (planError) console.error("Error fetching weekly plan:", planError);
        setPlan((planData as WeeklyPlan) || null);

        let entryData: any[] = [];
        if (planData) {
            const { data, error: entryError } = await supabase
                .from('weekly_plan_entries')
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
                .eq('weekly_plan_id', planData.id)
                .order('plan_date', { ascending: true })
                .order('position', { ascending: true });

            if (entryError) console.error("Error fetching weekly plan entries:", entryError);
            entryData = data || [];
        }

        const weekDates = Array.from({ length: 7 }, (_, index) => {
            const date = new Date(`${weekStart}T12:00:00`);
            date.setDate(date.getDate() + index);
            return formatDateAsLocalISO(date);
        });
        const plannedDates = new Set(entryData.map((entry) => entry.plan_date));
        const missingDates = weekDates.filter((date) => !plannedDates.has(date));

        if (missingDates.length > 0) {
            const { data: logData, error: logError } = await supabase
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
                .in('fecha', missingDates)
                .order('fecha', { ascending: true })
                .order('created_at', { ascending: true });

            if (logError) {
                console.error("Error fetching weekly fallback food logs:", logError);
            } else if (logData?.length) {
                const fallbackEntries = logData.map((log: any, index: number) => ({
                    id: `food-log-${log.id}`,
                    weekly_plan_id: planData?.id || `logs-${weekStart}`,
                    plan_date: log.fecha,
                    meal_type: log.comida_tipo,
                    food_id: log.food_id,
                    recipe_id: log.recipe_id,
                    gramos: log.gramos,
                    original_cantidad: log.original_cantidad ?? null,
                    original_unidad: log.original_unidad ?? null,
                    position: index,
                    is_completed: !!log.consumido,
                    day_type: 'standard',
                    food_items: log.food_items,
                    recipes: log.recipes
                }));
                entryData = [...entryData, ...fallbackEntries];
            }
        }

        setEntries(entryData as PlanEntry[]);
        setLoading(false);
    }, [userId, weekStart]);

    useEffect(() => {
        fetchPlan();
    }, [fetchPlan]);

    return {
        plan,
        entries,
        entriesByDate: buildWeeklyPlanMap(entries),
        loading,
        refetch: fetchPlan
    };
}

export function useWeeklyPlanActions() {
    const ensureWeeklyPlan = async (userId: string, weekStart: string) => {
        const { data: existing, error: findError } = await supabase
            .from('weekly_plans')
            .select('*')
            .eq('user_id', userId)
            .eq('week_start', weekStart)
            .maybeSingle();

        if (findError) throw findError;
        if (existing) return existing as WeeklyPlan;

        const { data, error } = await supabase
            .from('weekly_plans')
            .insert({ user_id: userId, week_start: weekStart })
            .select()
            .single();

        if (error) throw error;
        return data as WeeklyPlan;
    };

    const addPlanEntry = async (userId: string, date: string, payload: any) => {
        const weekStart = getWeekStart(date);
        const plan = await ensureWeeklyPlan(userId, weekStart);
        const { data: maxEntry } = await supabase
            .from('weekly_plan_entries')
            .select('position')
            .eq('weekly_plan_id', plan.id)
            .eq('plan_date', date)
            .eq('meal_type', payload.meal_type)
            .order('position', { ascending: false })
            .limit(1)
            .maybeSingle();

        const { data, error } = await supabase
            .from('weekly_plan_entries')
            .insert({
                weekly_plan_id: plan.id,
                plan_date: date,
                meal_type: payload.meal_type,
                food_id: payload.food_id || null,
                recipe_id: payload.recipe_id || null,
                gramos: payload.gramos,
                original_cantidad: payload.original_cantidad ?? null,
                original_unidad: payload.original_unidad ?? null,
                position: (maxEntry?.position ?? -1) + 1,
                is_completed: false,
                day_type: payload.day_type || 'standard'
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    };

    const movePlanEntry = async (entryId: string, planDate: string, mealType: string, position = 0) => {
        const { error } = await supabase
            .from('weekly_plan_entries')
            .update({ plan_date: planDate, meal_type: mealType, position, updated_at: new Date().toISOString() })
            .eq('id', entryId);
        if (error) throw error;
    };

    const duplicateDayPlan = async (userId: string, sourceDate: string, targetDate: string) => {
        const sourceEntries = await fetchEntriesForDate(userId, sourceDate);
        const targetWeekStart = getWeekStart(targetDate);
        const targetPlan = await ensureWeeklyPlan(userId, targetWeekStart);
        await supabase
            .from('weekly_plan_entries')
            .delete()
            .eq('weekly_plan_id', targetPlan.id)
            .eq('plan_date', targetDate);

        if (!sourceEntries || sourceEntries.length === 0) return;
        const rows = sourceEntries.map((entry) => ({
            weekly_plan_id: targetPlan.id,
            plan_date: targetDate,
            meal_type: entry.meal_type,
            food_id: entry.food_id,
            recipe_id: entry.recipe_id,
            gramos: entry.gramos,
            original_cantidad: entry.original_cantidad,
            original_unidad: entry.original_unidad,
            position: entry.position,
            is_completed: false,
            day_type: entry.day_type || 'standard'
        }));
        const { error } = await supabase.from('weekly_plan_entries').insert(rows);
        if (error) throw error;
    };

    const clearDayPlan = async (userId: string, targetDate: string) => {
        const weekStart = getWeekStart(targetDate);
        const plan = await ensureWeeklyPlan(userId, weekStart);
        const { error } = await supabase
            .from('weekly_plan_entries')
            .delete()
            .eq('weekly_plan_id', plan.id)
            .eq('plan_date', targetDate);
        if (error) throw error;
    };

    const repeatWeek = async (userId: string, sourceWeekStart: string, targetWeekStart: string) => {
        const sourcePlan = await ensureWeeklyPlan(userId, sourceWeekStart);
        const targetPlan = await ensureWeeklyPlan(userId, targetWeekStart);
        const { data: sourceEntries, error: sourceError } = await supabase
            .from('weekly_plan_entries')
            .select('*')
            .eq('weekly_plan_id', sourcePlan.id)
            .order('plan_date', { ascending: true })
            .order('position', { ascending: true });
        if (sourceError) throw sourceError;

        await supabase.from('weekly_plan_entries').delete().eq('weekly_plan_id', targetPlan.id);

        const sourceBase = new Date(`${sourceWeekStart}T12:00:00`);
        const targetBase = new Date(`${targetWeekStart}T12:00:00`);
        const rows = (sourceEntries || []).map((entry) => {
            const entryDate = new Date(`${entry.plan_date}T12:00:00`);
            const diffDays = Math.round((entryDate.getTime() - sourceBase.getTime()) / (1000 * 60 * 60 * 24));
            const newDate = new Date(targetBase);
            newDate.setDate(targetBase.getDate() + diffDays);
            return {
                weekly_plan_id: targetPlan.id,
                plan_date: formatDateAsLocalISO(newDate),
                meal_type: entry.meal_type,
                food_id: entry.food_id,
                recipe_id: entry.recipe_id,
                gramos: entry.gramos,
                original_cantidad: entry.original_cantidad,
                original_unidad: entry.original_unidad,
                position: entry.position,
                is_completed: false,
                day_type: entry.day_type || 'standard'
            };
        });
        if (rows.length > 0) {
            const { error } = await supabase.from('weekly_plan_entries').insert(rows);
            if (error) throw error;
        }
    };

    const regenerateShoppingList = async (userId: string, weekStart: string) => {
        const plan = await ensureWeeklyPlan(userId, weekStart);
        const { data: entries, error: entriesError } = await supabase
            .from('weekly_plan_entries')
            .select(`
                *,
                food_items (nombre),
                recipes (
                    porciones,
                    recipe_ingredients (
                        gramos,
                        food_items (nombre)
                    )
                )
            `)
            .eq('weekly_plan_id', plan.id);
        if (entriesError) throw entriesError;

        let listId: string;
        const { data: existingList } = await supabase
            .from('shopping_lists')
            .select('*')
            .eq('user_id', userId)
            .eq('week_start', weekStart)
            .maybeSingle();

        if (existingList) {
            listId = existingList.id;
            await supabase.from('shopping_list_items').delete().eq('shopping_list_id', listId);
        } else {
            const { data: createdList, error: createError } = await supabase
                .from('shopping_lists')
                .insert({ user_id: userId, week_start: weekStart })
                .select()
                .single();
            if (createError || !createdList) throw createError;
            listId = createdList.id;
        }

        const aggregated = aggregateShoppingItems(entries || []);
        if (aggregated.length > 0) {
            const { error } = await supabase.from('shopping_list_items').insert(
                aggregated.map((item) => ({
                    shopping_list_id: listId,
                    ingredient_name: item.ingredient_name,
                    quantity_grams: item.quantity_grams,
                    is_checked: false,
                    source_count: item.source_count
                }))
            );
            if (error) throw error;
        }
    };

    const applyDayTemplate = async (userId: string, dayTemplateId: string, targetDate: string) => {
        const weekStart = getWeekStart(targetDate);
        const plan = await ensureWeeklyPlan(userId, weekStart);
        const { data: template, error } = await supabase
            .from('day_templates')
            .select(`
                *,
                day_template_items (*)
            `)
            .eq('id', dayTemplateId)
            .single();
        if (error || !template) throw error;

        await supabase
            .from('weekly_plan_entries')
            .delete()
            .eq('weekly_plan_id', plan.id)
            .eq('plan_date', targetDate);

        const rows = (template.day_template_items || []).map((item: any, index: number) => ({
            weekly_plan_id: plan.id,
            plan_date: targetDate,
            meal_type: item.meal_type,
            food_id: item.food_id,
            recipe_id: item.recipe_id,
            gramos: item.gramos,
            original_cantidad: item.original_cantidad,
            original_unidad: item.original_unidad,
            position: index,
            is_completed: false,
            day_type: template.day_type || 'standard'
        }));
        if (rows.length > 0) {
            const { error: insertError } = await supabase.from('weekly_plan_entries').insert(rows);
            if (insertError) throw insertError;
        }
    };

    return {
        ensureWeeklyPlan,
        addPlanEntry,
        movePlanEntry,
        duplicateDayPlan,
        clearDayPlan,
        repeatWeek,
        regenerateShoppingList,
        applyDayTemplate
    };
}

export function useShoppingList(userId?: string, weekStart?: string) {
    const [listId, setListId] = useState<string | null>(null);
    const [items, setItems] = useState<ShoppingListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [source, setSource] = useState<'shopping_list_items' | 'weekly_plan_entries' | 'food_logs'>('food_logs');

    const fetchList = useCallback(async () => {
        if (!userId || !weekStart) {
            setItems([]);
            setListId(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        const { data: existingList } = await supabase
            .from('shopping_lists')
            .select('*')
            .eq('user_id', userId)
            .eq('week_start', weekStart)
            .maybeSingle();

        if (existingList) {
            const { data } = await supabase
                .from('shopping_list_items')
                .select('*')
                .eq('shopping_list_id', existingList.id)
                .order('ingredient_name', { ascending: true });
            setListId(existingList.id);
            setItems((data || []) as ShoppingListItem[]);
            setSource('shopping_list_items');
            setLoading(false);
            return;
        }

        const { data: weeklyPlan } = await supabase
            .from('weekly_plans')
            .select('id')
            .eq('user_id', userId)
            .eq('week_start', weekStart)
            .maybeSingle();

        if (weeklyPlan) {
            const { data: entries } = await supabase
                .from('weekly_plan_entries')
                .select(`
                    *,
                    food_items (nombre),
                    recipes (
                        porciones,
                        recipe_ingredients (
                            gramos,
                            food_items (nombre)
                        )
                    )
                `)
                .eq('weekly_plan_id', weeklyPlan.id);

            const aggregated = aggregateShoppingItems(entries || []);
            setItems(aggregated);
            setSource('weekly_plan_entries');
            setLoading(false);
            return;
        }

        const endDate = new Date(`${weekStart}T12:00:00`);
        endDate.setDate(endDate.getDate() + 6);
        const { data: foodLogs } = await supabase
            .from('food_logs')
            .select(`
                *,
                food_items (nombre),
                recipes (
                    porciones,
                    recipe_ingredients (
                        gramos,
                        food_items (nombre)
                    )
                )
            `)
            .eq('user_id', userId)
            .gte('fecha', weekStart)
            .lte('fecha', formatDateAsLocalISO(endDate));

        setItems(aggregateShoppingItems(foodLogs || []));
        setSource('food_logs');
        setLoading(false);
    }, [userId, weekStart]);

    useEffect(() => {
        fetchList();
    }, [fetchList]);

    const toggleItem = async (itemId: string, nextValue: boolean) => {
        if (!listId) {
            setItems((prev) => prev.map((item) => item.id === itemId ? { ...item, is_checked: nextValue } : item));
            return;
        }
        const { error } = await supabase
            .from('shopping_list_items')
            .update({ is_checked: nextValue, updated_at: new Date().toISOString() })
            .eq('id', itemId);
        if (error) throw error;
        setItems((prev) => prev.map((item) => item.id === itemId ? { ...item, is_checked: nextValue } : item));
    };

    return { listId, items, loading, source, refetch: fetchList, toggleItem };
}

export function useAdherenceAnalytics(userId?: string, rangeDays = 7) {
    const [summary, setSummary] = useState({
        adherenceRate: 0,
        avgCalories: 0,
        avgProtein: 0,
        completedDays: 0,
        plannedDays: 0,
    });
    const [loading, setLoading] = useState(true);

    const fetchSummary = useCallback(async () => {
        if (!userId) {
            setLoading(false);
            return;
        }
        setLoading(true);

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - Math.max(0, rangeDays - 1));
        const startIso = formatDateAsLocalISO(startDate);

        const { data: logs } = await supabase
            .from('food_logs')
            .select(`
                fecha,
                consumido,
                gramos,
                food_items (proteinas, kcal),
                recipes (
                    porciones,
                    recipe_ingredients (
                        gramos,
                        food_items (proteinas, kcal)
                    )
                )
            `)
            .eq('user_id', userId)
            .gte('fecha', startIso);

        const daily: Record<string, { kcal: number; protein: number; consumed: boolean }> = {};
        (logs || []).forEach((log: any) => {
            if (!daily[log.fecha]) daily[log.fecha] = { kcal: 0, protein: 0, consumed: false };
            let kcal = 0;
            let protein = 0;
            if (log.food_items) {
                kcal = Number(log.food_items.kcal || 0) * (Number(log.gramos || 0) / 100);
                protein = Number(log.food_items.proteinas || 0) * (Number(log.gramos || 0) / 100);
            } else if (log.recipes) {
                const recipeTotals = (log.recipes.recipe_ingredients || []).reduce((acc: any, ing: any) => ({
                    kcal: acc.kcal + (Number(ing.food_items?.kcal || 0) * (Number(ing.gramos || 0) / 100)),
                    protein: acc.protein + (Number(ing.food_items?.proteinas || 0) * (Number(ing.gramos || 0) / 100))
                }), { kcal: 0, protein: 0 });
                kcal = (recipeTotals.kcal / (Number(log.recipes.porciones) || 1)) * (Number(log.gramos || 0) / 100);
                protein = (recipeTotals.protein / (Number(log.recipes.porciones) || 1)) * (Number(log.gramos || 0) / 100);
            }
            daily[log.fecha].kcal += kcal;
            daily[log.fecha].protein += protein;
            daily[log.fecha].consumed = daily[log.fecha].consumed || !!log.consumido;
        });

        const values = Object.values(daily);
        const completedDays = values.filter((item) => item.consumed).length;
        const plannedDays = values.length;
        const avgCalories = Math.round(values.reduce((acc, item) => acc + item.kcal, 0) / (plannedDays || 1));
        const avgProtein = Math.round(values.reduce((acc, item) => acc + item.protein, 0) / (plannedDays || 1));

        setSummary({
            adherenceRate: plannedDays === 0 ? 0 : Math.round((completedDays / plannedDays) * 100),
            avgCalories,
            avgProtein,
            completedDays,
            plannedDays,
        });
        setLoading(false);
    }, [userId, rangeDays]);

    useEffect(() => {
        fetchSummary();
    }, [fetchSummary]);

    return { summary, loading, refetch: fetchSummary };
}

function aggregateShoppingItems(entries: any[]): ShoppingListItem[] {
    const aggregated: Record<string, ShoppingListItem> = {};

    entries.forEach((entry: any, index: number) => {
        if (entry.food_items?.nombre) {
            const name = entry.food_items.nombre;
            if (!aggregated[name]) {
                aggregated[name] = {
                    id: `${name}-${index}`,
                    ingredient_name: name,
                    quantity_grams: 0,
                    is_checked: false,
                    source_count: 0
                };
            }
            aggregated[name].quantity_grams += Number(entry.gramos || 0);
            aggregated[name].source_count += 1;
        }

        if (entry.recipes?.recipe_ingredients) {
            entry.recipes.recipe_ingredients.forEach((ingredient: any) => {
                const name = ingredient.food_items?.nombre;
                if (!name) return;
                if (!aggregated[name]) {
                    aggregated[name] = {
                        id: `${name}-${index}`,
                        ingredient_name: name,
                        quantity_grams: 0,
                        is_checked: false,
                        source_count: 0
                    };
                }
                aggregated[name].quantity_grams += (Number(ingredient.gramos || 0) / (Number(entry.recipes?.porciones) || 1)) * (Number(entry.gramos || 0) / 100);
                aggregated[name].source_count += 1;
            });
        }
    });

    return Object.values(aggregated).sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name));
}
    const fetchEntriesForDate = async (userId: string, date: string) => {
        const sourceWeekStart = getWeekStart(date);
        const { data: sourcePlan } = await supabase
            .from('weekly_plans')
            .select('*')
            .eq('user_id', userId)
            .eq('week_start', sourceWeekStart)
            .maybeSingle();

        if (sourcePlan) {
            const { data: sourceEntries, error: sourceError } = await supabase
                .from('weekly_plan_entries')
                .select('*')
                .eq('weekly_plan_id', sourcePlan.id)
                .eq('plan_date', date)
                .order('position', { ascending: true });

            if (sourceError) throw sourceError;
            if (sourceEntries && sourceEntries.length > 0) {
                return sourceEntries.map((entry) => ({
                    meal_type: entry.meal_type,
                    food_id: entry.food_id,
                    recipe_id: entry.recipe_id,
                    gramos: entry.gramos,
                    original_cantidad: entry.original_cantidad,
                    original_unidad: entry.original_unidad,
                    position: entry.position,
                    day_type: entry.day_type || 'standard'
                }));
            }
        }

        const { data: sourceLogs, error: logsError } = await supabase
            .from('food_logs')
            .select('*')
            .eq('user_id', userId)
            .eq('fecha', date)
            .order('created_at', { ascending: true });

        if (logsError) throw logsError;
        return (sourceLogs || [])
            .filter((log) => log.original_unidad !== 'HIDDEN_MEAL')
            .map((log, index) => ({
                meal_type: log.comida_tipo,
                food_id: log.food_id,
                recipe_id: log.recipe_id,
                gramos: log.gramos,
                original_cantidad: log.original_cantidad ?? null,
                original_unidad: log.original_unidad ?? null,
                position: index,
                day_type: 'standard'
            }));
    };
