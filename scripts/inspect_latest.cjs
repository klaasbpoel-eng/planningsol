
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split(/\r?\n/).forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) return;
        const match = trimmedLine.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            process.env[key] = value;
        }
    });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectLatestTasks() {
    console.log('Fetching latest 5 tasks...');
    const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching tasks:', error);
        return;
    }

    tasks.forEach(task => {
        console.log(`Task: "${task.title}" (ID: ${task.id})`);
        console.log(`  - Assigned To: ${task.assigned_to} (Type: ${typeof task.assigned_to})`);
        console.log(`  - Created By: ${task.created_by}`);
        console.log(`  - Status: ${task.status}`);
        console.log('---');
    });

    // Check triggers via RPC if possible, or just assume we can't easily see them from client without SQL editor access.
    // However, we can try to find if there is a profile that matches null.

    console.log('Checking for profiles with weird user_ids...');
    const { data: profiles } = await supabase.from('profiles').select('id, user_id, full_name');
    if (profiles) {
        // Check if any profile matches the assigned_to of the latest task (if not null)
        const usersMap = {};
        profiles.forEach(p => usersMap[p.user_id] = p.full_name);

        const nullUserProfiles = profiles.filter(p => p.user_id == null || p.user_id === 'null' || p.user_id === '');
        console.log('Profiles with null/empty user_id:', nullUserProfiles);
    }
}

inspectLatestTasks();
