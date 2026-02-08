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
    }
};
