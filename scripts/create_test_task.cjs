
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

async function createTestTask() {
    console.log('Creating test task with assigned_to: null');

    // We need a valid profile ID for created_by, usually. 
    // Since we are using anon key, maybe we can't set created_by explicitly if RLS relies on auth.uid()
    // But let's try.

    const task = {
        title: 'Test Task Everyone',
        status: 'pending',
        priority: 'medium',
        due_date: new Date().toISOString().split('T')[0],
        assigned_to: null,
        // created_by: ... we likely can't set this easily without a real user token, 
        // but maybe the DB defaults it? Or maybe it's required? 
        // Let's try inserting without created_by and see if it works (anon user)
    };

    const { data, error } = await supabase
        .from('tasks')
        .insert(task)
        .select()
        .single();

    if (error) {
        console.error('Error creating task:', error);
    } else {
        console.log('Task created:', data);
        console.log('Assigned To:', data.assigned_to);
    }
}

createTestTask();
