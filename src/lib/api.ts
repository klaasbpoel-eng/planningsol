import { supabase } from "@/integrations/supabase/client";
import { STORAGE_KEY_DATA_SOURCE, DataSourceConfig } from "@/components/admin/DataSourceSettings";

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

// --- Data Provider Interface ---

export const api = {
    customers: {
        getAll: async () => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("SELECT * FROM customers ORDER BY name ASC");
            } else {
                const { data, error } = await supabase
                    .from("customers")
                    .select("*")
                    .order("name");
                if (error) throw error;
                return data;
            }
        },

        delete: async (id: string) => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("DELETE FROM customers WHERE id = ?", [id]);
            } else {
                const { error } = await supabase.from("customers").delete().eq("id", id);
                if (error) throw error;
                return true;
            }
        },

        toggleActive: async (id: string, currentState: boolean) => {
            const config = getConfig();
            if (config?.useMySQL) {
                // MySQL stores booleans as 1/0 usually
                const newState = currentState ? 0 : 1;
                return executeMySQL("UPDATE customers SET is_active = ? WHERE id = ?", [newState, id]);
            } else {
                const { error } = await supabase
                    .from("customers")
                    .update({ is_active: !currentState })
                    .eq("id", id);
                if (error) throw error;
                return true;
            }
        },

        create: async (item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const id = item.id || crypto.randomUUID();
                const keys = Object.keys(item).filter(k => k !== 'id');
                const values = keys.map(k => item[k]);
                keys.unshift('id');
                values.unshift(id);
                const placeholders = keys.map(() => '?').join(',');
                return executeMySQL(`INSERT INTO customers (${keys.join(',')}) VALUES (${placeholders})`, values);
            } else {
                const { data, error } = await supabase.from("customers").insert(item).select().single();
                if (error) throw error;
                return data;
            }
        },

        update: async (id: string, item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const keys = Object.keys(item).filter(k => k !== 'id' && k !== 'created_at');
                const values = keys.map(k => item[k]);
                values.push(id);
                const setClause = keys.map(k => `${k} = ?`).join(',');
                return executeMySQL(`UPDATE customers SET ${setClause} WHERE id = ?`, values);
            } else {
                const { data, error } = await supabase.from("customers").update(item).eq("id", id).select().single();
                if (error) throw error;
                return data;
            }
        }
    },

    gasTypes: {
        getAll: async () => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("SELECT * FROM gas_types ORDER BY sort_order ASC, name ASC");
            } else {
                const { data, error } = await supabase
                    .from("gas_types")
                    .select("*")
                    .order("sort_order", { ascending: true })
                    .order("name", { ascending: true });
                if (error) throw error;
                return data;
            }
        },
        create: async (item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                // Generate ID if missing (simple random for now or let DB handle if auto-inc, but Supabase uses UUIDs usually)
                // For MySQL compatibility with Supabase UUIDs, we should probably generate one if not present,
                // or rely on the caller to provide it. Supabase client usually handles it or the DB default.
                // Let's assume the UI creates the object with ID or we let MySQL generate.
                // However, for strict compatibility, we should generate UUIDs if the schema expects char(36).
                const id = item.id || crypto.randomUUID();
                const keys = Object.keys(item).filter(k => k !== 'id');
                const values = keys.map(k => item[k]);
                // Add ID
                keys.unshift('id');
                values.unshift(id);

                const placeholders = keys.map(() => '?').join(',');
                const sql = `INSERT INTO gas_types (${keys.join(',')}) VALUES (${placeholders})`;
                return executeMySQL(sql, values);
            } else {
                const { data, error } = await supabase.from("gas_types").insert(item).select().single();
                if (error) throw error;
                return data;
            }
        },
        update: async (id: string, item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const keys = Object.keys(item).filter(k => k !== 'id' && k !== 'created_at');
                const values = keys.map(k => item[k]);
                values.push(id);
                const setClause = keys.map(k => `${k} = ?`).join(',');
                return executeMySQL(`UPDATE gas_types SET ${setClause} WHERE id = ?`, values);
            } else {
                const { data, error } = await supabase.from("gas_types").update(item).eq("id", id).select().single();
                if (error) throw error;
                return data;
            }
        },
        delete: async (id: string) => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("DELETE FROM gas_types WHERE id = ?", [id]);
            } else {
                const { error } = await supabase.from("gas_types").delete().eq("id", id);
                if (error) throw error;
                return true;
            }
        }
    },

    cylinderSizes: {
        getAll: async () => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("SELECT * FROM cylinder_sizes ORDER BY sort_order ASC");
            } else {
                const { data, error } = await supabase.from("cylinder_sizes").select("*").order("sort_order", { ascending: true });
                if (error) throw error;
                return data;
            }
        },
        create: async (item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const id = item.id || crypto.randomUUID();
                const keys = Object.keys(item).filter(k => k !== 'id');
                const values = keys.map(k => item[k]);
                keys.unshift('id');
                values.unshift(id);
                const placeholders = keys.map(() => '?').join(',');
                return executeMySQL(`INSERT INTO cylinder_sizes (${keys.join(',')}) VALUES (${placeholders})`, values);
            } else {
                const { data, error } = await supabase.from("cylinder_sizes").insert(item).select().single();
                if (error) throw error;
                return data;
            }
        },
        update: async (id: string, item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const keys = Object.keys(item).filter(k => k !== 'id' && k !== 'created_at');
                const values = keys.map(k => item[k]);
                values.push(id);
                const setClause = keys.map(k => `${k} = ?`).join(',');
                return executeMySQL(`UPDATE cylinder_sizes SET ${setClause} WHERE id = ?`, values);
            } else {
                const { data, error } = await supabase.from("cylinder_sizes").update(item).eq("id", id).select().single();
                if (error) throw error;
                return data;
            }
        },
        delete: async (id: string) => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("DELETE FROM cylinder_sizes WHERE id = ?", [id]);
            } else {
                const { error } = await supabase.from("cylinder_sizes").delete().eq("id", id);
                if (error) throw error;
                return true;
            }
        }
    },

    dryIceProductTypes: {
        getAll: async () => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("SELECT * FROM dry_ice_product_types ORDER BY sort_order ASC");
            } else {
                const { data, error } = await supabase.from("dry_ice_product_types").select("*").order("sort_order", { ascending: true });
                if (error) throw error;
                return data;
            }
        },
        create: async (item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const id = item.id || crypto.randomUUID();
                const keys = Object.keys(item).filter(k => k !== 'id');
                const values = keys.map(k => item[k]);
                keys.unshift('id');
                values.unshift(id);
                const placeholders = keys.map(() => '?').join(',');
                return executeMySQL(`INSERT INTO dry_ice_product_types (${keys.join(',')}) VALUES (${placeholders})`, values);
            } else {
                const { data, error } = await supabase.from("dry_ice_product_types").insert(item).select().single();
                if (error) throw error;
                return data;
            }
        },
        update: async (id: string, item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const keys = Object.keys(item).filter(k => k !== 'id' && k !== 'created_at');
                const values = keys.map(k => item[k]);
                values.push(id);
                const setClause = keys.map(k => `${k} = ?`).join(',');
                return executeMySQL(`UPDATE dry_ice_product_types SET ${setClause} WHERE id = ?`, values);
            } else {
                const { data, error } = await supabase.from("dry_ice_product_types").update(item).eq("id", id).select().single();
                if (error) throw error;
                return data;
            }
        },
        delete: async (id: string) => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("DELETE FROM dry_ice_product_types WHERE id = ?", [id]);
            } else {
                const { error } = await supabase.from("dry_ice_product_types").delete().eq("id", id);
                if (error) throw error;
                return true;
            }
        }
    },

    dryIcePackaging: {
        getAll: async () => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("SELECT * FROM dry_ice_packaging ORDER BY sort_order ASC");
            } else {
                const { data, error } = await supabase.from("dry_ice_packaging").select("*").order("sort_order", { ascending: true });
                if (error) throw error;
                return data;
            }
        },
        create: async (item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const id = item.id || crypto.randomUUID();
                const keys = Object.keys(item).filter(k => k !== 'id');
                const values = keys.map(k => item[k]);
                keys.unshift('id');
                values.unshift(id);
                const placeholders = keys.map(() => '?').join(',');
                return executeMySQL(`INSERT INTO dry_ice_packaging (${keys.join(',')}) VALUES (${placeholders})`, values);
            } else {
                const { data, error } = await supabase.from("dry_ice_packaging").insert(item).select().single();
                if (error) throw error;
                return data;
            }
        },
        update: async (id: string, item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const keys = Object.keys(item).filter(k => k !== 'id' && k !== 'created_at');
                const values = keys.map(k => item[k]);
                values.push(id);
                const setClause = keys.map(k => `${k} = ?`).join(',');
                return executeMySQL(`UPDATE dry_ice_packaging SET ${setClause} WHERE id = ?`, values);
            } else {
                const { data, error } = await supabase.from("dry_ice_packaging").update(item).eq("id", id).select().single();
                if (error) throw error;
                return data;
            }
        },
        delete: async (id: string) => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("DELETE FROM dry_ice_packaging WHERE id = ?", [id]);
            } else {
                const { error } = await supabase.from("dry_ice_packaging").delete().eq("id", id);
                if (error) throw error;
                return true;
            }
        }
    },

    taskTypes: {
        getAll: async () => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("SELECT * FROM task_types ORDER BY sort_order ASC");
            } else {
                const { data, error } = await supabase.from("task_types").select("*").order("sort_order", { ascending: true });
                if (error) throw error;
                return data;
            }
        },
        // ... Create/Update/Delete simplified for now as CategoryManagement is complex
        create: async (item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const id = item.id || crypto.randomUUID();
                const keys = Object.keys(item).filter(k => k !== 'id');
                const values = keys.map(k => item[k]);
                keys.unshift('id');
                values.unshift(id);
                const placeholders = keys.map(() => '?').join(',');
                return executeMySQL(`INSERT INTO task_types (${keys.join(',')}) VALUES (${placeholders})`, values);
            } else {
                const { data, error } = await supabase.from("task_types").insert(item).select().single();
                if (error) throw error;
                return data;
            }
        },
        update: async (id: string, item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const keys = Object.keys(item).filter(k => k !== 'id' && k !== 'created_at');
                const values = keys.map(k => item[k]);
                values.push(id);
                const setClause = keys.map(k => `${k} = ?`).join(',');
                return executeMySQL(`UPDATE task_types SET ${setClause} WHERE id = ?`, values);
            } else {
                const { data, error } = await supabase.from("task_types").update(item).eq("id", id).select().single();
                if (error) throw error;
                return data;
            }
        },
        delete: async (id: string) => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("DELETE FROM task_types WHERE id = ?", [id]);
            } else {
                const { error } = await supabase.from("task_types").delete().eq("id", id);
                if (error) throw error;
                return true;
            }
        }
    },

    gasTypeCategories: {
        getAll: async () => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("SELECT * FROM gas_type_categories ORDER BY sort_order ASC");
            } else {
                const { data, error } = await supabase.from("gas_type_categories").select("*").order("sort_order", { ascending: true });
                if (error) throw error;
                return data;
            }
        },
        create: async (item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const id = item.id || crypto.randomUUID();
                const keys = Object.keys(item).filter(k => k !== 'id');
                const values = keys.map(k => item[k]);
                keys.unshift('id');
                values.unshift(id);
                const placeholders = keys.map(() => '?').join(',');
                return executeMySQL(`INSERT INTO gas_type_categories (${keys.join(',')}) VALUES (${placeholders})`, values);
            } else {
                const { data, error } = await supabase.from("gas_type_categories").insert(item).select().single();
                if (error) throw error;
                return data;
            }
        },
        update: async (id: string, item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const keys = Object.keys(item).filter(k => k !== 'id' && k !== 'created_at');
                const values = keys.map(k => item[k]);
                values.push(id);
                const setClause = keys.map(k => `${k} = ?`).join(',');
                return executeMySQL(`UPDATE gas_type_categories SET ${setClause} WHERE id = ?`, values);
            } else {
                const { data, error } = await supabase.from("gas_type_categories").update(item).eq("id", id).select().single();
                if (error) throw error;
                return data;
            }
        },
        delete: async (id: string) => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("DELETE FROM gas_type_categories WHERE id = ?", [id]);
            } else {
                const { error } = await supabase.from("gas_type_categories").delete().eq("id", id);
                if (error) throw error;
                return true;
            }
        }
    },

    appSettings: {
        getByKey: async (key: string) => {
            const config = getConfig();
            if (config?.useMySQL) {
                // MySQL implementation
                const rows = await executeMySQL("SELECT value, description FROM app_settings WHERE `key` = ?", [key]);
                return rows[0] || null;
            } else {
                // Supabase implementation
                const { data, error } = await supabase
                    .from("app_settings")
                    .select("value, description")
                    .eq("key", key)
                    .maybeSingle();
                if (error) throw error;
                return data;
            }
        },
        upsert: async (key: string, value: string, description?: string) => {
            const config = getConfig();
            if (config?.useMySQL) {
                // MySQL implementation
                await executeMySQL(
                    "INSERT INTO app_settings (`key`, value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value = ?, description = ?",
                    [key, value, description || null, value, description || null]
                );
                return { key, value };
            } else {
                // Supabase implementation
                const { data, error } = await supabase
                    .from("app_settings")
                    .upsert(
                        { key, value, description },
                        { onConflict: "key" }
                    )
                    .select()
                    .single();
                if (error) throw error;
                return data;
            }
        }
    },

    gasCylinderOrders: {
        getAll: async (startDate: string, endDate: string) => {
            const config = getConfig();
            if (config?.useMySQL) {
                // MySQL implementation with JOIN to simulate Supabase response structure
                const query = `
                    SELECT o.*, 
                           g.id as gas_ref_id, g.name as gas_ref_name, g.color as gas_ref_color 
                    FROM gas_cylinder_orders o 
                    LEFT JOIN gas_types g ON o.gas_type_id = g.id 
                    WHERE o.scheduled_date >= ? AND o.scheduled_date <= ?
                    ORDER BY o.scheduled_date ASC
                `;
                const rows = await executeMySQL(query, [startDate, endDate]);
                // Map flat rows to nested objects
                return rows.map((row: any) => {
                    const { gas_ref_id, gas_ref_name, gas_ref_color, ...order } = row;
                    return {
                        ...order,
                        gas_type_ref: gas_ref_id ? { id: gas_ref_id, name: gas_ref_name, color: gas_ref_color } : null
                    };
                });
            } else {
                // Supabase implementation
                const { data, error } = await supabase
                    .from("gas_cylinder_orders")
                    .select(`
                        *,
                        gas_type_ref:gas_types(id, name, color)
                    `)
                    .gte("scheduled_date", startDate)
                    .lte("scheduled_date", endDate)
                    .order("scheduled_date", { ascending: true })
                    .limit(5000); // Higher limit as requested
                if (error) throw error;
                return data;
            }
        },
        create: async (item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const id = item.id || crypto.randomUUID();

                // Explicitly select columns to ensure correct order and presence
                const columns = [
                    'id', 'order_number', 'customer_name', 'customer_id',
                    'gas_type', 'gas_type_id', 'gas_grade', 'cylinder_count',
                    'cylinder_size', 'pressure', 'scheduled_date', 'notes',
                    'created_by', 'status', 'location'
                ];

                const values = columns.map(col => {
                    if (col === 'id') return id;
                    const val = item[col];
                    return val === undefined ? null : val;
                });

                const placeholders = columns.map(() => '?').join(',');
                return executeMySQL(`INSERT INTO gas_cylinder_orders (${columns.join(',')}) VALUES (${placeholders})`, values);
            } else {
                const { data, error } = await supabase.from("gas_cylinder_orders").insert(item).select().single();
                if (error) throw error;
                return data;
            }
        },
        update: async (id: string, item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const keys = Object.keys(item).filter(k => k !== 'id' && k !== 'created_at' && k !== 'gas_type_ref');
                const values = keys.map(k => item[k]);
                values.push(id);
                const setClause = keys.map(k => `${k} = ?`).join(',');
                return executeMySQL(`UPDATE gas_cylinder_orders SET ${setClause} WHERE id = ?`, values);
            } else {
                const { data, error } = await supabase.from("gas_cylinder_orders").update(item).eq("id", id).select().single();
                if (error) throw error;
                return data;
            }
        },
        delete: async (id: string) => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("DELETE FROM gas_cylinder_orders WHERE id = ?", [id]);
            } else {
                const { error } = await supabase.from("gas_cylinder_orders").delete().eq("id", id);
                if (error) throw error;
                return true;
            }
        },
        getPending: async (fromDate: string) => {
            const config = getConfig();
            if (config?.useMySQL) {
                // MySQL implementation with JOIN to simulate Supabase response structure
                const query = `
                    SELECT o.*, 
                           g.id as gas_ref_id, g.name as gas_ref_name, g.color as gas_ref_color 
                    FROM gas_cylinder_orders o 
                    LEFT JOIN gas_types g ON o.gas_type_id = g.id 
                    WHERE o.status = 'pending' AND o.scheduled_date >= ?
                    ORDER BY o.scheduled_date ASC
                `;
                const rows = await executeMySQL(query, [fromDate]);
                // Map flat rows to nested objects
                return rows.map((row: any) => {
                    const { gas_ref_id, gas_ref_name, gas_ref_color, ...order } = row;
                    return {
                        ...order,
                        gas_type_ref: gas_ref_id ? { id: gas_ref_id, name: gas_ref_name, color: gas_ref_color } : null
                    };
                });
            } else {
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
        }
    },

    dryIceOrders: {
        getAll: async (startDate: string, endDate: string) => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL(
                    "SELECT * FROM dry_ice_orders WHERE scheduled_date >= ? AND scheduled_date <= ? ORDER BY scheduled_date ASC",
                    [startDate, endDate]
                );
            } else {
                const { data, error } = await supabase
                    .from("dry_ice_orders")
                    .select("*")
                    .gte("scheduled_date", startDate)
                    .lte("scheduled_date", endDate)
                    .order("scheduled_date", { ascending: true });
                if (error) throw error;
                return data;
            }
        },
        getPending: async (fromDate: string) => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL(
                    "SELECT * FROM dry_ice_orders WHERE status = 'pending' AND scheduled_date >= ? ORDER BY scheduled_date ASC",
                    [fromDate]
                );
            } else {
                const { data, error } = await supabase
                    .from("dry_ice_orders")
                    .select("*")
                    .eq("status", "pending")
                    .gte("scheduled_date", fromDate)
                    .order("scheduled_date", { ascending: true });
                if (error) throw error;
                return data;
            }
        },
        create: async (item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const id = item.id || crypto.randomUUID();

                // Explicitly select columns to ensure correct order and presence
                const columns = [
                    'id', 'order_number', 'customer_name', 'customer_id', 'status', 'scheduled_date',
                    'quantity_kg', 'product_type', 'product_type_id', 'packaging_id', 'box_count',
                    'container_has_wheels', 'notes', 'is_recurring',
                    'recurrence_end_date', 'created_by', 'parent_order_id'
                ];

                const values = columns.map(col => {
                    if (col === 'id') return id;
                    // Handle status default if missing
                    if (col === 'status' && !item[col]) return 'pending';

                    // Handle booleans for MySQL (1/0)
                    if (col === 'container_has_wheels' || col === 'is_recurring') {
                        return item[col] ? 1 : 0;
                    }
                    const val = item[col];
                    return val === undefined ? null : val;
                });

                const placeholders = columns.map(() => '?').join(',');
                return executeMySQL(`INSERT INTO dry_ice_orders (${columns.join(',')}) VALUES (${placeholders})`, values);
            } else {
                const { data, error } = await supabase.from("dry_ice_orders").insert(item).select().single();
                if (error) throw error;
                return data;
            }
        },
        update: async (id: string, item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const keys = Object.keys(item).filter(k => k !== 'id' && k !== 'created_at' && k !== 'product_type_info' && k !== 'packaging_info');
                const values = keys.map(k => item[k]);
                values.push(id);
                const setClause = keys.map(k => `${k} = ?`).join(',');
                return executeMySQL(`UPDATE dry_ice_orders SET ${setClause} WHERE id = ?`, values);
            } else {
                const { data, error } = await supabase.from("dry_ice_orders").update(item).eq("id", id).select().single();
                if (error) throw error;
                return data;
            }
        },
        updateSeries: async (seriesId: string, dayDifference: number) => {
            const config = getConfig();
            if (config?.useMySQL) {
                // MySQL doesn't have specific DATE_ADD syntax in standard SQL across all versions in the same way, but usually DATE_ADD(date, INTERVAL X DAY)
                // We'll use a transaction logic in the backend function effectively, or just run a query
                return executeMySQL(
                    `UPDATE dry_ice_orders 
                     SET scheduled_date = DATE_ADD(scheduled_date, INTERVAL ? DAY) 
                     WHERE id = ? OR parent_order_id = ?`,
                    [dayDifference, seriesId, seriesId]
                );
            } else {
                // Supabase doesn't support "update all by adding interval" easily in one generic REST call without RPC or looping.
                // However, we can fetch, map, and upsert.
                const { data: seriesOrders, error: fetchError } = await supabase
                    .from("dry_ice_orders")
                    .select("*")
                    .or(`id.eq.${seriesId},parent_order_id.eq.${seriesId}`);

                if (fetchError) throw fetchError;
                if (!seriesOrders || seriesOrders.length === 0) return true;

                // We need date-fns here or just standard JS dates
                // Since this is in api.ts, let's assume we can do basic Date manipulation
                // BUT api.ts doesn't import date-fns. Let's do string manipulation carefully or import it?
                // Actually `updateSeries` was planned to replace the logic in CalendarOverview, so implementation there used `addDays`.
                // Let's rely on the caller passing enough info or we import date-fns here (which is cleaner).
                // Or we keep it consistent with other methods and just do the fetch-update loop here.

                const updates = seriesOrders.map((order: any) => {
                    const date = new Date(order.scheduled_date);
                    date.setDate(date.getDate() + dayDifference);
                    return {
                        ...order,
                        scheduled_date: date.toISOString().split('T')[0] // YYYY-MM-DD
                    };
                });

                const { error: updateError } = await supabase.from("dry_ice_orders").upsert(updates);
                if (updateError) throw updateError;
                return true;
            }
        },
        delete: async (id: string) => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("DELETE FROM dry_ice_orders WHERE id = ?", [id]);
            } else {
                const { error } = await supabase.from("dry_ice_orders").delete().eq("id", id);
                if (error) throw error;
                return true;
            }
        },
        deleteSeries: async (seriesId: string) => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("DELETE FROM dry_ice_orders WHERE id = ? OR parent_order_id = ?", [seriesId, seriesId]);
            } else {
                const { error } = await supabase.from("dry_ice_orders").delete().or(`id.eq.${seriesId},parent_order_id.eq.${seriesId}`);
                if (error) throw error;
                return true;
            }
        }
    },

    tasks: {
        getAll: async () => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("SELECT * FROM tasks ORDER BY due_date ASC");
            } else {
                const { data, error } = await supabase.from("tasks").select("*").order("due_date", { ascending: true });
                if (error) throw error;
                return data;
            }
        },
        create: async (item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const id = item.id || crypto.randomUUID();
                const keys = Object.keys(item).filter(k => k !== 'id');
                const values = keys.map(k => item[k]);
                keys.unshift('id');
                values.unshift(id);
                const placeholders = keys.map(() => '?').join(',');
                return executeMySQL(`INSERT INTO tasks (${keys.join(',')}) VALUES (${placeholders})`, values);
            } else {
                const { data, error } = await supabase.from("tasks").insert(item).select().single();
                if (error) throw error;
                return data;
            }
        },
        update: async (id: string, item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const keys = Object.keys(item).filter(k => k !== 'id' && k !== 'created_at');
                const values = keys.map(k => item[k]);
                values.push(id);
                const setClause = keys.map(k => `${k} = ?`).join(',');
                return executeMySQL(`UPDATE tasks SET ${setClause} WHERE id = ?`, values);
            } else {
                const { data, error } = await supabase.from("tasks").update(item).eq("id", id).select().single();
                if (error) throw error;
                return data;
            }
        },
        delete: async (id: string) => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("DELETE FROM tasks WHERE id = ?", [id]);
            } else {
                const { error } = await supabase.from("tasks").delete().eq("id", id);
                if (error) throw error;
                return true;
            }
        }
    },

    timeOffRequests: {
        getAll: async () => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("SELECT * FROM time_off_requests ORDER BY start_date DESC");
            } else {
                const { data, error } = await supabase.from("time_off_requests").select("*").order("start_date", { ascending: false });
                if (error) throw error;
                return data;
            }
        },
        create: async (item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const id = item.id || crypto.randomUUID();
                const keys = Object.keys(item).filter(k => k !== 'id');
                const values = keys.map(k => item[k]);
                keys.unshift('id');
                values.unshift(id);
                const placeholders = keys.map(() => '?').join(',');
                return executeMySQL(`INSERT INTO time_off_requests (${keys.join(',')}) VALUES (${placeholders})`, values);
            } else {
                const { data, error } = await supabase.from("time_off_requests").insert(item).select().single();
                if (error) throw error;
                return data;
            }
        },
        update: async (id: string, item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const keys = Object.keys(item).filter(k => k !== 'id' && k !== 'created_at');
                const values = keys.map(k => item[k]);
                values.push(id);
                const setClause = keys.map(k => `${k} = ?`).join(',');
                return executeMySQL(`UPDATE time_off_requests SET ${setClause} WHERE id = ?`, values);
            } else {
                const { data, error } = await supabase.from("time_off_requests").update(item).eq("id", id).select().single();
                if (error) throw error;
                return data;
            }
        },
        delete: async (id: string) => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("DELETE FROM time_off_requests WHERE id = ?", [id]);
            } else {
                const { error } = await supabase.from("time_off_requests").delete().eq("id", id);
                if (error) throw error;
                return true;
            }
        }
    },

    profiles: {
        getAll: async () => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("SELECT * FROM profiles ORDER BY full_name ASC");
            } else {
                const { data, error } = await supabase.from("profiles").select("*").order("full_name");
                if (error) throw error;
                return data;
            }
        },
        getByUserId: async (userId: string) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const rows = await executeMySQL("SELECT * FROM profiles WHERE user_id = ?", [userId]);
                return rows[0] || null;
            } else {
                const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
                if (error) throw error;
                return data;
            }
        },
        create: async (item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const id = item.id || crypto.randomUUID();
                const keys = Object.keys(item).filter(k => k !== 'id');
                const values = keys.map(k => item[k]);
                keys.unshift('id');
                values.unshift(id);
                const placeholders = keys.map(() => '?').join(',');
                return executeMySQL(`INSERT INTO profiles (${keys.join(',')}) VALUES (${placeholders})`, values);
            } else {
                const { data, error } = await supabase.from("profiles").insert(item).select().single();
                if (error) throw error;
                return data;
            }
        },
        update: async (id: string, item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const keys = Object.keys(item).filter(k => k !== 'id' && k !== 'created_at');
                const values = keys.map(k => item[k]);
                values.push(id);
                const setClause = keys.map(k => `${k} = ?`).join(',');
                return executeMySQL(`UPDATE profiles SET ${setClause} WHERE id = ?`, values);
            } else {
                const { data, error } = await supabase.from("profiles").update(item).eq("id", id).select().single();
                if (error) throw error;
                return data;
            }
        }
    },

    reports: {
        getDailyProductionByPeriod: async (fromDate: string, toDate: string, location: string | null) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const locationClause = location ? "AND location = ?" : "AND 1=1";
                const params = location ? [fromDate, toDate, location, fromDate, toDate, location] : [fromDate, toDate, fromDate, toDate];

                const query = `
                    SELECT 
                        COALESCE(c.pdate, d.pdate) as production_date,
                        COALESCE(c.cylinders, 0) as cylinder_count,
                        COALESCE(d.dry_ice, 0) as dry_ice_kg
                    FROM (
                        SELECT scheduled_date as pdate, SUM(cylinder_count) as cylinders
                        FROM gas_cylinder_orders
                        WHERE scheduled_date >= ? AND scheduled_date <= ? AND status != 'cancelled' ${locationClause}
                        GROUP BY scheduled_date
                    ) c
                    LEFT JOIN (
                        SELECT scheduled_date as pdate, SUM(quantity_kg) as dry_ice
                        FROM dry_ice_orders
                        WHERE scheduled_date >= ? AND scheduled_date <= ? AND status != 'cancelled' ${locationClause}
                        GROUP BY scheduled_date
                    ) d ON c.pdate = d.pdate
                    UNION
                    SELECT 
                        COALESCE(c.pdate, d.pdate) as production_date,
                        COALESCE(c.cylinders, 0) as cylinder_count,
                        COALESCE(d.dry_ice, 0) as dry_ice_kg
                    FROM (
                        SELECT scheduled_date as pdate, SUM(cylinder_count) as cylinders
                        FROM gas_cylinder_orders
                        WHERE scheduled_date >= ? AND scheduled_date <= ? AND status != 'cancelled' ${locationClause}
                        GROUP BY scheduled_date
                    ) c
                    RIGHT JOIN (
                        SELECT scheduled_date as pdate, SUM(quantity_kg) as dry_ice
                        FROM dry_ice_orders
                        WHERE scheduled_date >= ? AND scheduled_date <= ? AND status != 'cancelled' ${locationClause}
                        GROUP BY scheduled_date
                    ) d ON c.pdate = d.pdate
                    ORDER BY production_date
                `;
                // Note: MySQL doesn't support FULL OUTER JOIN, so we simulate it with LEFT JOIN UNION RIGHT JOIN. 
                // Initial simple implementation with LEFT JOIN usually covers most cases if gas cylinders are dominant, but UNION is safer.
                // Simplified version for now:
                const simpleQuery = `
                    SELECT 
                        scheduled_date as production_date,
                        SUM(CASE WHEN type='gas' THEN count ELSE 0 END) as cylinder_count,
                        SUM(CASE WHEN type='dry_ice' THEN count ELSE 0 END) as dry_ice_kg
                    FROM (
                        SELECT scheduled_date, cylinder_count as count, 'gas' as type, location FROM gas_cylinder_orders WHERE status != 'cancelled'
                        UNION ALL
                        SELECT scheduled_date, quantity_kg as count, 'dry_ice' as type, location FROM dry_ice_orders WHERE status != 'cancelled'
                    ) combined
                    WHERE scheduled_date >= ? AND scheduled_date <= ? ${location ? "AND location = ?" : ""}
                    GROUP BY scheduled_date
                    ORDER BY scheduled_date
                `;
                const simpleParams = location ? [fromDate, toDate, location] : [fromDate, toDate];
                return executeMySQL(simpleQuery, simpleParams);
            } else {
                const { data, error } = await supabase.rpc("get_daily_production_by_period", {
                    p_from_date: fromDate,
                    p_to_date: toDate,
                    p_location: location
                });
                if (error) throw error;
                return data;
            }
        },

        getGasTypeDistribution: async (fromDate: string, toDate: string, location: string | null) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const locationClause = location ? "AND gco.location = ?" : "";
                const params = location ? [fromDate, toDate, location] : [fromDate, toDate];
                const query = `
                    SELECT 
                        gt.id as gas_type_id,
                        COALESCE(gt.name, 'Onbekend') as gas_type_name,
                        COALESCE(gt.color, '#3b82f6') as gas_type_color,
                        COALESCE(SUM(gco.cylinder_count), 0) as total_cylinders
                    FROM gas_cylinder_orders gco
                    LEFT JOIN gas_types gt ON gco.gas_type_id = gt.id
                    WHERE gco.scheduled_date >= ? AND gco.scheduled_date <= ? 
                      AND gco.status != 'cancelled'
                      ${locationClause}
                    GROUP BY gt.id, gt.name, gt.color
                    ORDER BY total_cylinders DESC
                `;
                return executeMySQL(query, params);
            } else {
                const { data, error } = await supabase.rpc("get_gas_type_distribution_by_period", {
                    p_from_date: fromDate,
                    p_to_date: toDate,
                    p_location: location
                });
                if (error) throw error;
                return data;
            }
        },

        getGasCategoryDistribution: async (fromDate: string, toDate: string, location: string | null) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const locationClause = location ? "AND gco.location = ?" : "";
                const params = location ? [fromDate, toDate, location] : [fromDate, toDate];
                const query = `
                    SELECT 
                        gtc.id as category_id,
                        COALESCE(gtc.name, 'Geen categorie') as category_name,
                        COALESCE(SUM(gco.cylinder_count), 0) as total_cylinders
                    FROM gas_cylinder_orders gco
                    LEFT JOIN gas_types gt ON gco.gas_type_id = gt.id
                    LEFT JOIN gas_type_categories gtc ON gt.category_id = gtc.id
                    WHERE gco.scheduled_date >= ? AND gco.scheduled_date <= ?
                      AND gco.status != 'cancelled'
                      ${locationClause}
                    GROUP BY gtc.id, gtc.name
                    ORDER BY total_cylinders DESC
                `;
                return executeMySQL(query, params);
            } else {
                // Note: Cast as any to avoid TS error if types aren't fully updated yet
                const { data, error } = await supabase.rpc("get_gas_category_distribution_by_period" as any, {
                    p_from_date: fromDate,
                    p_to_date: toDate,
                    p_location: location
                });
                if (error) throw error;
                return data;
            }
        },

        getProductionEfficiency: async (fromDate: string, toDate: string, location: string | null) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const locationClause = location ? "AND location = ?" : "";
                const params = location ? [fromDate, toDate, location] : [fromDate, toDate];
                const query = `
                    SELECT 
                        COUNT(*) as total_orders,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
                        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
                        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
                        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN cylinder_count ELSE 0 END), 0) as total_cylinders,
                        COALESCE(SUM(CASE WHEN status = 'completed' THEN cylinder_count ELSE 0 END), 0) as completed_cylinders
                    FROM gas_cylinder_orders
                    WHERE scheduled_date >= ? AND scheduled_date <= ?
                    ${locationClause}
                `;
                const rows = await executeMySQL(query, params);
                const stats = rows[0];
                const nonCancelled = stats.total_orders - stats.cancelled_orders;
                const efficiency_rate = nonCancelled > 0 ? Math.round((stats.completed_orders * 100) / nonCancelled * 10) / 10 : 0;

                return [{ ...stats, efficiency_rate }];
            } else {
                const { data, error } = await supabase.rpc("get_production_efficiency_by_period", {
                    p_from_date: fromDate,
                    p_to_date: toDate,
                    p_location: location
                });
                if (error) throw error;
                return data;
            }
        },

        getDryIceEfficiency: async (fromDate: string, toDate: string, location: string | null) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const locationClause = location ? "AND location = ?" : "";
                const params = location ? [fromDate, toDate, location] : [fromDate, toDate];
                const query = `
                    SELECT 
                        COUNT(*) as total_orders,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders,
                        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
                        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
                        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN quantity_kg ELSE 0 END), 0) as total_kg,
                        COALESCE(SUM(CASE WHEN status = 'completed' THEN quantity_kg ELSE 0 END), 0) as completed_kg
                    FROM dry_ice_orders
                    WHERE scheduled_date >= ? AND scheduled_date <= ?
                    ${locationClause}
                `;
                const rows = await executeMySQL(query, params);
                const stats = rows[0];
                const nonCancelled = stats.total_orders - stats.cancelled_orders;
                const efficiency_rate = nonCancelled > 0 ? Math.round((stats.completed_orders * 100) / nonCancelled * 10) / 10 : 0;

                return [{ ...stats, efficiency_rate }];
            } else {
                const { data, error } = await supabase.rpc("get_dry_ice_efficiency_by_period", {
                    p_from_date: fromDate,
                    p_to_date: toDate,
                    p_location: location
                });
                if (error) throw error;
                return data;
            }
        }
        ,

        getCustomerTotals: async (fromDate: string, toDate: string, location: string | null) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const locationClause = location ? "AND location = ?" : "";
                const params = location ? [fromDate, toDate, location] : [fromDate, toDate];
                // Simplified union approach
                const query = `
                    SELECT 
                        customer_id,
                        customer_name,
                        SUM(CASE WHEN type='gas' THEN count ELSE 0 END) as total_cylinders,
                        SUM(CASE WHEN type='dry_ice' THEN count ELSE 0 END) as total_dry_ice_kg
                    FROM (
                        SELECT customer_id, customer_name, cylinder_count as count, 'gas' as type FROM gas_cylinder_orders 
                        WHERE scheduled_date >= ? AND scheduled_date <= ? AND status != 'cancelled' ${locationClause}
                        UNION ALL
                        SELECT customer_id, customer_name, quantity_kg as count, 'dry_ice' as type FROM dry_ice_orders 
                        WHERE scheduled_date >= ? AND scheduled_date <= ? AND status != 'cancelled' ${locationClause}
                    ) combined
                    GROUP BY customer_id, customer_name
                    ORDER BY total_cylinders DESC
                 `;
                // Params need to be doubled because of UNION
                const allParams = [...params, ...params];
                return executeMySQL(query, allParams);
            } else {
                const { data, error } = await supabase.rpc("get_customer_totals_by_period", {
                    p_from_date: fromDate,
                    p_to_date: toDate,
                    p_location: location
                });
                if (error) throw error;
                return data;
            }
        }
    },

    timeOffTypes: {
        getAll: async () => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("SELECT * FROM time_off_types ORDER BY name ASC");
            } else {
                const { data, error } = await supabase.from("time_off_types").select("*").order("name");
                if (error) throw error;
                return data;
            }
        },
        create: async (item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const id = item.id || crypto.randomUUID();
                const keys = Object.keys(item).filter(k => k !== 'id');
                const values = keys.map(k => item[k]);
                keys.unshift('id');
                values.unshift(id);
                const placeholders = keys.map(() => '?').join(',');
                return executeMySQL(`INSERT INTO time_off_types (${keys.join(',')}) VALUES (${placeholders})`, values);
            } else {
                const { data, error } = await supabase.from("time_off_types").insert(item).select().single();
                if (error) throw error;
                return data;
            }
        },
        update: async (id: string, item: any) => {
            const config = getConfig();
            if (config?.useMySQL) {
                const keys = Object.keys(item).filter(k => k !== 'id' && k !== 'created_at');
                const values = keys.map(k => item[k]);
                values.push(id);
                const setClause = keys.map(k => `${k} = ?`).join(',');
                return executeMySQL(`UPDATE time_off_types SET ${setClause} WHERE id = ?`, values);
            } else {
                const { data, error } = await supabase.from("time_off_types").update(item).eq("id", id).select().single();
                if (error) throw error;
                return data;
            }
        },
        delete: async (id: string) => {
            const config = getConfig();
            if (config?.useMySQL) {
                return executeMySQL("DELETE FROM time_off_types WHERE id = ?", [id]);
            } else {
                const { error } = await supabase.from("time_off_types").delete().eq("id", id);
                if (error) throw error;
                return true;
            }
        }
    },

    admin: {
        repairDatabase: async () => {
            const config = getConfig();
            if (config?.useMySQL) {
                const queries = [
                    // Profiles
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
                    // Time Off Requests
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
                    // Task Types
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
