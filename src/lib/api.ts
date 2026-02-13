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
        },
        merge: async (sourceId: string, targetId: string, deleteSource: boolean = false) => {
            const source = getPrimarySource();

            if (source === "mysql") {
                // MySQL Transaction for atomicity would be ideal, but we'll do sequential updates for now
                // 1. Update Gas Cylinder Orders
                await executeMySQL(`UPDATE gas_cylinder_orders SET customer_id = ? WHERE customer_id = ?`, [targetId, sourceId]);

                // 2. Update Dry Ice Orders
                await executeMySQL(`UPDATE dry_ice_orders SET customer_id = ? WHERE customer_id = ?`, [targetId, sourceId]);

                // 3. Delete source customer if requested
                if (deleteSource) {
                    await executeMySQL(`DELETE FROM customers WHERE id = ?`, [sourceId]);
                }

                // Sync to Cloud/External
                syncToCloud(async () => {
                    await supabase.rpc('merge_customers', {
                        source_id: sourceId,
                        target_id: targetId,
                        delete_source: deleteSource
                    });
                });
                syncToExternalSupabase(async (ext) => {
                    await ext.rpc('merge_customers', {
                        source_id: sourceId,
                        target_id: targetId,
                        delete_source: deleteSource
                    });
                });

                return true;
            }

            const client = getPrimarySupabaseClient();
            // Call RPC function on Supabase to handle the merge atomically
            const { error } = await client.rpc('merge_customers', {
                source_id: sourceId,
                target_id: targetId,
                delete_source: deleteSource
            });

            if (error) {
                // Fallback if RPC doesn't exist yet, do it manually (less safe but works for now)
                console.warn("RPC merge_customers not found, falling back to manual updates", error);

                // 1. Update Gas Cylinder Orders
                const { error: err1 } = await client.from('gas_cylinder_orders').update({ customer_id: targetId }).eq('customer_id', sourceId);
                if (err1) throw err1;

                // 2. Update Dry Ice Orders
                const { error: err2 } = await client.from('dry_ice_orders').update({ customer_id: targetId }).eq('customer_id', sourceId);
                if (err2) throw err2;

                // 3. Delete source if requested
                if (deleteSource) {
                    const { error: err3 } = await client.from('customers').delete().eq('id', sourceId);
                    if (err3) throw err3;
                }
            }

            syncToMySQL(async () => {
                await executeMySQL(`UPDATE gas_cylinder_orders SET customer_id = ? WHERE customer_id = ?`, [targetId, sourceId]);
                await executeMySQL(`UPDATE dry_ice_orders SET customer_id = ? WHERE customer_id = ?`, [targetId, sourceId]);
                if (deleteSource) {
                    await executeMySQL(`DELETE FROM customers WHERE id = ?`, [sourceId]);
                }
            });

            syncToExternalSupabase(async (ext) => {
                await ext.rpc('merge_customers', {
                    source_id: sourceId,
                    target_id: targetId,
                    delete_source: deleteSource
                });
            });
            syncToCloud(async () => {
                await supabase.rpc('merge_customers', {
                    source_id: sourceId,
                    target_id: targetId,
                    delete_source: deleteSource
                });
            });

            return true;
        },
        getOrphans: async () => {
            const source = getPrimarySource();
            if (source === "mysql") {
                const query = `
                    SELECT DISTINCT gco.customer_id, gco.customer_name
                    FROM gas_cylinder_orders gco
                    LEFT JOIN customers c ON gco.customer_id = c.id
                    WHERE c.id IS NULL
                    UNION
                    SELECT DISTINCT dio.customer_id, dio.customer_name
                    FROM dry_ice_orders dio
                    LEFT JOIN customers c ON dio.customer_id = c.id
                    WHERE c.id IS NULL
                `;
                return executeMySQL(query);
            }

            const client = getPrimarySupabaseClient();
            // Using a raw query via rpc or just checking against customers
            // Since we can't easily do a cross-table join with missing parents in simple Supabase client query without relation
            // We'll use a specific RPC for this if possible, or fetch all and diff (less efficient but works for small datasets)

            const { data: orphans, error } = await client.rpc('get_orphaned_customers');
            if (error) {
                console.warn("RPC get_orphaned_customers not found, falling back to manual diff (may be slow)");
                // Fallback: Fetch all order customer_ids and all customer ids, and diff
                const { data: customers } = await client.from('customers').select('id');
                const existingIds = new Set(customers?.map(c => c.id));

                const { data: orders } = await client.from('gas_cylinder_orders').select('customer_id, customer_name');
                const { data: dryIce } = await client.from('dry_ice_orders').select('customer_id, customer_name');

                const orphans = new Map<string, string>();
                orders?.forEach(o => {
                    if (o.customer_id && !existingIds.has(o.customer_id)) orphans.set(o.customer_id, o.customer_name);
                });
                dryIce?.forEach(o => {
                    if (o.customer_id && !existingIds.has(o.customer_id)) orphans.set(o.customer_id, o.customer_name);
                });

                return Array.from(orphans.entries()).map(([id, name]) => ({ customer_id: id, customer_name: name }));
            }
            return orphans;
        },
        reviveOrphan: async (id: string, name: string) => {
            // Create a customer with the specific ID
            return primaryCreate("customers", { id, name, is_active: true });
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
                orderBy: "updated_at",
                orderAsc: false,
                limit: 5000,
                mysqlQuery: `SELECT * FROM gas_cylinder_orders WHERE scheduled_date >= '${startDate}' AND scheduled_date <= '${endDate}' ORDER BY updated_at DESC LIMIT 5000`
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
                orderBy: "updated_at",
                orderAsc: false,
                mysqlQuery: `SELECT * FROM gas_cylinder_orders WHERE status = 'pending' AND scheduled_date >= '${fromDate}' ORDER BY updated_at DESC`
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
        getByUser: async (userId: string) => {
            return primaryRead("time_off_requests", {
                filters: [{ column: "user_id", op: "eq", value: userId }],
                orderBy: "created_at",
                orderAsc: false
            });
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
            const source = getPrimarySource();
            if (source === "mysql") {
                const locClause = location ? " AND location = ?" : "";
                const baseParams = [fromDate, toDate];
                if (location) baseParams.push(location);
                // We need params for both parts of UNION
                const params = [...baseParams, ...baseParams];

                const query = `
                    SELECT 
                        production_date,
                        CAST(COALESCE(SUM(cylinder_count), 0) AS SIGNED) as cylinder_count,
                        COALESCE(SUM(dry_ice_kg), 0) as dry_ice_kg
                    FROM (
                        SELECT scheduled_date as production_date, cylinder_count, 0 as dry_ice_kg 
                        FROM gas_cylinder_orders 
                        WHERE scheduled_date >= ? AND scheduled_date <= ? AND status != 'cancelled'${locClause}
                        
                        UNION ALL
                        
                        SELECT scheduled_date as production_date, 0 as cylinder_count, quantity_kg as dry_ice_kg 
                        FROM dry_ice_orders 
                        WHERE scheduled_date >= ? AND scheduled_date <= ? AND status != 'cancelled'${locClause}
                    ) as combined
                    GROUP BY production_date
                    ORDER BY production_date
                `;
                return executeMySQL(query, params);
            }

            const client = getPrimarySupabaseClient();
            const { data, error } = await client.rpc("get_daily_production_by_period", {
                p_from_date: fromDate,
                p_to_date: toDate,
                p_location: location
            });
            if (error) throw error;
            return data;
        },

        getGasTypeDistribution: async (fromDate: string, toDate: string, location: string | null) => {
            const source = getPrimarySource();
            if (source === "mysql") {
                const params = [fromDate, toDate];
                if (location) params.push(location);
                const locClause = location ? " AND gco.location = ?" : "";

                const query = `
                    SELECT 
                        gt.id as gas_type_id,
                        COALESCE(gt.name, 'Onbekend') as gas_type_name,
                        COALESCE(gt.color, '#3b82f6') as gas_type_color,
                        CAST(COALESCE(SUM(gco.cylinder_count), 0) AS SIGNED) as total_cylinders
                    FROM gas_cylinder_orders gco
                    LEFT JOIN gas_types gt ON gco.gas_type_id = gt.id
                    WHERE gco.scheduled_date >= ? AND gco.scheduled_date <= ? AND gco.status != 'cancelled'${locClause}
                    GROUP BY gt.id, gt.name, gt.color
                    ORDER BY total_cylinders DESC
                `;
                return executeMySQL(query, params);
            }

            const client = getPrimarySupabaseClient();
            const { data, error } = await client.rpc("get_gas_type_distribution_by_period", {
                p_from_date: fromDate,
                p_to_date: toDate,
                p_location: location
            });
            if (error) throw error;
            return data;
        },

        getGasCategoryDistribution: async (fromDate: string, toDate: string, location: string | null) => {
            const source = getPrimarySource();
            if (source === "mysql") {
                const params = [fromDate, toDate];
                if (location) params.push(location);
                const locClause = location ? " AND gco.location = ?" : "";

                const query = `
                    SELECT 
                        gtc.id as category_id,
                        COALESCE(gtc.name, 'Geen categorie') as category_name,
                        CAST(COALESCE(SUM(gco.cylinder_count), 0) AS SIGNED) as total_cylinders
                    FROM gas_cylinder_orders gco
                    LEFT JOIN gas_types gt ON gco.gas_type_id = gt.id
                    LEFT JOIN gas_type_categories gtc ON gt.category_id = gtc.id
                    WHERE gco.scheduled_date >= ? AND gco.scheduled_date <= ? AND gco.status != 'cancelled'${locClause}
                    GROUP BY gtc.id, gtc.name
                    ORDER BY total_cylinders DESC
                `;
                return executeMySQL(query, params);
            }

            const client = getPrimarySupabaseClient();
            const { data, error } = await client.rpc("get_gas_category_distribution_by_period" as any, {
                p_from_date: fromDate,
                p_to_date: toDate,
                p_location: location
            });
            if (error) throw error;
            return data;
        },

        getProductionEfficiency: async (fromDate: string, toDate: string, location: string | null) => {
            const source = getPrimarySource();
            if (source === "mysql") {
                const params = [fromDate, toDate];
                if (location) params.push(location);
                const locClause = location ? " AND location = ?" : "";

                const query = `
                    SELECT 
                        COUNT(*) as total_orders,
                        COALESCE(SUM(status = 'completed'), 0) as completed_orders,
                        COALESCE(SUM(status = 'pending'), 0) as pending_orders,
                        COALESCE(SUM(status = 'cancelled'), 0) as cancelled_orders,
                        CASE 
                            WHEN (COUNT(*) - COALESCE(SUM(status = 'cancelled'), 0)) = 0 THEN 0
                            ELSE ROUND(COALESCE(SUM(status = 'completed'), 0) * 100.0 / (COUNT(*) - COALESCE(SUM(status = 'cancelled'), 0)), 1)
                        END as efficiency_rate,
                        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN cylinder_count ELSE 0 END), 0) as total_cylinders,
                        COALESCE(SUM(CASE WHEN status = 'completed' THEN cylinder_count ELSE 0 END), 0) as completed_cylinders
                    FROM gas_cylinder_orders
                    WHERE scheduled_date >= ? AND scheduled_date <= ?${locClause}
                `;
                return executeMySQL(query, params);
            }

            const client = getPrimarySupabaseClient();
            const { data, error } = await client.rpc("get_production_efficiency_by_period", {
                p_from_date: fromDate,
                p_to_date: toDate,
                p_location: location
            });
            if (error) throw error;
            return data;
        },

        getProductionEfficiencyYearly: async (year: number, location: string | null) => {
            const source = getPrimarySource();
            if (source === "mysql") {
                const params: any[] = [year];
                if (location) params.push(location);
                const locClause = location ? " AND location = ?" : "";

                const query = `
                    SELECT 
                        COUNT(*) as total_orders,
                        COALESCE(SUM(status = 'completed'), 0) as completed_orders,
                        COALESCE(SUM(status = 'pending'), 0) as pending_orders,
                        COALESCE(SUM(status = 'cancelled'), 0) as cancelled_orders,
                        CASE 
                            WHEN (COUNT(*) - COALESCE(SUM(status = 'cancelled'), 0)) = 0 THEN 0
                            ELSE ROUND(COALESCE(SUM(status = 'completed'), 0) * 100.0 / (COUNT(*) - COALESCE(SUM(status = 'cancelled'), 0)), 1)
                        END as efficiency_rate,
                        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN cylinder_count ELSE 0 END), 0) as total_cylinders,
                        COALESCE(SUM(CASE WHEN status = 'completed' THEN cylinder_count ELSE 0 END), 0) as completed_cylinders
                    FROM gas_cylinder_orders
                    WHERE YEAR(scheduled_date) = ?${locClause}
                `;
                return executeMySQL(query, params);
            }

            const client = getPrimarySupabaseClient();
            const { data, error } = await client.rpc("get_production_efficiency", {
                p_year: year,
                p_location: location
            });
            if (error) throw error;
            return data;
        },

        getCylinderTotal: async (fromDate: string, toDate: string, location: string | null) => {
            const source = getPrimarySource();
            if (source === "mysql") {
                const params = [fromDate, toDate];
                if (location) params.push(location);
                const locClause = location ? " AND location = ?" : "";

                const query = `SELECT COALESCE(SUM(cylinder_count), 0) as total FROM gas_cylinder_orders WHERE scheduled_date >= ? AND scheduled_date <= ? AND status != 'cancelled'${locClause}`;
                const rows = await executeMySQL(query, params);
                return rows?.[0]?.total || 0;
            }

            const client = getPrimarySupabaseClient();
            let query = client
                .from("gas_cylinder_orders")
                .select("cylinder_count")
                .gte("scheduled_date", fromDate)
                .lte("scheduled_date", toDate)
                .neq("status", "cancelled");

            if (location) {
                query = query.eq("location", location);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data?.reduce((sum, o) => sum + o.cylinder_count, 0) || 0;
        },

        getCustomerSegments: async (year: number, location: string | null) => {
            const source = getPrimarySource();
            if (source === "mysql") {
                const params: any[] = [year]; // For trend analysis year check

                // Query params construction needs to match the placeholders in the query.
                // Queries:
                // 1. Trend analysis (year)
                // 2. Subquery 1 (year)
                // 3. Subquery 1 (location - optional)
                // 4. Subquery 2 (year)
                // 5. Subquery 2 (location - optional)

                params.push(year); // Subquery 1 year
                if (location) params.push(location); // Subquery 1 location
                params.push(year); // Subquery 2 year
                if (location) params.push(location); // Subquery 2 location

                const locClauseCyl = location ? " AND location = ?" : "";
                const locClauseDry = location ? " AND location = ?" : "";

                const query = `
                    SELECT 
                        customer_id,
                        COALESCE(MAX(customer_name), 'Onbekend') as customer_name,
                        CAST(SUM(cylinders) AS SIGNED) as total_cylinders,
                        SUM(dry_ice_kg) as total_dry_ice_kg,
                        COUNT(*) as order_count,
                        MIN(order_date) as first_order_date,
                        MAX(order_date) as last_order_date,
                        (SUM(cylinders) + SUM(dry_ice_kg)) / NULLIF(COUNT(*), 0) as avg_order_size,
                        CASE 
                            WHEN (SUM(cylinders) + SUM(dry_ice_kg)) >= 1000 THEN 'gold'
                            WHEN (SUM(cylinders) + SUM(dry_ice_kg)) >= 500 THEN 'silver'
                            ELSE 'bronze'
                        END as tier,
                        CASE 
                            WHEN MIN(order_date) >= STR_TO_DATE(CONCAT(?, '-01-01'), '%Y-%m-%d') THEN 'new'
                            ELSE 'stable'
                        END as trend
                    FROM (
                        SELECT customer_id, customer_name, cylinder_count as cylinders, 0 as dry_ice_kg, scheduled_date as order_date 
                        FROM gas_cylinder_orders 
                        WHERE YEAR(scheduled_date) = ? AND status != 'cancelled'${locClauseCyl}
                        
                        UNION ALL
                        
                        SELECT customer_id, customer_name, 0 as cylinders, quantity_kg as dry_ice_kg, scheduled_date as order_date 
                        FROM dry_ice_orders 
                        WHERE YEAR(scheduled_date) = ? AND status != 'cancelled'${locClauseDry}
                    ) as combined
                    GROUP BY customer_id
                    ORDER BY (SUM(cylinders) + SUM(dry_ice_kg)) DESC
                `;

                return executeMySQL(query, params);
            }

            const client = getPrimarySupabaseClient();
            const { data, error } = await client.rpc("get_customer_segments", {
                p_year: year,
                p_location: location
            });
            if (error) throw error;
            return data;
        },

        getDryIceEfficiency: async (fromDate: string, toDate: string, location: string | null) => {
            const source = getPrimarySource();
            if (source === "mysql") {
                const params = [fromDate, toDate];
                if (location) params.push(location);
                const locClause = location ? " AND location = ?" : "";

                const query = `
                    SELECT 
                        COUNT(*) as total_orders,
                        COALESCE(SUM(status = 'completed'), 0) as completed_orders,
                        COALESCE(SUM(status = 'pending'), 0) as pending_orders,
                        COALESCE(SUM(status = 'cancelled'), 0) as cancelled_orders,
                        CASE 
                            WHEN (COUNT(*) - COALESCE(SUM(status = 'cancelled'), 0)) = 0 THEN 0
                            ELSE ROUND(COALESCE(SUM(status = 'completed'), 0) * 100.0 / (COUNT(*) - COALESCE(SUM(status = 'cancelled'), 0)), 1)
                        END as efficiency_rate,
                        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN quantity_kg ELSE 0 END), 0) as total_kg,
                        COALESCE(SUM(CASE WHEN status = 'completed' THEN quantity_kg ELSE 0 END), 0) as completed_kg
                    FROM dry_ice_orders
                    WHERE scheduled_date >= ? AND scheduled_date <= ?${locClause}
                `;
                return executeMySQL(query, params);
            }

            const client = getPrimarySupabaseClient();
            const { data, error } = await client.rpc("get_dry_ice_efficiency_by_period", {
                p_from_date: fromDate,
                p_to_date: toDate,
                p_location: location
            });
            if (error) throw error;
            return data;
        },

        getCustomerTotals: async (fromDate: string, toDate: string, location: string | null) => {
            const source = getPrimarySource();
            if (source === "mysql") {
                const locClauseCyl = location ? " AND location = ?" : "";
                const locClauseDry = location ? " AND location = ?" : "";
                const baseParams = [fromDate, toDate];
                if (location) baseParams.push(location);
                const params = [...baseParams, ...baseParams];

                const query = `
                    SELECT 
                        customer_id,
                        MAX(customer_name) as customer_name,
                        CAST(sum(cylinders) AS SIGNED) as total_cylinders,
                        sum(dry_ice) as total_dry_ice_kg
                    FROM (
                        SELECT customer_id, customer_name, cylinder_count as cylinders, 0 as dry_ice
                        FROM gas_cylinder_orders 
                        WHERE scheduled_date >= ? AND scheduled_date <= ? AND status != 'cancelled'${locClauseCyl}
                        
                        UNION ALL
                        
                        SELECT customer_id, customer_name, 0 as cylinders, quantity_kg as dry_ice
                        FROM dry_ice_orders 
                        WHERE scheduled_date >= ? AND scheduled_date <= ? AND status != 'cancelled'${locClauseDry}
                    ) as combined
                    GROUP BY customer_id
                    ORDER BY total_cylinders DESC
                `;
                return executeMySQL(query, params);
            }

            const client = getPrimarySupabaseClient();
            const { data, error } = await client.rpc("get_customer_totals_by_period", {
                p_from_date: fromDate,
                p_to_date: toDate,
                p_location: location
            });
            if (error) throw error;
            return data;
        },

        getMonthlyOrderTotals: async (year: number, orderType: 'cylinder' | 'dry_ice', location: string | null) => {
            const source = getPrimarySource();
            if (source === "mysql") {
                const table = orderType === 'cylinder' ? 'gas_cylinder_orders' : 'dry_ice_orders';
                const col = orderType === 'cylinder' ? 'cylinder_count' : 'quantity_kg';
                const params: any[] = [year, year];
                if (location) params.push(location);
                const locClause = location ? " AND location = ?" : "";

                const query = `
                    SELECT 
                        MONTH(scheduled_date) as month,
                        SUM(${col}) as total_value
                    FROM ${table}
                    WHERE scheduled_date >= STR_TO_DATE(CONCAT(?, '-01-01'), '%Y-%m-%d')
                      AND scheduled_date <= STR_TO_DATE(CONCAT(?, '-12-31'), '%Y-%m-%d')
                      AND status != 'cancelled'${locClause}
                    GROUP BY MONTH(scheduled_date)
                    ORDER BY month
                `;
                return executeMySQL(query, params);
            }

            const client = getPrimarySupabaseClient();
            const { data, error } = await client.rpc("get_monthly_order_totals", {
                p_year: year,
                p_order_type: orderType,
                p_location: location
            });
            if (error) throw error;
            return data;
        },

        getMonthlyCylinderTotalsByGasType: async (year: number, location: string | null) => {
            const source = getPrimarySource();
            if (source === "mysql") {
                const params: any[] = [year, year];
                if (location) params.push(location);
                const locClause = location ? " AND gco.location = ?" : "";

                const query = `
                    SELECT 
                        MONTH(gco.scheduled_date) as month,
                        gt.id as gas_type_id,
                        gt.name as gas_type_name,
                        gt.color as gas_type_color,
                        CAST(COALESCE(SUM(gco.cylinder_count), 0) AS SIGNED) as total_cylinders
                    FROM gas_cylinder_orders gco
                    LEFT JOIN gas_types gt ON gco.gas_type_id = gt.id
                    WHERE gco.scheduled_date >= STR_TO_DATE(CONCAT(?, '-01-01'), '%Y-%m-%d')
                      AND gco.scheduled_date <= STR_TO_DATE(CONCAT(?, '-12-31'), '%Y-%m-%d')
                      AND gco.status != 'cancelled'${locClause}
                    GROUP BY MONTH(gco.scheduled_date), gt.id, gt.name, gt.color
                    ORDER BY month, gas_type_name
                `;
                return executeMySQL(query, params);
            }

            const client = getPrimarySupabaseClient();
            const { data, error } = await client.rpc("get_monthly_cylinder_totals_by_gas_type", {
                p_year: year,
                p_location: location
            });
            if (error) throw error;
            return data;
        },

        getMonthlyCylinderTotalsBySize: async (year: number, location: string | null) => {
            const source = getPrimarySource();
            if (source === "mysql") {
                const params: any[] = [year, year];
                if (location) params.push(location);
                const locClause = location ? " AND gco.location = ?" : "";

                const query = `
                    SELECT 
                        MONTH(gco.scheduled_date) as month,
                        gco.cylinder_size,
                        CAST(COALESCE(SUM(gco.cylinder_count), 0) AS SIGNED) as total_cylinders
                    FROM gas_cylinder_orders gco
                    WHERE gco.scheduled_date >= STR_TO_DATE(CONCAT(?, '-01-01'), '%Y-%m-%d')
                      AND gco.scheduled_date <= STR_TO_DATE(CONCAT(?, '-12-31'), '%Y-%m-%d')
                      AND gco.status != 'cancelled'${locClause}
                    GROUP BY MONTH(gco.scheduled_date), gco.cylinder_size
                    ORDER BY month, gco.cylinder_size
                `;
                return executeMySQL(query, params);
            }

            const client = getPrimarySupabaseClient();
            const { data, error } = await client.rpc("get_monthly_cylinder_totals_by_size", {
                p_year: year,
                p_location: location
            });
            if (error) throw error;
            return data;
        },

        getYearlyTotalsByCustomer: async (year: number, location: string | null) => {
            const source = getPrimarySource();
            if (source === "mysql") {
                const finalParams: any[] = [year, year];
                if (location) finalParams.push(location);
                finalParams.push(year, year);
                if (location) finalParams.push(location);

                const locClauseCyl = location ? " AND gco.location = ?" : "";
                const locClauseDry = location ? " AND dio.location = ?" : "";

                const query = `
                    SELECT 
                        customer_id,
                        MAX(customer_name) as customer_name,
                        CAST(SUM(cylinders) AS SIGNED) as total_cylinders,
                        SUM(dry_ice) as total_dry_ice_kg
                    FROM (
                        SELECT customer_id, customer_name, cylinder_count as cylinders, 0 as dry_ice
                        FROM gas_cylinder_orders gco
                        WHERE gco.scheduled_date >= STR_TO_DATE(CONCAT(?, '-01-01'), '%Y-%m-%d')
                          AND gco.scheduled_date <= STR_TO_DATE(CONCAT(?, '-12-31'), '%Y-%m-%d')
                          AND gco.status != 'cancelled'${locClauseCyl}
                        
                        UNION ALL
                        
                        SELECT customer_id, customer_name, 0 as cylinders, quantity_kg as dry_ice
                        FROM dry_ice_orders dio
                        WHERE dio.scheduled_date >= STR_TO_DATE(CONCAT(?, '-01-01'), '%Y-%m-%d')
                          AND dio.scheduled_date <= STR_TO_DATE(CONCAT(?, '-12-31'), '%Y-%m-%d')
                          AND dio.status != 'cancelled'${locClauseDry}
                    ) as combined
                    GROUP BY customer_id
                    ORDER BY (SUM(cylinders) + SUM(dry_ice)) DESC
                `;
                return executeMySQL(query, finalParams);
            }

            const client = getPrimarySupabaseClient();
            const { data, error } = await client.rpc("get_yearly_totals_by_customer", {
                p_year: year,
                p_location: location
            });
            if (error) throw error;
            return data;
        },

        getMonthlyCylinderTotalsByCustomer: async (year: number, location: string | null) => {
            const source = getPrimarySource();
            if (source === "mysql") {
                const params: any[] = [year, year];
                if (location) params.push(location);
                const locClause = location ? " AND gco.location = ?" : "";

                const query = `
                    SELECT 
                        MONTH(gco.scheduled_date) as month,
                        gco.customer_id,
                        gco.customer_name,
                        CAST(COALESCE(SUM(gco.cylinder_count), 0) AS SIGNED) as total_cylinders
                    FROM gas_cylinder_orders gco
                    WHERE gco.scheduled_date >= STR_TO_DATE(CONCAT(?, '-01-01'), '%Y-%m-%d')
                      AND gco.scheduled_date <= STR_TO_DATE(CONCAT(?, '-12-31'), '%Y-%m-%d')
                      AND gco.status != 'cancelled'${locClause}
                    GROUP BY MONTH(gco.scheduled_date), gco.customer_id, gco.customer_name
                    ORDER BY month, total_cylinders DESC
                `;
                return executeMySQL(query, params);
            }

            const client = getPrimarySupabaseClient();
            const { data, error } = await client.rpc("get_monthly_cylinder_totals_by_customer", {
                p_year: year,
                p_location: location
            });
            if (error) throw error;
            return data;
        }
    },

    cylinderSizes: {
        getAll: async () => {
            return primaryRead("cylinder_sizes", {
                orderBy: "sort_order",
                filters: [{ column: "is_active", op: "eq", value: true }]
            });
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

    gasTypes: {
        getAll: async () => {
            return primaryRead("gas_types", {
                orderBy: "sort_order",
                secondOrder: "name",
                filters: [{ column: "is_active", op: "eq", value: true }]
            });
        },
        getByLocation: async (location: string) => {
            const source = getPrimarySource();
            if (source === "mysql") {
                // MySQL implementation of "get_distinct_gas_type_ids_by_location" logic
                // Assuming we want gas types that have been ordered at this location?
                // Or just all gas types? The RPC name suggests distinct IDs used at location.
                // Let's implement the logic: Select gas_types that have orders in this location.
                const query = `
                    SELECT DISTINCT gt.id
                    FROM gas_types gt
                    JOIN gas_cylinder_orders gco ON gco.gas_type_id = gt.id
                    WHERE gco.location = ?
                `;
                const rows = await executeMySQL(query, [location]);
                return rows || [];
            }

            const client = getPrimarySupabaseClient();
            const { data, error } = await client.rpc("get_distinct_gas_type_ids_by_location", {
                p_location: location
            });
            if (error) throw error;
            return data;
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

    userRoles: {
        get: async (userId: string) => {
            const source = getPrimarySource();
            if (source === "mysql") {
                const rows = await executeMySQL("SELECT role FROM user_roles WHERE user_id = ? LIMIT 1", [userId]);
                return rows?.[0] || null;
            }
            const client = getPrimarySupabaseClient();
            const { data, error } = await client
                .from("user_roles")
                .select("role")
                .eq("user_id", userId)
                .maybeSingle();
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
                    `CREATE TABLE IF NOT EXISTS profiles(
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
                    `CREATE TABLE IF NOT EXISTS time_off_requests(
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
                    `CREATE TABLE IF NOT EXISTS task_types(
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
