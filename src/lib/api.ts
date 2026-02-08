import { supabase } from "@/integrations/supabase/client";
import { STORAGE_KEY_DATA_SOURCE, DataSourceConfig } from "@/components/admin/DataSourceSettings";
import { toast } from "sonner";

// Helper to get config
function getConfig(): DataSourceConfig | null {
    const saved = localStorage.getItem(STORAGE_KEY_DATA_SOURCE);
    if (!saved) return null;
    try {
        return JSON.parse(saved);
    } catch {
        return null;
    }
}

// Generic MySQL Query Executor
async function executeMySQL(query: string, params: any[] = []) {
    const config = getConfig();
    if (!config) throw new Error("Geen database configuratie gevonden.");

    const { data, error } = await supabase.functions.invoke('query-mysql', {
        body: {
            host: config.mysqlHost,
            port: parseInt(config.mysqlPort),
            user: config.mysqlUser,
            password: config.mysqlPassword,
            database: config.mysqlDatabase,
            query,
            params
        }
    });

    if (error) {
        console.error("Supabase Function Error:", error);
        throw error;
    }
    if (data.error) {
        console.error("MySQL Query Error:", data.error);
        throw new Error(data.error);
    }
    return data.data;
}

// --- Dual-Write MySQL Sync Helper ---
// Fire-and-forget: runs the MySQL sync if enabled, logs errors but never blocks the primary operation
async function syncToMySQL(fn: () => Promise<void>) {
    const config = getConfig();
    if (!config?.useMySQL) return;

    try {
        await fn();
    } catch (err) {
        console.error("MySQL sync failed:", err);
        toast.error("MySQL sync mislukt - data staat wel in de cloud database");
    }
}

