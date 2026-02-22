"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export function useProfile(userId?: string) {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

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
                const today = new Date().toISOString().split('T')[0];
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

                setProfile({ ...data, racha_actual: currentStreak });
            }
            setLoading(false);
        }

        fetchProfile();
    }, [userId]);

    const updateStreak = async () => {
        if (!userId || !profile) return;

        const today = new Date().toISOString().split('T')[0];
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
            setProfile((p: any) => ({ ...p, racha_actual: newStreak, ultima_fecha_registro: today }));
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
        setProfile((prev: any) => ({ ...prev, orden_comidas: newOrder }));
    };

    return { profile, loading, updateStreak, updateMealOrder, refetchProfile: fetchProfile };
}

export function useFoodLogs(userId?: string, date?: string) {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = useCallback(async () => {
        if (!userId || !date) return;

        setLoading(true);
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
        if (data) {
            console.log(`Fetched ${data.length} logs for ${date}`);
            setLogs(data);
        }
        setLoading(false);
    }, [userId, date]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    return { logs, loading, refetch: fetchLogs, setLogs };
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

    return { toggleConsumed, toggleAllConsumed, renameMealType, deleteMealLogs };
}

export function useWaterLogs(userId?: string, date?: string) {
    const [glasses, setGlasses] = useState(0);
    const [waterLogIds, setWaterLogIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchWater = useCallback(async () => {
        if (!userId || !date) return;
        setLoading(true);
        const { data, error } = await supabase
            .from('water_logs')
            .select('id')
            .eq('user_id', userId)
            .eq('fecha', date)
            .order('created_at', { ascending: true });

        if (data) {
            setGlasses(data.length);
            setWaterLogIds(data.map(d => d.id));
        }
        setLoading(false);
    }, [userId, date]);

    useEffect(() => {
        fetchWater();
    }, [fetchWater]);

    const addGlass = async () => {
        if (!userId || !date) {
            console.warn('addGlass: no userId or date', { userId, date });
            return;
        }
        // Optimistic update
        setGlasses(prev => prev + 1);

        const { data, error } = await supabase
            .from('water_logs')
            .insert({ user_id: userId, cantidad_litros: 0.25, fecha: date })
            .select('id')
            .single();

        if (error) {
            console.error('Water add error:', error);
            // Revert on failure
            setGlasses(prev => Math.max(0, prev - 1));
            return;
        }
        if (data) {
            setWaterLogIds(prev => [...prev, data.id]);
        }
    };

    const removeGlass = async () => {
        if (!userId || !date || waterLogIds.length === 0) return;
        const lastId = waterLogIds[waterLogIds.length - 1];
        // Optimistic update
        setGlasses(prev => Math.max(0, prev - 1));
        setWaterLogIds(prev => prev.slice(0, -1));

        const { error } = await supabase
            .from('water_logs')
            .delete()
            .eq('id', lastId);

        if (error) {
            console.error('Water remove error:', error);
            // Revert on failure
            setGlasses(prev => prev + 1);
            setWaterLogIds(prev => [...prev, lastId]);
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
            .gte('fecha', yearAgo.toISOString().split('T')[0])
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
            .gte('fecha', yearAgo.toISOString().split('T')[0]);

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
