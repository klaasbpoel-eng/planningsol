
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
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY; // Using publishable key as anon key

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('Checking profiles for null user_id...');
    const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
    if (pError) console.error(pError);
    else {
        const nullProfiles = profiles.filter(p => p.user_id === null);
        console.log(`Found ${nullProfiles.length} profiles with null user_id.`);
        if (nullProfiles.length > 0) console.log(nullProfiles);
    }

    console.log('Checking tasks assigned to "everyone" (null)...');
    const { data: tasks, error: tError } = await supabase.from('tasks').select('*').is('assigned_to', null);
    if (tError) console.error(tError);
    else {
        console.log(`Found ${tasks.length} tasks with null assigned_to.`);
        if (tasks.length > 0) {
            console.log('Sample task:', tasks[0]);
        }
    }
}

checkData();