// Helper to build a MySQL INSERT from a data object
function buildInsert(table: string, data: Record<string, any>, excludeKeys: string[] = []): { query: string; params: any[] } {
    const keys = Object.keys(data).filter(k => !excludeKeys.includes(k) && data[k] !== undefined);
    const values = keys.map(k => data[k]);
    const placeholders = keys.map(() => '?').join(', ');
    return {
        query: `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
        params: values
    };
}

// Helper to build a MySQL UPDATE from a data object
function buildUpdate(table: string, data: Record<string, any>, id: string, excludeKeys: string[] = []): { query: string; params: any[] } {
    const keys = Object.keys(data).filter(k => !excludeKeys.includes(k) && k !== 'id' && k !== 'created_at' && data[k] !== undefined);
    const values = keys.map(k => data[k]);
    values.push(id);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    return {
        query: `UPDATE ${table} SET ${setClause} WHERE id = ?`,
        params: values
    };
}

// --- Data Provider Interface ---

export const api = {
    customers: {
        getAll: async () => {
            const { data, error } = await supabase
                .from("customers")
                .select("*")
                .order("name");
            if (error) throw error;
            return data;
        },

        delete: async (id: string) => {
            const { error } = await supabase.from("customers").delete().eq("id", id);
            if (error) throw error;
            syncToMySQL(async () => {
                await executeMySQL("DELETE FROM customers WHERE id = ?", [id]);
            });
            return true;
        },

        toggleActive: async (id: string, currentState: boolean) => {
            const { error } = await supabase
                .from("customers")
                .update({ is_active: !currentState })
                .eq("id", id);
            if (error) throw error;
            syncToMySQL(async () => {
                const newState = currentState ? 0 : 1;
                await executeMySQL("UPDATE customers SET is_active = ? WHERE id = ?", [newState, id]);
            });
            return true;
        },

        create: async (item: any) => {
            const { data, error } = await supabase.from("customers").insert(item).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildInsert("customers", data);
                await executeMySQL(query, params);
            });
            return data;
        },

        update: async (id: string, item: any) => {
            const { data, error } = await supabase.from("customers").update(item).eq("id", id).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildUpdate("customers", data, id);
                await executeMySQL(query, params);
            });
            return data;
        }
    },

    gasTypes: {
        getAll: async () => {
            const { data, error } = await supabase
                .from("gas_types")
                .select("*")
                .order("sort_order", { ascending: true })
                .order("name", { ascending: true });
            if (error) throw error;
            return data;
        },
        create: async (item: any) => {
            const { data, error } = await supabase.from("gas_types").insert(item).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildInsert("gas_types", data);
                await executeMySQL(query, params);
            });
            return data;
        },
        update: async (id: string, item: any) => {
            const { data, error } = await supabase.from("gas_types").update(item).eq("id", id).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildUpdate("gas_types", data, id);
                await executeMySQL(query, params);
            });
            return data;
        },
        delete: async (id: string) => {
            const { error } = await supabase.from("gas_types").delete().eq("id", id);
            if (error) throw error;
            syncToMySQL(async () => {
                await executeMySQL("DELETE FROM gas_types WHERE id = ?", [id]);
            });
            return true;
        }
    },

    cylinderSizes: {
        getAll: async () => {
            const { data, error } = await supabase.from("cylinder_sizes").select("*").order("sort_order", { ascending: true });
            if (error) throw error;
            return data;
        },
        create: async (item: any) => {
            const { data, error } = await supabase.from("cylinder_sizes").insert(item).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildInsert("cylinder_sizes", data);
                await executeMySQL(query, params);
            });
            return data;
        },
        update: async (id: string, item: any) => {
            const { data, error } = await supabase.from("cylinder_sizes").update(item).eq("id", id).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildUpdate("cylinder_sizes", data, id);
                await executeMySQL(query, params);
            });
            return data;
        },
        delete: async (id: string) => {
            const { error } = await supabase.from("cylinder_sizes").delete().eq("id", id);
            if (error) throw error;
            syncToMySQL(async () => {
                await executeMySQL("DELETE FROM cylinder_sizes WHERE id = ?", [id]);
            });
            return true;
        }
    },

    dryIceProductTypes: {
        getAll: async () => {
            const { data, error } = await supabase.from("dry_ice_product_types").select("*").order("sort_order", { ascending: true });
            if (error) throw error;
            return data;
        },
        create: async (item: any) => {
            const { data, error } = await supabase.from("dry_ice_product_types").insert(item).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildInsert("dry_ice_product_types", data);
                await executeMySQL(query, params);
            });
            return data;
        },
        update: async (id: string, item: any) => {
            const { data, error } = await supabase.from("dry_ice_product_types").update(item).eq("id", id).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildUpdate("dry_ice_product_types", data, id);
                await executeMySQL(query, params);
            });
            return data;
        },
        delete: async (id: string) => {
            const { error } = await supabase.from("dry_ice_product_types").delete().eq("id", id);
            if (error) throw error;
            syncToMySQL(async () => {
                await executeMySQL("DELETE FROM dry_ice_product_types WHERE id = ?", [id]);
            });
            return true;
        }
    },

    dryIcePackaging: {
        getAll: async () => {
            const { data, error } = await supabase.from("dry_ice_packaging").select("*").order("sort_order", { ascending: true });
            if (error) throw error;
            return data;
        },
        create: async (item: any) => {
            const { data, error } = await supabase.from("dry_ice_packaging").insert(item).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildInsert("dry_ice_packaging", data);
                await executeMySQL(query, params);
            });
            return data;
        },
        update: async (id: string, item: any) => {
            const { data, error } = await supabase.from("dry_ice_packaging").update(item).eq("id", id).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildUpdate("dry_ice_packaging", data, id);
                await executeMySQL(query, params);
            });
            return data;
        },
        delete: async (id: string) => {
            const { error } = await supabase.from("dry_ice_packaging").delete().eq("id", id);
            if (error) throw error;
            syncToMySQL(async () => {
                await executeMySQL("DELETE FROM dry_ice_packaging WHERE id = ?", [id]);
            });
            return true;
        }
    },

    taskTypes: {
        getAll: async () => {
            const { data, error } = await supabase.from("task_types").select("*").order("sort_order", { ascending: true });
            if (error) throw error;
            return data;
        },
        create: async (item: any) => {
            const { data, error } = await supabase.from("task_types").insert(item).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildInsert("task_types", data);
                await executeMySQL(query, params);
            });
            return data;
        },
        update: async (id: string, item: any) => {
            const { data, error } = await supabase.from("task_types").update(item).eq("id", id).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildUpdate("task_types", data, id);
                await executeMySQL(query, params);
            });
            return data;
        },
        delete: async (id: string) => {
            const { error } = await supabase.from("task_types").delete().eq("id", id);
            if (error) throw error;
            syncToMySQL(async () => {
                await executeMySQL("DELETE FROM task_types WHERE id = ?", [id]);
            });
            return true;
        }
    },

    gasTypeCategories: {
        getAll: async () => {
            const { data, error } = await supabase.from("gas_type_categories").select("*").order("sort_order", { ascending: true });
            if (error) throw error;
            return data;
        },
        create: async (item: any) => {
            const { data, error } = await supabase.from("gas_type_categories").insert(item).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildInsert("gas_type_categories", data);
                await executeMySQL(query, params);
            });
            return data;
        },
        update: async (id: string, item: any) => {
            const { data, error } = await supabase.from("gas_type_categories").update(item).eq("id", id).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildUpdate("gas_type_categories", data, id);
                await executeMySQL(query, params);
            });
            return data;
        },
        delete: async (id: string) => {
            const { error } = await supabase.from("gas_type_categories").delete().eq("id", id);
            if (error) throw error;
            syncToMySQL(async () => {
                await executeMySQL("DELETE FROM gas_type_categories WHERE id = ?", [id]);
            });
            return true;
        }
    },

    appSettings: {
        getByKey: async (key: string) => {
            const { data, error } = await supabase
                .from("app_settings")
                .select("value, description")
                .eq("key", key)
                .maybeSingle();
            if (error) throw error;
            return data;
        },
        upsert: async (key: string, value: string, description?: string) => {
            const { data, error } = await supabase
                .from("app_settings")
                .upsert(
                    { key, value, description },
                    { onConflict: "key" }
                )
                .select()
                .single();
            if (error) throw error;
            syncToMySQL(async () => {
                await executeMySQL(
                    "INSERT INTO app_settings (`key`, value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = ?, description = ?",
                    [key, value, description || null, value, description || null]
                );
            });
            return data;
        }
    },

    gasCylinderOrders: {
        getAll: async (startDate: string, endDate: string) => {
            const { data, error } = await supabase
                .from("gas_cylinder_orders")
                .select(`
                    *,
                    gas_type_ref:gas_types(id, name, color)
                `)
                .gte("scheduled_date", startDate)
                .lte("scheduled_date", endDate)
                .order("scheduled_date", { ascending: true })
                .limit(5000);
            if (error) throw error;
            return data;
        },
        create: async (item: any) => {
            const { data, error } = await supabase.from("gas_cylinder_orders").insert(item).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const syncData = { ...data } as any;
                delete syncData.gas_type_ref;
                const { query, params } = buildInsert("gas_cylinder_orders", syncData);
                await executeMySQL(query, params);
            });
            return data;
        },
        update: async (id: string, item: any) => {
            const { data, error } = await supabase.from("gas_cylinder_orders").update(item).eq("id", id).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const syncData = { ...data } as any;
                delete syncData.gas_type_ref;
                const { query, params } = buildUpdate("gas_cylinder_orders", syncData, id);
                await executeMySQL(query, params);
            });
            return data;
        },
        delete: async (id: string) => {
            const { error } = await supabase.from("gas_cylinder_orders").delete().eq("id", id);
            if (error) throw error;
            syncToMySQL(async () => {
                await executeMySQL("DELETE FROM gas_cylinder_orders WHERE id = ?", [id]);
            });
            return true;
        },
        getPending: async (fromDate: string) => {
            const { data, error } = await supabase
                .from("gas_cylinder_orders")
                .select(`
                    *,
                    gas_type_ref:gas_types(id, name, color)
                `)
                .eq("status", "pending")
                .gte("scheduled_date", fromDate)
                .order("scheduled_date", { ascending: true });
            if (error) throw error;
            return data;
        }
    },

    dryIceOrders: {
        getAll: async (startDate: string, endDate: string) => {
            const { data, error } = await supabase
                .from("dry_ice_orders")
                .select("*")
                .gte("scheduled_date", startDate)
                .lte("scheduled_date", endDate)
                .order("scheduled_date", { ascending: true });
            if (error) throw error;
            return data;
        },
        getPending: async (fromDate: string) => {
            const { data, error } = await supabase
                .from("dry_ice_orders")
                .select("*")
                .eq("status", "pending")
                .gte("scheduled_date", fromDate)
                .order("scheduled_date", { ascending: true });
            if (error) throw error;
            return data;
        },
        create: async (item: any) => {
            const { data, error } = await supabase.from("dry_ice_orders").insert(item).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildInsert("dry_ice_orders", data);
                await executeMySQL(query, params);
            });
            return data;
        },
        update: async (id: string, item: any) => {
            const { data, error } = await supabase.from("dry_ice_orders").update(item).eq("id", id).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildUpdate("dry_ice_orders", data, id);
                await executeMySQL(query, params);
            });
            return data;
        },
        updateSeries: async (seriesId: string, dayDifference: number) => {
            // Fetch, update dates, upsert back to Supabase
            const { data: seriesOrders, error: fetchError } = await supabase
                .from("dry_ice_orders")
                .select("*")
                .or(`id.eq.${seriesId},parent_order_id.eq.${seriesId}`);

            if (fetchError) throw fetchError;
            if (!seriesOrders || seriesOrders.length === 0) return true;

            const updates = seriesOrders.map((order: any) => {
                const date = new Date(order.scheduled_date);
                date.setDate(date.getDate() + dayDifference);
                return {
                    ...order,
                    scheduled_date: date.toISOString().split('T')[0]
                };
            });

            const { error: updateError } = await supabase.from("dry_ice_orders").upsert(updates);
            if (updateError) throw updateError;

            syncToMySQL(async () => {
                await executeMySQL(
                    `UPDATE dry_ice_orders SET scheduled_date = DATE_ADD(scheduled_date, INTERVAL ? DAY) WHERE id = ? OR parent_order_id = ?`,
                    [dayDifference, seriesId, seriesId]
                );
            });
            return true;
        },
        delete: async (id: string) => {
            const { error } = await supabase.from("dry_ice_orders").delete().eq("id", id);
            if (error) throw error;
            syncToMySQL(async () => {
                await executeMySQL("DELETE FROM dry_ice_orders WHERE id = ?", [id]);
            });
            return true;
        },
        deleteSeries: async (seriesId: string) => {
            const { error } = await supabase.from("dry_ice_orders").delete().or(`id.eq.${seriesId},parent_order_id.eq.${seriesId}`);
            if (error) throw error;
            syncToMySQL(async () => {
                await executeMySQL("DELETE FROM dry_ice_orders WHERE id = ? OR parent_order_id = ?", [seriesId, seriesId]);
            });
            return true;
        }
    },

    tasks: {
        getAll: async () => {
            const { data, error } = await supabase.from("tasks").select("*").order("due_date", { ascending: true });
            if (error) throw error;
            return data;
        },
        create: async (item: any) => {
            const { data, error } = await supabase.from("tasks").insert(item).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildInsert("tasks", data);
                await executeMySQL(query, params);
            });
            return data;
        },
        update: async (id: string, item: any) => {
            const { data, error } = await supabase.from("tasks").update(item).eq("id", id).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildUpdate("tasks", data, id);
                await executeMySQL(query, params);
            });
            return data;
        },
        delete: async (id: string) => {
            const { error } = await supabase.from("tasks").delete().eq("id", id);
            if (error) throw error;
            syncToMySQL(async () => {
                await executeMySQL("DELETE FROM tasks WHERE id = ?", [id]);
            });
            return true;
        }
    },

    timeOffRequests: {
        getAll: async () => {
            const { data, error } = await supabase.from("time_off_requests").select("*").order("start_date", { ascending: false });
            if (error) throw error;
            return data;
        },
        create: async (item: any) => {
            const { data, error } = await supabase.from("time_off_requests").insert(item).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildInsert("time_off_requests", data);
                await executeMySQL(query, params);
            });
            return data;
        },
        update: async (id: string, item: any) => {
            const { data, error } = await supabase.from("time_off_requests").update(item).eq("id", id).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildUpdate("time_off_requests", data, id);
                await executeMySQL(query, params);
            });
            return data;
        },
        delete: async (id: string) => {
            const { error } = await supabase.from("time_off_requests").delete().eq("id", id);
            if (error) throw error;
            syncToMySQL(async () => {
                await executeMySQL("DELETE FROM time_off_requests WHERE id = ?", [id]);
            });
            return true;
        }
    },

    profiles: {
        getAll: async () => {
            const { data, error } = await supabase.from("profiles").select("*").order("full_name");
            if (error) throw error;
            return data;
        },
        getByUserId: async (userId: string) => {
            const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
            if (error) throw error;
            return data;
        },
        create: async (item: any) => {
            const { data, error } = await supabase.from("profiles").insert(item).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildInsert("profiles", data);
                await executeMySQL(query, params);
            });
            return data;
        },
        update: async (id: string, item: any) => {
            const { data, error } = await supabase.from("profiles").update(item).eq("id", id).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildUpdate("profiles", data, id);
                await executeMySQL(query, params);
            });
            return data;
        }
    },

    reports: {
        getDailyProductionByPeriod: async (fromDate: string, toDate: string, location: string | null) => {
            const { data, error } = await supabase.rpc("get_daily_production_by_period", {
                p_from_date: fromDate,
                p_to_date: toDate,
                p_location: location
            });
            if (error) throw error;
            return data;
        },

        getGasTypeDistribution: async (fromDate: string, toDate: string, location: string | null) => {
            const { data, error } = await supabase.rpc("get_gas_type_distribution_by_period", {
                p_from_date: fromDate,
                p_to_date: toDate,
                p_location: location
            });
            if (error) throw error;
            return data;
        },

        getGasCategoryDistribution: async (fromDate: string, toDate: string, location: string | null) => {
            const { data, error } = await supabase.rpc("get_gas_category_distribution_by_period" as any, {
                p_from_date: fromDate,
                p_to_date: toDate,
                p_location: location
            });
            if (error) throw error;
            return data;
        },

        getProductionEfficiency: async (fromDate: string, toDate: string, location: string | null) => {
            const { data, error } = await supabase.rpc("get_production_efficiency_by_period", {
                p_from_date: fromDate,
                p_to_date: toDate,
                p_location: location
            });
            if (error) throw error;
            return data;
        },

        getDryIceEfficiency: async (fromDate: string, toDate: string, location: string | null) => {
            const { data, error } = await supabase.rpc("get_dry_ice_efficiency_by_period", {
                p_from_date: fromDate,
                p_to_date: toDate,
                p_location: location
            });
            if (error) throw error;
            return data;
        },

        getCustomerTotals: async (fromDate: string, toDate: string, location: string | null) => {
            const { data, error } = await supabase.rpc("get_customer_totals_by_period", {
                p_from_date: fromDate,
                p_to_date: toDate,
                p_location: location
            });
            if (error) throw error;
            return data;
        }
    },

    timeOffTypes: {
        getAll: async () => {
            const { data, error } = await supabase.from("time_off_types").select("*").order("name");
            if (error) throw error;
            return data;
        },
        create: async (item: any) => {
            const { data, error } = await supabase.from("time_off_types").insert(item).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildInsert("time_off_types", data);
                await executeMySQL(query, params);
            });
            return data;
        },
        update: async (id: string, item: any) => {
            const { data, error } = await supabase.from("time_off_types").update(item).eq("id", id).select().single();
            if (error) throw error;
            syncToMySQL(async () => {
                const { query, params } = buildUpdate("time_off_types", data, id);
                await executeMySQL(query, params);
            });
            return data;
        },
        delete: async (id: string) => {
            const { error } = await supabase.from("time_off_types").delete().eq("id", id);
            if (error) throw error;
            syncToMySQL(async () => {
                await executeMySQL("DELETE FROM time_off_types WHERE id = ?", [id]);
            });
            return true;
        }
    },

    admin: {
        repairDatabase: async () => {
            const config = getConfig();
            if (config?.useMySQL) {
                const queries = [
                    `CREATE TABLE IF NOT EXISTS profiles (
                        id CHAR(36) PRIMARY KEY,
                        user_id CHAR(36),
                        full_name VARCHAR(255),
                        job_title VARCHAR(255),
                        department VARCHAR(255),
                        email VARCHAR(255),
                        phone VARCHAR(255),
                        location VARCHAR(255),
                        production_location VARCHAR(255),
                        employment_type VARCHAR(255),
                        hire_date DATE,
                        date_of_birth DATE,
                        emergency_contact_name VARCHAR(255),
                        emergency_contact_phone VARCHAR(255),
                        manager_id CHAR(36),
                        is_approved BOOLEAN DEFAULT FALSE,
                        approved_by CHAR(36),
                        approved_at DATETIME,
                        intended_role VARCHAR(255),
                        address TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    )`,
                    `CREATE TABLE IF NOT EXISTS time_off_requests (
                        id CHAR(36) PRIMARY KEY,
                        user_id CHAR(36),
                        profile_id CHAR(36) NOT NULL,
                        start_date DATE NOT NULL,
                        end_date DATE NOT NULL,
                        day_part VARCHAR(50),
                        type VARCHAR(50) NOT NULL,
                        type_id CHAR(36),
                        status VARCHAR(50) NOT NULL DEFAULT 'pending',
                        reason TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    )`,
                    `CREATE TABLE IF NOT EXISTS task_types (
                        id CHAR(36) PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        description TEXT,
                        color VARCHAR(50),
                        is_active BOOLEAN DEFAULT TRUE,
                        sort_order INT DEFAULT 0,
                        parent_id CHAR(36),
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    )`
                ];

                for (const query of queries) {
                    await executeMySQL(query);
                }
                return true;
            } else {
                console.warn("Repair database not supported for Supabase direct mode");
                return false;
            }
        }
    },

};
