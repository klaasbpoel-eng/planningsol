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

    if (error) throw error;
    if (data.error) throw new Error(data.error);
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

        create: async (customer: any) => {
            // Implementation for create would go here
            throw new Error("Create not implemented in API layer yet for MySQL");
        },

        update: async (id: string, customer: any) => {
            // Implementation for update would go here
            throw new Error("Update not implemented in API layer yet for MySQL");
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
    }
};
