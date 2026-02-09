import { supabase } from "@/integrations/supabase/client";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { STORAGE_KEY_DATA_SOURCE, DataSourceConfig, PrimarySource } from "@/components/admin/DataSourceSettings";
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

// --- Primary Source Helpers ---

export function getPrimarySource(): PrimarySource {
    const config = getConfig();
    return config?.primarySource || "cloud";
}

export function getPrimarySupabaseClient(): SupabaseClient {
    const source = getPrimarySource();
    if (source === "external_supabase") {
        const ext = getExternalSupabaseClient();
        if (!ext) throw new Error("Externe Supabase niet geconfigureerd");
        return ext;
    }
    return supabase; // cloud (default)
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

// --- Smart Sync Helpers ---
// Only sync to targets that are NOT the primary source

async function syncToMySQL(fn: () => Promise<void>) {
    const config = getConfig();
    if (!config?.useMySQL) return;
    if (getPrimarySource() === "mysql") return; // already written to MySQL as primary

    try {
        await fn();
    } catch (err) {
        console.error("MySQL sync failed:", err);
        toast.error("MySQL sync mislukt - data staat wel in de primaire database");
    }
}

async function syncToExternalSupabase(fn: (client: SupabaseClient) => Promise<void>) {
    if (getPrimarySource() === "external_supabase") return; // already written as primary
    const client = getExternalSupabaseClient();
    if (!client) return;
    try {
        await fn(client);
    } catch (err) {
        console.error("External Supabase sync failed:", err);
        toast.error("Externe Supabase sync mislukt - data staat wel in de primaire database");
    }
}

async function syncToCloud(fn: () => Promise<void>) {
    if (getPrimarySource() === "cloud") return; // already written to cloud as primary
    const config = getConfig();
    // Only sync back to cloud if user has enabled at least one sync option or if primary is not cloud
    // We always sync back to cloud when primary is external, to keep cloud in sync
    if (!config) return;
    try {
        await fn();
    } catch (err) {
        console.error("Cloud sync failed:", err);
        toast.error("Cloud sync mislukt - data staat wel in de primaire database");
    }
}

// --- External Supabase Client ---
let externalSupabaseClient: SupabaseClient | null = null;
let cachedExtUrl: string | null = null;

function getExternalSupabaseClient(): SupabaseClient | null {
    const config = getConfig();
    if (!config?.externalSupabaseUrl || !config.externalSupabaseAnonKey) return null;
    // Need external client if it's primary OR sync is enabled
    if (!config.useExternalSupabase && config.primarySource !== "external_supabase") return null;
    if (!externalSupabaseClient || cachedExtUrl !== config.externalSupabaseUrl) {
        externalSupabaseClient = createClient(config.externalSupabaseUrl, config.externalSupabaseAnonKey);
        cachedExtUrl = config.externalSupabaseUrl;
    }
    return externalSupabaseClient;
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

// Helper to strip join/relation keys for external sync
function stripRelations(data: any, keys: string[] = []): any {
    const copy = { ...data };
    keys.forEach(k => delete copy[k]);
    return copy;
}

// --- Generic CRUD helpers for primary source routing ---

async function primaryRead(table: string, options?: { 
    orderBy?: string; 
    orderAsc?: boolean; 
    secondOrder?: string;
    selectQuery?: string;
    filters?: Array<{ column: string; op: string; value: any }>;
    limit?: number;
    mysqlQuery?: string;
}) {
    const source = getPrimarySource();
    
    if (source === "mysql") {
        const q = options?.mysqlQuery || `SELECT * FROM ${table}${options?.orderBy ? ` ORDER BY ${options.orderBy}${options.orderAsc === false ? ' DESC' : ''}` : ''}`;
        return await executeMySQL(q);
    }
    
    const client = getPrimarySupabaseClient();
    let query = client.from(table).select(options?.selectQuery || "*");
    
    if (options?.filters) {
        for (const f of options.filters) {
            if (f.op === "eq") query = query.eq(f.column, f.value);
            else if (f.op === "gte") query = query.gte(f.column, f.value);
            else if (f.op === "lte") query = query.lte(f.column, f.value);
            else if (f.op === "or") query = query.or(f.value);
        }
    }
    
    if (options?.orderBy) {
        query = query.order(options.orderBy, { ascending: options.orderAsc !== false });
    }
    if (options?.secondOrder) {
        query = query.order(options.secondOrder, { ascending: true });
    }
    if (options?.limit) {
        query = query.limit(options.limit);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data;
}

async function primaryCreate(table: string, item: any, relationKeys: string[] = []) {
    const source = getPrimarySource();
    
    if (source === "mysql") {
        const { query, params } = buildInsert(table, item);
        await executeMySQL(query, params);
        // Sync to cloud and external supabase
        syncToCloud(async () => {
            await (supabase.from as any)(table).upsert(item);
        });
        syncToExternalSupabase(async (ext) => {
            await (ext.from as any)(table).upsert(item);
        });
        return item;
    }
    
    const client = getPrimarySupabaseClient();
    const { data, error } = await client.from(table).insert(item).select().single();
    if (error) throw error;
    
    const syncData = relationKeys.length > 0 ? stripRelations(data, relationKeys) : data;
    
    syncToMySQL(async () => {
        const { query, params } = buildInsert(table, syncData);
        await executeMySQL(query, params);
    });
    syncToExternalSupabase(async (ext) => {
        await (ext.from as any)(table).upsert(syncData);
    });
    syncToCloud(async () => {
        await (supabase.from as any)(table).upsert(syncData);
    });
    
    return data;
}

async function primaryUpdate(table: string, id: string, item: any, relationKeys: string[] = []) {
    const source = getPrimarySource();
    
    if (source === "mysql") {
        const { query, params } = buildUpdate(table, item, id);
        await executeMySQL(query, params);
        syncToCloud(async () => {
            await (supabase.from as any)(table).update(item).eq("id", id);
        });
        syncToExternalSupabase(async (ext) => {
            await (ext.from as any)(table).update(item).eq("id", id);
        });
        return { id, ...item };
    }
    
    const client = getPrimarySupabaseClient();
    const { data, error } = await client.from(table).update(item).eq("id", id).select().single();
    if (error) throw error;
    
    const syncData = relationKeys.length > 0 ? stripRelations(data, relationKeys) : data;
    
    syncToMySQL(async () => {
        const { query, params } = buildUpdate(table, syncData, id);
        await executeMySQL(query, params);
    });
    syncToExternalSupabase(async (ext) => {
        await (ext.from as any)(table).upsert(syncData);
    });
    syncToCloud(async () => {
        await (supabase.from as any)(table).upsert(syncData);
    });
    
    return data;
}

async function primaryDelete(table: string, id: string) {
    const source = getPrimarySource();
    
    if (source === "mysql") {
        await executeMySQL(`DELETE FROM ${table} WHERE id = ?`, [id]);
        syncToCloud(async () => {
            await (supabase.from as any)(table).delete().eq("id", id);
        });
        syncToExternalSupabase(async (ext) => {
            await (ext.from as any)(table).delete().eq("id", id);
        });
        return true;
    }
    
    const client = getPrimarySupabaseClient();
    const { error } = await client.from(table).delete().eq("id", id);
    if (error) throw error;
    
    syncToMySQL(async () => {
        await executeMySQL(`DELETE FROM ${table} WHERE id = ?`, [id]);
    });
    syncToExternalSupabase(async (ext) => {
        await (ext.from as any)(table).delete().eq("id", id);
    });
    syncToCloud(async () => {
        await (supabase.from as any)(table).delete().eq("id", id);
    });
    
    return true;
}

// --- Data Provider Interface ---

export const api = {
    customers: {
        getAll: async () => {
            return primaryRead("customers", { orderBy: "name" });
        },
        delete: async (id: string) => {
            return primaryDelete("customers", id);
        },
        toggleActive: async (id: string, currentState: boolean) => {
            return primaryUpdate("customers", id, { is_active: !currentState });
        },
        create: async (item: any) => {
            return primaryCreate("customers", item);
        },
        update: async (id: string, item: any) => {
            return primaryUpdate("customers", id, item);
        }
    },

    gasTypes: {
        getAll: async () => {
            return primaryRead("gas_types", { orderBy: "sort_order", secondOrder: "name" });
        },
        create: async (item: any) => {
            return primaryCreate("gas_types", item);
        },
        update: async (id: string, item: any) => {
            return primaryUpdate("gas_types", id, item);
        },
        delete: async (id: string) => {
            return primaryDelete("gas_types", id);
        }
    },

    cylinderSizes: {
        getAll: async () => {
            return primaryRead("cylinder_sizes", { orderBy: "sort_order" });
        },
        create: async (item: any) => {
            return primaryCreate("cylinder_sizes", item);
        },
        update: async (id: string, item: any) => {
            return primaryUpdate("cylinder_sizes", id, item);
        },
        delete: async (id: string) => {
            return primaryDelete("cylinder_sizes", id);
        }
    },

    dryIceProductTypes: {
        getAll: async () => {
            return primaryRead("dry_ice_product_types", { orderBy: "sort_order" });
        },
        create: async (item: any) => {
            return primaryCreate("dry_ice_product_types", item);
        },
        update: async (id: string, item: any) => {
            return primaryUpdate("dry_ice_product_types", id, item);
        },
        delete: async (id: string) => {
            return primaryDelete("dry_ice_product_types", id);
        }
    },

    dryIcePackaging: {
        getAll: async () => {
            return primaryRead("dry_ice_packaging", { orderBy: "sort_order" });
        },
        create: async (item: any) => {
            return primaryCreate("dry_ice_packaging", item);
        },
        update: async (id: string, item: any) => {
            return primaryUpdate("dry_ice_packaging", id, item);
        },
        delete: async (id: string) => {
            return primaryDelete("dry_ice_packaging", id);
        }
    },

    taskTypes: {
        getAll: async () => {
            return primaryRead("task_types", { orderBy: "sort_order" });
        },
        create: async (item: any) => {
            return primaryCreate("task_types", item);
        },
        update: async (id: string, item: any) => {
            return primaryUpdate("task_types", id, item);
        },
        delete: async (id: string) => {
            return primaryDelete("task_types", id);
        }
    },

    gasTypeCategories: {
        getAll: async () => {
            return primaryRead("gas_type_categories", { orderBy: "sort_order" });
        },
        create: async (item: any) => {
            return primaryCreate("gas_type_categories", item);
        },
        update: async (id: string, item: any) => {
            return primaryUpdate("gas_type_categories", id, item);
        },
        delete: async (id: string) => {
            return primaryDelete("gas_type_categories", id);
        }
    },

    appSettings: {
        getByKey: async (key: string) => {
            const source = getPrimarySource();
            if (source === "mysql") {
                const rows = await executeMySQL("SELECT value, description FROM app_settings WHERE `key` = ? LIMIT 1", [key]);
                return rows?.[0] || null;
            }
            const client = getPrimarySupabaseClient();
            const { data, error } = await client
                .from("app_settings")
                .select("value, description")
                .eq("key", key)
                .maybeSingle();
            if (error) throw error;
            return data;
        },
        upsert: async (key: string, value: string, description?: string) => {
            const source = getPrimarySource();
            
            if (source === "mysql") {
                await executeMySQL(
                    "INSERT INTO app_settings (`key`, value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = ?, description = ?",
                    [key, value, description || null, value, description || null]
                );
                syncToCloud(async () => {
                    await supabase.from("app_settings").upsert({ key, value, description }, { onConflict: "key" });
                });
                syncToExternalSupabase(async (ext) => {
                    await ext.from("app_settings").upsert({ key, value, description }, { onConflict: "key" });
                });
                return { key, value, description };
            }
            
            const client = getPrimarySupabaseClient();
            const { data, error } = await client
                .from("app_settings")
                .upsert({ key, value, description }, { onConflict: "key" })
                .select()
                .single();
            if (error) throw error;
            
            syncToMySQL(async () => {
                await executeMySQL(
                    "INSERT INTO app_settings (`key`, value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = ?, description = ?",
                    [key, value, description || null, value, description || null]
                );
            });
            syncToExternalSupabase(async (ext) => {
                await ext.from("app_settings").upsert(data, { onConflict: "key" });
            });
            syncToCloud(async () => {
                await supabase.from("app_settings").upsert(data, { onConflict: "key" });
            });
            return data;
        }
    },

    gasCylinderOrders: {
        getAll: async (startDate: string, endDate: string) => {
            return primaryRead("gas_cylinder_orders", {
                selectQuery: `*, gas_type_ref:gas_types(id, name, color)`,
                filters: [
                    { column: "scheduled_date", op: "gte", value: startDate },
                    { column: "scheduled_date", op: "lte", value: endDate }
                ],
                orderBy: "scheduled_date",
                limit: 5000,
                mysqlQuery: `SELECT * FROM gas_cylinder_orders WHERE scheduled_date >= '${startDate}' AND scheduled_date <= '${endDate}' ORDER BY scheduled_date LIMIT 5000`
            });
        },
        create: async (item: any) => {
            return primaryCreate("gas_cylinder_orders", item, ['gas_type_ref']);
        },
        update: async (id: string, item: any) => {
            return primaryUpdate("gas_cylinder_orders", id, item, ['gas_type_ref']);
        },
        delete: async (id: string) => {
            return primaryDelete("gas_cylinder_orders", id);
        },
        getPending: async (fromDate: string) => {
            return primaryRead("gas_cylinder_orders", {
                selectQuery: `*, gas_type_ref:gas_types(id, name, color)`,
                filters: [
                    { column: "status", op: "eq", value: "pending" },
                    { column: "scheduled_date", op: "gte", value: fromDate }
                ],
                orderBy: "scheduled_date",
                mysqlQuery: `SELECT * FROM gas_cylinder_orders WHERE status = 'pending' AND scheduled_date >= '${fromDate}' ORDER BY scheduled_date`
            });
        }
    },

    dryIceOrders: {
        getAll: async (startDate: string, endDate: string) => {
            return primaryRead("dry_ice_orders", {
                filters: [
                    { column: "scheduled_date", op: "gte", value: startDate },
                    { column: "scheduled_date", op: "lte", value: endDate }
                ],
                orderBy: "scheduled_date",
                mysqlQuery: `SELECT * FROM dry_ice_orders WHERE scheduled_date >= '${startDate}' AND scheduled_date <= '${endDate}' ORDER BY scheduled_date`
            });
        },
        getPending: async (fromDate: string) => {
            return primaryRead("dry_ice_orders", {
                filters: [
                    { column: "status", op: "eq", value: "pending" },
                    { column: "scheduled_date", op: "gte", value: fromDate }
                ],
                orderBy: "scheduled_date",
                mysqlQuery: `SELECT * FROM dry_ice_orders WHERE status = 'pending' AND scheduled_date >= '${fromDate}' ORDER BY scheduled_date`
            });
        },
        create: async (item: any) => {
            return primaryCreate("dry_ice_orders", item);
        },
        update: async (id: string, item: any) => {
            return primaryUpdate("dry_ice_orders", id, item);
        },
        updateSeries: async (seriesId: string, dayDifference: number) => {
            const source = getPrimarySource();
            
            if (source === "mysql") {
                await executeMySQL(
                    `UPDATE dry_ice_orders SET scheduled_date = DATE_ADD(scheduled_date, INTERVAL ? DAY) WHERE id = ? OR parent_order_id = ?`,
                    [dayDifference, seriesId, seriesId]
                );
                // Sync to others
                syncToCloud(async () => {
                    const { data } = await supabase.from("dry_ice_orders").select("*").or(`id.eq.${seriesId},parent_order_id.eq.${seriesId}`);
                    if (data) {
                        const updates = data.map((o: any) => {
                            const d = new Date(o.scheduled_date);
                            d.setDate(d.getDate() + dayDifference);
                            return { ...o, scheduled_date: d.toISOString().split('T')[0] };
                        });
                        await supabase.from("dry_ice_orders").upsert(updates);
                    }
                });
                return true;
            }
            
            const client = getPrimarySupabaseClient();
            const { data: seriesOrders, error: fetchError } = await client
                .from("dry_ice_orders")
                .select("*")
                .or(`id.eq.${seriesId},parent_order_id.eq.${seriesId}`);

            if (fetchError) throw fetchError;
            if (!seriesOrders || seriesOrders.length === 0) return true;

            const updates = seriesOrders.map((order: any) => {
                const date = new Date(order.scheduled_date);
                date.setDate(date.getDate() + dayDifference);
                return { ...order, scheduled_date: date.toISOString().split('T')[0] };
            });

            const { error: updateError } = await client.from("dry_ice_orders").upsert(updates);
            if (updateError) throw updateError;

            syncToMySQL(async () => {
                await executeMySQL(
                    `UPDATE dry_ice_orders SET scheduled_date = DATE_ADD(scheduled_date, INTERVAL ? DAY) WHERE id = ? OR parent_order_id = ?`,
                    [dayDifference, seriesId, seriesId]
                );
            });
            syncToExternalSupabase(async (ext) => {
                await ext.from("dry_ice_orders").upsert(updates);
            });
            syncToCloud(async () => {
                await supabase.from("dry_ice_orders").upsert(updates);
            });
            return true;
        },
        delete: async (id: string) => {
            return primaryDelete("dry_ice_orders", id);
        },
        deleteSeries: async (seriesId: string) => {
            const source = getPrimarySource();
            
            if (source === "mysql") {
                await executeMySQL("DELETE FROM dry_ice_orders WHERE id = ? OR parent_order_id = ?", [seriesId, seriesId]);
                syncToCloud(async () => {
                    await supabase.from("dry_ice_orders").delete().or(`id.eq.${seriesId},parent_order_id.eq.${seriesId}`);
                });
                syncToExternalSupabase(async (ext) => {
                    await ext.from("dry_ice_orders").delete().or(`id.eq.${seriesId},parent_order_id.eq.${seriesId}`);
                });
                return true;
            }
            
            const client = getPrimarySupabaseClient();
            const { error } = await client.from("dry_ice_orders").delete().or(`id.eq.${seriesId},parent_order_id.eq.${seriesId}`);
            if (error) throw error;
            
            syncToMySQL(async () => {
                await executeMySQL("DELETE FROM dry_ice_orders WHERE id = ? OR parent_order_id = ?", [seriesId, seriesId]);
            });
            syncToExternalSupabase(async (ext) => {
                await ext.from("dry_ice_orders").delete().or(`id.eq.${seriesId},parent_order_id.eq.${seriesId}`);
            });
            syncToCloud(async () => {
                await supabase.from("dry_ice_orders").delete().or(`id.eq.${seriesId},parent_order_id.eq.${seriesId}`);
            });
            return true;
        }
    },

    tasks: {
        getAll: async () => {
            return primaryRead("tasks", { orderBy: "due_date" });
        },
        create: async (item: any) => {
            return primaryCreate("tasks", item);
        },
        update: async (id: string, item: any) => {
            return primaryUpdate("tasks", id, item);
        },
        delete: async (id: string) => {
            return primaryDelete("tasks", id);
        }
    },

    timeOffRequests: {
        getAll: async () => {
            return primaryRead("time_off_requests", { orderBy: "start_date", orderAsc: false });
        },
        create: async (item: any) => {
            return primaryCreate("time_off_requests", item);
        },
        update: async (id: string, item: any) => {
            return primaryUpdate("time_off_requests", id, item);
        },
        delete: async (id: string) => {
            return primaryDelete("time_off_requests", id);
        }
    },

    profiles: {
        getAll: async () => {
            return primaryRead("profiles", { orderBy: "full_name" });
        },
        getByUserId: async (userId: string) => {
            const source = getPrimarySource();
            if (source === "mysql") {
                const rows = await executeMySQL("SELECT * FROM profiles WHERE user_id = ? LIMIT 1", [userId]);
                if (!rows || rows.length === 0) throw new Error("Profile not found");
                return rows[0];
            }
            const client = getPrimarySupabaseClient();
            const { data, error } = await client.from("profiles").select("*").eq("user_id", userId).single();
            if (error) throw error;
            return data;
        },
        create: async (item: any) => {
            return primaryCreate("profiles", item);
        },
        update: async (id: string, item: any) => {
            return primaryUpdate("profiles", id, item);
        }
    },

    reports: {
        getDailyProductionByPeriod: async (fromDate: string, toDate: string, location: string | null) => {
            // Reports always use cloud Supabase RPCs (they rely on RLS/RBAC)
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
            return primaryRead("time_off_types", { orderBy: "name" });
        },
        create: async (item: any) => {
            return primaryCreate("time_off_types", item);
        },
        update: async (id: string, item: any) => {
            return primaryUpdate("time_off_types", id, item);
        },
        delete: async (id: string) => {
            return primaryDelete("time_off_types", id);
        }
    },

    admin: {
        repairDatabase: async () => {
            const config = getConfig();
            if (config?.useMySQL || config?.primarySource === "mysql") {
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
